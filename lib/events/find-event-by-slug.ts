import "server-only";
import { cache } from "react";

import { eventSlugSchema } from "@/lib/events/event-validation";
import { createEventBrandingUrls } from "@/lib/events/event-branding-storage";
import { eventBrandingColorsSchema } from "@/lib/events/event-branding-policy";
import { isEventActive, type EventSummary } from "@/lib/events/event";
import { infrastructureError } from "@/lib/errors/application-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const findEventBySlug = cache(async function findEventBySlug(
  untrustedSlug: string,
): Promise<EventSummary | null> {
  const slugResult = eventSlugSchema.safeParse(untrustedSlug);

  if (!slugResult.success) {
    return null;
  }

  // Closed events are deliberately hidden by the public RLS policy. This
  // server-only lookup exposes one validated slug through the rendered page,
  // without opening inactive event rows through the Data API.
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,name,slug,event_date,is_active,primary_color,accent_color,cover_storage_path,logo_storage_path,closing_message,photos_available_until,organizer_contact,location,maps_url,max_companions,instructions",
    )
    .eq("slug", slugResult.data)
    .maybeSingle();

  if (error) {
    throw infrastructureError();
  }

  if (!data) {
    return null;
  }

  const urls = await createEventBrandingUrls(
    data.cover_storage_path,
    data.logo_storage_path,
  );
  const colors = eventBrandingColorsSchema.safeParse({
    accentColor: data.accent_color,
    primaryColor: data.primary_color,
  });

  if (!colors.success) {
    throw infrastructureError();
  }

  return {
    ...colors.data,
    instructions: data.instructions,
    availabilityUntil: data.photos_available_until,
    closingMessage: data.closing_message,
    coverImageUrl: urls.coverImageUrl,
    id: data.id,
    logoImageUrl: urls.logoImageUrl,
    name: data.name,
    location: data.location,
    mapsUrl: data.maps_url,
    maxCompanions: data.max_companions,
    organizerContact: data.organizer_contact,
    slug: data.slug,
    eventDate: data.event_date,
    isActive: data.is_active,
  };
});

export async function findActiveEventBySlug(
  untrustedSlug: string,
): Promise<EventSummary | null> {
  const event = await findEventBySlug(untrustedSlug);

  return event && isEventActive(event) ? event : null;
}
