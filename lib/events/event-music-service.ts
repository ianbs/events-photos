import "server-only";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { conflictError, infrastructureError, notFoundError, validationError } from "@/lib/errors/application-error";
import { musicUploadInputSchema, saveEventMusicSchema, uploadedMusicSchema } from "@/lib/events/event-music-contract";
import { initializeMusicStorageUpload, removeMusicObjectBestEffort, validateMusicPath, verifyUploadedMusic } from "@/lib/events/event-music-storage";
import { eventIdSchema } from "@/lib/events/event-validation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function validateEventId(value: string) {
  const result = eventIdSchema.safeParse(value);
  if (!result.success) throw notFoundError("Evento não encontrado.");
  return result.data;
}

async function findMusic(eventId: string) {
  const { data, error } = await createAdminSupabaseClient().from("events")
    .select("music_storage_path,slug").eq("id", eventId).maybeSingle();
  if (error) throw infrastructureError();
  if (!data) throw notFoundError("Evento não encontrado.");
  return data;
}

export async function initializeEventMusicUpload(untrustedEventId: string, untrustedInput: unknown) {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  if (!musicUploadInputSchema.safeParse(untrustedInput).success) {
    throw validationError("Envie um arquivo MP3 de até 15 MB.");
  }
  await findMusic(eventId);
  return initializeMusicStorageUpload(eventId);
}

export async function saveEventMusic(untrustedEventId: string, untrustedInput: unknown) {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  const input = saveEventMusicSchema.safeParse(untrustedInput);
  if (!input.success) throw validationError("Selecione uma música ou marque a opção de remover.");
  const current = await findMusic(eventId);
  const asset = input.data.uploadedMusic;
  if (asset) await verifyUploadedMusic(eventId, asset);
  const newPath = asset?.path ?? null;
  const supabase = createAdminSupabaseClient();
  let query = supabase.from("events").update({ music_storage_path: newPath }).eq("id", eventId);
  // Avoid overwriting a concurrent change during verification.
  query = current.music_storage_path === null
    ? query.is("music_storage_path", null)
    : query.eq("music_storage_path", current.music_storage_path);
  const { data, error } = await query.select("slug").maybeSingle();
  if (error) throw infrastructureError();
  if (!data) throw conflictError("A música foi alterada. Atualize a página e tente novamente.");
  if (current.music_storage_path && current.music_storage_path !== newPath) {
    await removeMusicObjectBestEffort(current.music_storage_path);
  }
  return { slug: data.slug };
}

export async function cleanupEventMusicUpload(untrustedEventId: string, untrustedInput: unknown) {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  const input = uploadedMusicSchema.safeParse(untrustedInput);
  if (!input.success) throw validationError("Dados de limpeza inválidos.");
  validateMusicPath(eventId, input.data.path);
  const current = await findMusic(eventId);
  // A lost response after a successful save must never delete the active music.
  if (current.music_storage_path !== input.data.path) {
    await removeMusicObjectBestEffort(input.data.path);
  }
}
