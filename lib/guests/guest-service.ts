import "server-only";

import { eventSlugSchema } from "@/lib/events/event-validation";
import {
  forbiddenError,
  infrastructureError,
  notFoundError,
  validationError,
} from "@/lib/errors/application-error";
import { guestTokenSchema } from "@/lib/guests/guest-token";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AuthorizedGuest = {
  eventId: string;
  guestId: string;
  guestToken: string;
};

function parseGuestCredentials(slug: string, guestToken: string) {
  const slugResult = eventSlugSchema.safeParse(slug);
  const tokenResult = guestTokenSchema.safeParse(guestToken);

  if (!slugResult.success || !tokenResult.success) {
    throw validationError("Credenciais do convidado inválidas.");
  }

  return { slug: slugResult.data, guestToken: tokenResult.data };
}

async function findActiveEventId(slug: string): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw infrastructureError();
  }

  if (!data) {
    throw notFoundError("Evento não encontrado ou inativo.");
  }

  return data.id;
}

export async function createOrRecoverGuest(
  untrustedSlug: string,
  untrustedGuestToken: string,
): Promise<AuthorizedGuest> {
  const { slug, guestToken } = parseGuestCredentials(
    untrustedSlug,
    untrustedGuestToken,
  );
  const eventId = await findActiveEventId(slug);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("guests")
    .upsert(
      { event_id: eventId, guest_token: guestToken },
      { onConflict: "event_id,guest_token" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw infrastructureError();
  }

  return { eventId, guestId: data.id, guestToken };
}

export async function authorizeGuest(
  untrustedSlug: string,
  untrustedGuestToken: string,
): Promise<AuthorizedGuest> {
  const { slug, guestToken } = parseGuestCredentials(
    untrustedSlug,
    untrustedGuestToken,
  );
  const eventId = await findActiveEventId(slug);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id")
    .eq("event_id", eventId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  if (error) {
    throw infrastructureError();
  }

  if (!data) {
    throw forbiddenError("Convidado não autorizado para este evento.");
  }

  return { eventId, guestId: data.id, guestToken };
}
