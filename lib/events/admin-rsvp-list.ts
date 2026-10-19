import { z } from "zod";

export const rsvpListFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "confirmed", "declined"]).default("all"),
  sort: z.enum(["recent", "oldest", "name"]).default("recent"),
});
export type RsvpListFilters = z.infer<typeof rsvpListFiltersSchema>;
export type RsvpListQuery = RsvpListFilters & { page: number; invitationPage: number };
export type RsvpListSearchParams = { q?: string; status?: string; sort?: string; page?: string; invitationPage?: string };

export function readRsvpListQuery(query: RsvpListSearchParams): RsvpListQuery {
  const page = (value?: string) => {
    const parsed = z.coerce.number().int().min(1).max(100000).safeParse(value ?? 1);
    return parsed.success ? parsed.data : 1;
  };
  return {
    q: typeof query.q === "string" ? query.q.trim().slice(0, 100) : "",
    status: rsvpListFiltersSchema.shape.status.safeParse(query.status).data ?? "all",
    sort: rsvpListFiltersSchema.shape.sort.safeParse(query.sort).data ?? "recent",
    page: page(query.page), invitationPage: page(query.invitationPage),
  };
}

export function rsvpListHref(query: RsvpListQuery, changes: Partial<RsvpListQuery> = {}, anchor: "responses" | "guests" = "responses") {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status !== "all") params.set("status", next.status);
  if (next.sort !== "recent") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.invitationPage > 1) params.set("invitationPage", String(next.invitationPage));
  return `?${params.toString()}#${anchor}`;
}

export function escapeRsvpSearch(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
