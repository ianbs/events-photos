export type EventSummary = {
  accentColor: string;
  coverImageUrl: string | null;
  id: string;
  logoImageUrl: string | null;
  name: string;
  primaryColor: string;
  slug: string;
  eventDate: string;
  isActive: boolean;
};

export function isEventActive(event: Pick<EventSummary, "isActive">): boolean {
  return event.isActive;
}
