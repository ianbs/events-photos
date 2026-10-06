export function getEventCountdown(eventDate: string, now: number) {
  // Events currently store a calendar date only. Count to midnight in Brasília.
  const start = new Date(`${eventDate}T00:00:00-03:00`).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((start - now) / 1000));

  return {
    days: Math.floor(remainingSeconds / 86400),
    hours: Math.floor((remainingSeconds % 86400) / 3600),
    minutes: Math.floor((remainingSeconds % 3600) / 60),
    seconds: remainingSeconds % 60,
    status: now < start ? "upcoming" : now < start + 86400000 ? "today" : "past",
  } as const;
}
