import { z } from "zod";

export const guestTokenSchema = z.string().uuid();

export function createGuestToken(): string {
  return crypto.randomUUID();
}

export function getGuestTokenStorageKey(eventId: string): string {
  return `event-photo-guest:${eventId}`;
}
