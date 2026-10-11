export type EventSummary = {
  musicUrl: string | null;
  instructions: string | null;
  location: string | null;
  mapsUrl: string | null;
  maxCompanions: number | null;
  accentColor: string;
  availabilityUntil: string | null;
  closingMessage: string;
  coverImageUrl: string | null;
  id: string;
  logoImageUrl: string | null;
  name: string;
  organizerContact: string | null;
  primaryColor: string;
  slug: string;
  eventDate: string;
  isActive: boolean;
};

export function isEventActive(event: Pick<EventSummary, "isActive">): boolean {
  return event.isActive;
}
