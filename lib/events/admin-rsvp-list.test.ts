import { describe, expect, it } from "vitest";
import { escapeRsvpSearch, readRsvpListQuery, rsvpListHref } from "./admin-rsvp-list";

describe("RSVP list navigation", () => {
  it("normalizes untrusted filters and bounds search length", () => {
    expect(readRsvpListQuery({ status: "unknown", sort: "invalid", page: "-4", invitationPage: "oops" })).toEqual({
      q: "", status: "all", sort: "recent", page: 1, invitationPage: 1,
    });
    expect(readRsvpListQuery({ q: " a ".repeat(100), page: "2", status: "confirmed" })).toMatchObject({ q: expect.any(String), page: 2, status: "confirmed" });
    expect(readRsvpListQuery({ q: "a".repeat(150) }).q).toHaveLength(100);
  });
  it("preserves both lists' state when moving between pages", () => {
    const query = readRsvpListQuery({ q: "Ana & João", status: "confirmed", sort: "name", page: "2", invitationPage: "3" });
    const url = new URL(rsvpListHref(query, { page: 3 }), "https://example.com/rsvps");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "Ana & João", status: "confirmed", sort: "name", page: "3", invitationPage: "3" });
    expect(url.hash).toBe("#responses");
    const guests = new URL(rsvpListHref(query, { invitationPage: 4 }, "guests"), "https://example.com/rsvps");
    expect(guests.searchParams.get("page")).toBe("2");
    expect(guests.searchParams.get("status")).toBe("confirmed");
    expect(guests.hash).toBe("#guests");
  });
  it("can reset response filters without losing the invitation page", () => {
    const query = readRsvpListQuery({ q: "Ana", status: "declined", sort: "name", page: "8", invitationPage: "3" });
    expect(rsvpListHref(query, { q: "", status: "all", sort: "recent", page: 1 })).toBe("?invitationPage=3#responses");
  });
  it("escapes SQL pattern wildcards in guest names", () => {
    expect(escapeRsvpSearch("100%_Nome")).toBe("100\\%\\_Nome");
  });
});
