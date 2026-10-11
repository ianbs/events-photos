import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-authorization";
import { getServerEnvironment } from "@/lib/config/server-environment";
import { conflictError, infrastructureError, notFoundError, validationError } from "@/lib/errors/application-error";
import { eventIdSchema } from "@/lib/events/event-validation";
import { hashInvitationCode } from "@/lib/events/rsvp-identity-service";
import { invitationExportSchema, rsvpGuestInputSchema, rsvpGuestBatchSchema } from "@/lib/events/rsvp-guest-contract";
import { createInvitationCsv, createInvitationMessage, createWhatsAppUrl } from "@/lib/events/invitation-distribution";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function adminEvent(eventId: string) {
  await requireAdmin();
  if (!eventIdSchema.safeParse(eventId).success) throw validationError("Evento inválido.");
  const { data, error } = await createAdminSupabaseClient().from("events")
    .select("id,name,slug,is_active,whatsapp_message").eq("id", eventId).maybeSingle();
  if (error) throw infrastructureError();
  if (!data) throw notFoundError("Evento não encontrado.");
  return data;
}

function invitationResult(event: { slug: string; name: string; whatsapp_message: string | null }, code: string, guest: { name: string; phone: string | null }) {
  const base = getServerEnvironment().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const url = `${base}/e/${event.slug}/save-the-date#convite=${code}`;
  const message = createInvitationMessage(guest.name, event.name, url, event.whatsapp_message);
  return { code, url, message, phone: guest.phone, whatsappUrl: createWhatsAppUrl(guest.phone, message) };
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
    p_max_companions: result.data.maxCompanions ?? undefined,
  });
  writeError(error);
  return invitationResult(event, code, result.data);
}

export async function createRsvpInvitationBatch(eventId: string, input: unknown) {
  const event = await adminEvent(eventId);
  const result = rsvpGuestBatchSchema.safeParse(input);
  if (!result.success) {
    const index = result.error.issues[0]?.path[1];
    throw validationError(typeof index === "number"
      ? `Revise os dados do convidado ${index + 1}. Confira também e-mails repetidos na lista.`
      : "Informe de 1 a 100 convidados válidos.");
  }
  const { guests, batchId } = result.data;
  const inputHash = createHash("sha256").update(JSON.stringify(guests)).digest("hex");
  const { data, error } = await createAdminSupabaseClient().rpc("create_rsvp_guest_batch", {
    p_event_id: event.id, p_batch_id: batchId, p_input_hash: inputHash,
    p_guests: guests.map((guest) => ({ ...guest, code: randomBytes(32).toString("base64url") })),
  });
  if (error?.code === "22023") throw validationError("A lista foi alterada após uma tentativa de salvamento. Recarregue e confira os convidados cadastrados.");
  if (error?.code === "23505") throw conflictError("Já existe um convidado com um dos e-mails informados. Nenhum convidado desta lista foi salvo; revise os e-mails.");
  if (error || data !== guests.length) throw infrastructureError();
  return { savedCount: data };
}

export async function listRsvpInvitations(eventId: string, page = 1) {
  await adminEvent(eventId);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw validationError("Página inválida.");
  const supabase = createAdminSupabaseClient();
  const { data, error, count } = await supabase.from("event_rsvp_identities")
    .select("guest_id,name,email,phone,max_companions,invitation_code,invitation_revoked_at", { count: "exact" })
    .eq("event_id", eventId).order("created_at", { ascending: false }).order("guest_id")
    .range((page - 1) * 50, page * 50 - 1);
  if (error) throw infrastructureError();
  const ids = (data ?? []).map((guest) => guest.guest_id);
  const responses = ids.length ? await supabase.from("event_rsvps")
    .select("guest_id,attending,companions,companion_names").eq("event_id", eventId).in("guest_id", ids) : { data: [], error: null };
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
    changes = { name: guest.data.name, email: guest.data.email, phone: guest.data.phone, max_companions: guest.data.maxCompanions };
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

export async function prepareWhatsAppInvitations(eventId: string, input: unknown) {
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
  const byId = new Map(data.map((guest) => [guest.guest_id, guest]));
  return ids.map((guestId) => {
    const guest = byId.get(guestId)!;
    const invitation = invitationResult(event, guest.invitation_code!, guest);
    return { guestId, name: guest.name, phone: guest.phone!, url: invitation.url, message: invitation.message };
  });
}

export async function exportRsvpInvitations(eventId: string, input: unknown) {
  const invitations = await prepareWhatsAppInvitations(eventId, input);
  return createInvitationCsv([
    ["Nome", "Telefone", "Link do convite", "Mensagem", "Abrir WhatsApp"],
    ...invitations.map((invitation) => {
      return [invitation.name, invitation.phone, invitation.url, invitation.message, createWhatsAppUrl(invitation.phone, invitation.message)!];
    }),
  ]);
}

export async function deleteRsvpGuest(eventId: string, input: unknown) {
  const event = await adminEvent(eventId);
  const result = z.object({ guestId: eventIdSchema }).safeParse(input);
  if (!result.success) throw validationError("Convidado inválido.");
  const { data, error } = await createAdminSupabaseClient().rpc("delete_rsvp_guest", {
    p_event_id: event.id, p_guest_id: result.data.guestId,
  });
  if (error) throw infrastructureError();
  if (!data) throw notFoundError("Convidado não encontrado.");
}
