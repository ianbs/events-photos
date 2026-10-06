import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { infrastructureError, validationError } from "@/lib/errors/application-error";
import { rsvpInputSchema } from "@/lib/events/rsvp-contract";
import { eventIdSchema } from "@/lib/events/event-validation";
import { resolveRsvpIdentity } from "@/lib/events/rsvp-identity-service";
import { getRsvpCompanionLimit } from "@/lib/events/rsvp-companions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function readGuestRsvp(slug: string, credentials: unknown) {
  const guest = await resolveRsvpIdentity(slug, credentials);
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
  const guest = await resolveRsvpIdentity(slug, input.credentials);
  const supabase = createAdminSupabaseClient();
  const { data: event, error: eventError } = await supabase.from("events")
    .select("max_companions").eq("id", guest.eventId).maybeSingle();
  if (eventError || !event) throw infrastructureError();
  const companionLimit = getRsvpCompanionLimit(event.max_companions);
  if (input.companions > companionLimit) {
    throw validationError(companionLimit === 0 ? "Este evento não permite acompanhantes."
      : `Este evento permite no máximo ${companionLimit} acompanhante(s) por convidado.`);
  }
  const { data, error } = await supabase
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
  if (error?.code === "23514") throw validationError("Revise a quantidade de acompanhantes permitida para este evento.");
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
