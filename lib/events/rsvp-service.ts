import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { infrastructureError, validationError } from "@/lib/errors/application-error";
import { escapeRsvpSearch, rsvpListFiltersSchema } from "@/lib/events/admin-rsvp-list";
import { rsvpInputSchema } from "@/lib/events/rsvp-contract";
import { eventIdSchema } from "@/lib/events/event-validation";
import { resolveRsvpIdentity } from "@/lib/events/rsvp-identity-service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function readGuestRsvp(slug: string, credentials: unknown) {
  const guest = await resolveRsvpIdentity(slug, credentials);
  const { data, error } = await createAdminSupabaseClient()
    .from("event_rsvps")
    .select("name,attending,companions,companion_names")
    .eq("event_id", guest.eventId)
    .eq("guest_id", guest.guestId)
    .maybeSingle();
  if (error) throw infrastructureError();
  return { rsvp: data, companionLimit: guest.companionLimit };
}

export async function saveGuestRsvp(slug: string, untrustedInput: unknown) {
  const result = rsvpInputSchema.safeParse(untrustedInput);
  if (!result.success) throw validationError("Revise seu nome, presença e acompanhantes.");
  const input = result.data;
  const guest = await resolveRsvpIdentity(slug, input.credentials);
  const supabase = createAdminSupabaseClient();
  const companionLimit = guest.companionLimit;
  if (input.companions > companionLimit) {
    throw validationError(companionLimit === 0 ? "Seu convite não permite acompanhantes."
      : `Seu convite permite no máximo ${companionLimit} acompanhante(s).`);
  }
  const { data, error } = await supabase
    .from("event_rsvps")
    .upsert({
      event_id: guest.eventId,
      guest_id: guest.guestId,
      name: input.name,
      attending: input.attending,
      companions: input.companions,
      companion_names: input.companionNames,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,guest_id" })
    .select("name,attending,companions,companion_names")
    .single();
  if (error?.code === "23514") throw validationError("Revise a quantidade de acompanhantes permitida para este evento.");
  if (error || !data) throw infrastructureError();
  return data;
}

export async function listAdminRsvps(eventId: string, page: number, filters: unknown = {}) {
  await requireAdmin();
  const input = z.object({ eventId: eventIdSchema, page: z.number().int().min(1).max(100000) }).safeParse({ eventId, page });
  if (!input.success) throw validationError("Evento ou página inválidos.");
  const parsedFilters = rsvpListFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) throw validationError("Filtros de presença inválidos.");
  const { q, status, sort } = parsedFilters.data;
  const pageSize = 50;
  let request = createAdminSupabaseClient()
    .from("event_rsvps")
    .select("guest_id,name,attending,companions,companion_names,updated_at", { count: "exact" })
    .eq("event_id", eventId);
  if (q) request = request.ilike("name", `%${escapeRsvpSearch(q)}%`);
  if (status !== "all") request = request.eq("attending", status === "confirmed");
  request = sort === "name" ? request.order("name", { ascending: true })
    : request.order("updated_at", { ascending: sort === "oldest" });
  const { data, error, count } = await request.order("guest_id")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw infrastructureError();
  return { responses: data ?? [], total: count ?? 0, pageSize };
}

export async function readAdminRsvpSummary(eventId: string) {
  await requireAdmin();
  if (!eventIdSchema.safeParse(eventId).success) throw validationError("Evento inválido.");
  const supabase = createAdminSupabaseClient();
  const [pending, confirmed, declined] = await Promise.all([
    supabase.from("guests")
      .select("id,event_rsvp_identities!inner(guest_id),event_rsvps()", { count: "exact", head: true })
      .eq("event_id", eventId).is("event_rsvps", null),
    supabase.from("event_rsvps").select("guest_id,companions", { count: "exact" })
      .eq("event_id", eventId).eq("attending", true).order("guest_id").range(0, 499),
    supabase.from("event_rsvps").select("guest_id", { count: "exact", head: true }).eq("event_id", eventId).eq("attending", false),
  ]);
  if ([pending, confirmed, declined].some((result) => result.error || result.count === null)) throw infrastructureError();
  if (!confirmed.data) throw infrastructureError();
  let companions = confirmed.data.reduce((sum, response) => sum + response.companions, 0);
  let offset = confirmed.data.length;
  // Follow the actual number returned, even when the API row limit is below 500.
  while (offset < confirmed.count!) {
    const { data, error } = await supabase.from("event_rsvps").select("guest_id,companions")
      .eq("event_id", eventId).eq("attending", true).order("guest_id").range(offset, offset + 499);
    if (error || !data?.length) throw infrastructureError();
    companions += data.reduce((sum, response) => sum + response.companions, 0);
    offset += data.length;
  }
  const confirmedPeople = confirmed.count! + companions;
  return {
    total: pending.count! + confirmedPeople + declined.count!,
    confirmed: confirmedPeople, confirmedGuests: confirmed.count!, companions,
    declined: declined.count!, pending: pending.count!,
  };
}
