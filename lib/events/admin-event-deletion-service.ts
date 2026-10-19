import "server-only";

import { z } from "zod";
import type { Database } from "@/types/database";
import { requireAdmin } from "@/lib/auth/admin-authorization";
import {
  ApplicationError, conflictError, forbiddenError, infrastructureError, notFoundError, validationError,
} from "@/lib/errors/application-error";
import { EVENT_BRANDING_BUCKET } from "@/lib/events/event-branding-policy";
import { EVENT_MUSIC_BUCKET } from "@/lib/events/event-music-contract";
import { eventIdSchema } from "@/lib/events/event-validation";
import { getPhotoStorage, parseStorageProvider } from "@/lib/storage/photo-storage";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const inputSchema = z.object({ confirmation: z.string().trim().min(1).max(200) });
const DELETION_BATCH_SIZE = 20;
const STORAGE_CONCURRENCY = 4;

function validateId(value: string) {
  const result = eventIdSchema.safeParse(value);
  if (!result.success) throw validationError("Identificador do evento inválido.");
  return result.data;
}

function validateOwnedPath(eventId: string, path: string) {
  if (!path.startsWith(eventId + "/") || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw infrastructureError();
  }
}

export async function findEventDeletionSummary(untrustedId: string) {
  const actor = await requireAdmin();
  const eventId = validateId(untrustedId);
  const client = createAdminSupabaseClient();
  const { data: event, error } = await client.from("events")
    .select("id,name,slug").eq("id", eventId).eq("owner_id", actor.userId).maybeSingle();
  if (error) throw infrastructureError();
  if (!event) throw notFoundError("Evento não encontrado.");
  const [photos, guests, rsvps] = await Promise.all([
    client.from("photos").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    client.from("event_rsvp_identities").select("guest_id", { count: "exact", head: true }).eq("event_id", eventId),
    client.from("event_rsvps").select("guest_id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  if (photos.error || guests.error || rsvps.error) throw infrastructureError();
  return { ...event, photoCount: photos.count ?? 0, guestCount: guests.count ?? 0, rsvpCount: rsvps.count ?? 0 };
}

export async function deleteAdminEventBatch(untrustedId: string, untrustedInput: unknown) {
  const actor = await requireAdmin();
  const eventId = validateId(untrustedId);
  const input = inputSchema.safeParse(untrustedInput);
  if (!input.success) throw validationError("Digite o nome do evento para confirmar.");
  const client = createAdminSupabaseClient();
  const { data: event, error } = await client.from("events")
    .select("id,name,slug,cover_storage_path,logo_storage_path,music_storage_path")
    .eq("id", eventId).eq("owner_id", actor.userId).maybeSingle();
  if (error) throw infrastructureError();
  // A lost response after final deletion can be safely retried.
  if (!event) return { deleted: true, removedPhotos: 0, slug: null };
  if (input.data.confirmation !== event.name) {
    throw validationError("O nome informado não corresponde ao evento. Confira e tente novamente.");
  }

  // Validate the finalizer exists before beginning irreversible file cleanup.
  const { error: preflightError } = await client.rpc("finish_admin_event_deletion", {
    p_actor_id: actor.userId, p_event_id: eventId, p_confirmation: input.data.confirmation, p_check_only: true,
  });
  if (preflightError?.code === "42501") throw forbiddenError("Seu acesso administrativo foi revogado.");
  if (preflightError?.code === "22023") throw validationError("O evento foi renomeado. Atualize a página antes de continuar.");
  if (preflightError) throw infrastructureError();

  let removedPhotos = 0;
  try {
    const { data: paused, error: pauseError } = await client.from("events").update({ is_active: false })
      .eq("id", eventId).eq("owner_id", actor.userId).eq("name", input.data.confirmation).select("id").maybeSingle();
    if (pauseError) throw infrastructureError();
    if (!paused) throw conflictError("O evento foi alterado. Atualize a página antes de continuar.");
    const { data: photos, error: photoError } = await client.from("photos")
      .select("id,storage_path,storage_provider").eq("event_id", eventId).order("id")
      .limit(DELETION_BATCH_SIZE);
    if (photoError) throw infrastructureError();

    for (let offset = 0; offset < (photos?.length ?? 0); offset += STORAGE_CONCURRENCY) {
      const results = await Promise.allSettled(photos!.slice(offset, offset + STORAGE_CONCURRENCY).map(async (photo) => {
        validateOwnedPath(eventId, photo.storage_path);
        await getPhotoStorage(parseStorageProvider(photo.storage_provider)).remove(photo.storage_path);
        const { error: rowError } = await client.from("photos").delete().eq("event_id", eventId).eq("id", photo.id);
        if (rowError) throw infrastructureError();
        removedPhotos++;
      }));
      if (results.some((result) => result.status === "rejected")) throw infrastructureError();
    }
    if (photos?.length) return { deleted: false, removedPhotos, slug: event.slug };

    for (const [column, bucket] of [
      ["cover_storage_path", EVENT_BRANDING_BUCKET],
      ["logo_storage_path", EVENT_BRANDING_BUCKET],
      ["music_storage_path", EVENT_MUSIC_BUCKET],
    ] as const) {
      const path = event[column];
      if (!path) continue;
      validateOwnedPath(eventId, path);
      const { error: storageError } = await client.storage.from(bucket).remove([path]);
      if (storageError) throw infrastructureError();
      const clearUpdate: Database["public"]["Tables"]["events"]["Update"] = { [column]: null };
      const { error: clearError } = await client.from("events").update(clearUpdate)
        .eq("id", eventId).eq("owner_id", actor.userId).eq(column, path);
      if (clearError) throw infrastructureError();
    }

    const { data: deleted, error: deletionError } = await client.rpc("finish_admin_event_deletion", {
      p_actor_id: actor.userId, p_event_id: eventId, p_confirmation: input.data.confirmation,
    });
    if (deletionError?.code === "42501") throw forbiddenError("Seu acesso administrativo foi revogado.");
    if (deletionError?.code === "22023") throw validationError("O evento foi renomeado. Atualize a página antes de continuar.");
    if (deletionError) throw infrastructureError();
    return { deleted: deleted === true, removedPhotos, slug: event.slug };
  } catch (failure) {
    if (failure instanceof ApplicationError && failure.status < 500) throw failure;
    throw new ApplicationError("INFRASTRUCTURE_ERROR", 503,
      "A exclusão não foi concluída. O evento foi desativado e parte dos arquivos pode ter sido removida. Tente novamente para continuar a limpeza.");
  }
}
