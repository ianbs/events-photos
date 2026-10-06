import "server-only";

import { createHash } from "node:crypto";
import { forbiddenError, infrastructureError, notFoundError, validationError } from "@/lib/errors/application-error";
import { eventSlugSchema } from "@/lib/events/event-validation";
import { rsvpCredentialsSchema } from "@/lib/events/rsvp-contract";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export function hashInvitationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function resolveRsvpIdentity(slug: string, credentials: unknown) {
  const slugResult = eventSlugSchema.safeParse(slug);
  const result = rsvpCredentialsSchema.safeParse(credentials);
  if (!slugResult.success || !result.success) throw validationError("Identificação inválida.");
  const supabase = createAdminSupabaseClient();
  const { data: event, error: eventError } = await supabase.from("events")
    .select("id").eq("slug", slugResult.data).eq("is_active", true).maybeSingle();
  if (eventError) throw infrastructureError();
  if (!event) throw notFoundError("Evento não encontrado ou inativo.");
    const { data, error } = await supabase.from("event_rsvp_identities")
      .select("guest_id").eq("event_id", event.id)
      .eq("invitation_hash", hashInvitationCode(result.data.invitationCode))
      .is("invitation_revoked_at", null).maybeSingle();
    if (error) throw infrastructureError();
    if (!data) throw forbiddenError("Convite inválido ou revogado. Confira seu código.");
    return { eventId: event.id, guestId: data.guest_id };
}
