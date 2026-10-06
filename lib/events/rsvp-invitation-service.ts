import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-authorization";
import { getServerEnvironment } from "@/lib/config/server-environment";
import { conflictError, infrastructureError, notFoundError, validationError } from "@/lib/errors/application-error";
import { eventIdSchema } from "@/lib/events/event-validation";
import { hashInvitationCode } from "@/lib/events/rsvp-identity-service";
import { invitationExportSchema, rsvpGuestInputSchema } from "@/lib/events/rsvp-guest-contract";
import { createInvitationCsv, createInvitationMessage, createWhatsAppUrl } from "@/lib/events/invitation-distribution";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function adminEvent(eventId: string) {
  await requireAdmin();
  if (!eventIdSchema.safeParse(eventId).success) throw validationError("Evento inválido.");
  const { data, error } = await createAdminSupabaseClient().from("events")
    .select("id,name,slug,is_active").eq("id", eventId).maybeSingle();
  if (error) throw infrastructureError();
  if (!data) throw notFoundError("Evento não encontrado.");
  return data;
}

function invitationResult(event: { slug: string; name: string }, code: string, guest: { name: string; phone: string | null }) {
  const base = getServerEnvironment().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const url = `${base}/e/${event.slug}/save-the-date#convite=${code}`;
  const message = createInvitationMessage(guest.name, event.name, url);
  return { code, url, whatsappUrl: createWhatsAppUrl(guest.phone, message) };
}

function writeError(error: { code?: string } | null) {
  if (error?.code === "23505") throw conflictError("Já existe um convidado com este e-mail neste evento. Abra o cadastro existente.");
  if (error) throw infrastructureError();
}

export async function createRsvpInvitation(eventId: string, input: unknown) {
  const event = await adminEvent(eventId);
  const result = rsvpGuestInputSchema.safeParse(input);
  if (!result.success) throw validationError("Revise o nome e os contatos do convidado. O telefone deve incluir o código do país.");
  const code = randomBytes(32).toString("base64url");
  const { error } = await createAdminSupabaseClient().rpc("create_rsvp_guest", {
    p_event_id: event.id, p_name: result.data.name, p_code: code,
    p_email: result.data.email ?? undefined, p_phone: result.data.phone ?? undefined,
  });
  writeError(error);
  return invitationResult(event, code, result.data);
}

export async function listRsvpInvitations(eventId: string, page = 1) {
  await adminEvent(eventId);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw validationError("Página inválida.");
  const supabase = createAdminSupabaseClient();
  const { data, error, count } = await supabase.from("event_rsvp_identities")
    .select("guest_id,name,email,phone,invitation_code,invitation_revoked_at", { count: "exact" })
    .eq("event_id", eventId).order("created_at", { ascending: false }).order("guest_id")
    .range((page - 1) * 50, page * 50 - 1);
  if (error) throw infrastructureError();
  const ids = (data ?? []).map((guest) => guest.guest_id);
  const responses = ids.length ? await supabase.from("event_rsvps")
    .select("guest_id,attending,companions").eq("event_id", eventId).in("guest_id", ids) : { data: [], error: null };
  if (responses.error) throw infrastructureError();
  const responsesByGuest = new Map((responses.data ?? []).map((rsvp) => [rsvp.guest_id, rsvp]));
  return {
    invitations: (data ?? []).map(({ invitation_code, ...guest }) => ({
      ...guest, hasRecoverableLink: Boolean(invitation_code), response: responsesByGuest.get(guest.guest_id) ?? null,
    })), total: count ?? 0,
  };
}

export async function changeRsvpInvitation(eventId: string, input: unknown) {
  const event = await adminEvent(eventId);
  const result = z.object({ guestId: eventIdSchema, action: z.enum(["retrieve", "edit", "renew", "revoke"]) }).safeParse(input);
  if (!result.success) throw validationError("Convidado inválido.");
  const supabase = createAdminSupabaseClient();
  if (result.data.action === "retrieve") {
    const { data, error } = await supabase.from("event_rsvp_identities")
      .select("name,phone,invitation_code,invitation_revoked_at").eq("event_id", event.id).eq("guest_id", result.data.guestId).maybeSingle();
    if (error) throw infrastructureError();
    if (!data) throw notFoundError("Convidado não encontrado.");
    if (data.invitation_revoked_at) throw validationError("Convite revogado. Gere um novo código para reativá-lo.");
    if (!data.invitation_code) throw validationError("Este convite antigo não tem código recuperável. Gere um novo código uma vez para habilitar a recuperação.");
    return invitationResult(event, data.invitation_code, data);
  }
  let changes;
  if (result.data.action === "edit") {
    const guest = rsvpGuestInputSchema.safeParse(input);
    if (!guest.success) throw validationError("Revise os dados do convidado.");
    changes = guest.data;
  } else if (result.data.action === "revoke") {
    changes = { invitation_revoked_at: new Date().toISOString() };
  } else {
    const code = randomBytes(32).toString("base64url");
    changes = { invitation_code: code, invitation_hash: hashInvitationCode(code), invitation_revoked_at: null };
  }
  const { data, error } = await supabase.from("event_rsvp_identities")
    .update(changes).eq("event_id", event.id).eq("guest_id", result.data.guestId)
    .select("name,phone,invitation_code").maybeSingle();
  writeError(error);
  if (!data) throw notFoundError("Convidado não encontrado.");
  return result.data.action === "renew" && data.invitation_code ? invitationResult(event, data.invitation_code, data) : null;
}

export async function exportRsvpInvitations(eventId: string, input: unknown) {
  const event = await adminEvent(eventId);
  const result = invitationExportSchema.safeParse(input);
  if (!result.success) throw validationError("Selecione de 1 a 500 convidados.");
  const ids = [...new Set(result.data.guestIds)];
  const { data, error } = await createAdminSupabaseClient().from("event_rsvp_identities")
    .select("guest_id,name,phone,invitation_code,invitation_revoked_at")
    .eq("event_id", event.id).in("guest_id", ids).order("name").order("guest_id");
  if (error) throw infrastructureError();
  if (data?.length !== ids.length) throw validationError("Algum convidado não pertence a este evento.");
  if (data.some((guest) => !guest.invitation_code || guest.invitation_revoked_at || !guest.phone)) {
    throw validationError("Selecione convidados com telefone e convite ativo recuperável.");
  }
  return createInvitationCsv([
    ["Nome", "Telefone", "Link do convite", "Mensagem", "Abrir WhatsApp"],
    ...data.map((guest) => {
      const invitation = invitationResult(event, guest.invitation_code!, guest);
      return [guest.name, guest.phone!, invitation.url, createInvitationMessage(guest.name, event.name, invitation.url), invitation.whatsappUrl!];
    }),
  ]);
}
