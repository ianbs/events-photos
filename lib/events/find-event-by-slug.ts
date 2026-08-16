import "server-only";

import { eventSlugSchema } from "@/lib/events/event-validation";
import { isEventActive, type EventSummary } from "@/lib/events/event";
import { infrastructureError } from "@/lib/errors/application-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function findEventBySlug(
  untrustedSlug: string,
): Promise<EventSummary | null> {
  const slugResult = eventSlugSchema.safeParse(untrustedSlug);

  if (!slugResult.success) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, slug, event_date, is_active")
    .eq("slug", slugResult.data)
    .maybeSingle();

  if (error) {
    throw infrastructureError();
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    eventDate: data.event_date,
    isActive: data.is_active,
  };
}

export async function findActiveEventBySlug(
  untrustedSlug: string,
): Promise<EventSummary | null> {
  const event = await findEventBySlug(untrustedSlug);

  return event && isEventActive(event) ? event : null;
}
