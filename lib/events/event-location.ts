import { eventMapsUrlSchema } from "@/lib/events/event-validation";

export function getEventMapsUrl(event: {
  location: string | null;
  mapsUrl: string | null;
}): string | null {
  const customUrl = eventMapsUrlSchema.safeParse(event.mapsUrl);
  if (customUrl.success && customUrl.data) return customUrl.data;
  if (!event.location?.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location.trim())}`;
}
