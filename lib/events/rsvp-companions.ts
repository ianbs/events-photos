export function getRsvpCompanionLimit(maxCompanions: number | null, guestMaxCompanions: number | null = null): number {
  return guestMaxCompanions ?? maxCompanions ?? 10;
}
