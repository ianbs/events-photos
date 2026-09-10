export type EventSummary = {
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
