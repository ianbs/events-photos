export type EventSummary = {
  id: string;
  name: string;
  slug: string;
  eventDate: string;
  isActive: boolean;
};

export function isEventActive(event: Pick<EventSummary, "isActive">): boolean {
  return event.isActive;
}
