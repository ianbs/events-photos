import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { infrastructureError, validationError } from "@/lib/errors/application-error";
import { rsvpInputSchema } from "@/lib/events/rsvp-contract";
import { eventIdSchema } from "@/lib/events/event-validation";
import { authorizeGuest, createOrRecoverGuest } from "@/lib/guests/guest-service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function readGuestRsvp(slug: string, guestToken: string) {
  const guest = await createOrRecoverGuest(slug, guestToken);
  const { data, error } = await createAdminSupabaseClient()
    .from("event_rsvps")
    .select("name,attending,companions")
    .eq("event_id", guest.eventId)
    .eq("guest_id", guest.guestId)
    .maybeSingle();
  if (error) throw infrastructureError();
  return data;
}

export async function saveGuestRsvp(slug: string, untrustedInput: unknown) {
  const result = rsvpInputSchema.safeParse(untrustedInput);
  if (!result.success) throw validationError("Revise seu nome, presença e acompanhantes.");
  const input = result.data;
  const guest = await authorizeGuest(slug, input.guestToken);
  const { data, error } = await createAdminSupabaseClient()
    .from("event_rsvps")
    .upsert({
      event_id: guest.eventId,
      guest_id: guest.guestId,
      name: input.name,
      attending: input.attending,
      companions: input.companions,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,guest_id" })
    .select("name,attending,companions")
    .single();
  if (error || !data) throw infrastructureError();
  return data;
}

export async function listAdminRsvps(eventId: string, page: number) {
  await requireAdmin();
  const input = z.object({ eventId: eventIdSchema, page: z.number().int().min(1).max(100000) }).safeParse({ eventId, page });
  if (!input.success) throw validationError("Evento ou página inválidos.");
  const pageSize = 50;
  const { data, error, count } = await createAdminSupabaseClient()
    .from("event_rsvps")
    .select("guest_id,name,attending,companions,updated_at", { count: "exact" })
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false })
    .order("guest_id")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw infrastructureError();
  return { responses: data ?? [], total: count ?? 0, pageSize };
}
