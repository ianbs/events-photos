import { describe, expect, it } from "vitest";
import { filterAndSortAdminEvents, formatEventListDate } from "./admin-event-list";

const events = [
  { id: "1", name: "Batizado da Júlia", slug: "batizado-julia", location: "Salão Central", eventDate: "2026-10-18", isActive: true, photoCount: 2 },
  { id: "2", name: "Aniversário", slug: "aniversario", location: "Salão Central", eventDate: "2026-11-01", isActive: false, photoCount: 20 },
  { id: "3", name: "Casamento", slug: "casamento", location: null, eventDate: "2026-12-15", isActive: true, photoCount: 10 },
];

describe("event list filters and sorting", () => {
  it("combines accent-insensitive search terms with the selected status", () => {
    expect(filterAndSortAdminEvents(events, " JULIA salao ", "active", "recent").map((event) => event.id)).toEqual(["1"]);
    expect(filterAndSortAdminEvents(events, "salao", "closed", "recent").map((event) => event.id)).toEqual(["2"]);
  });

  it("sorts chronologically, alphabetically and by photo count without changing the input", () => {
    expect(filterAndSortAdminEvents(events, "", "all", "recent").map((event) => event.id)).toEqual(["3", "2", "1"]);
    expect(filterAndSortAdminEvents(events, "", "all", "oldest").map((event) => event.id)).toEqual(["1", "2", "3"]);
    expect(filterAndSortAdminEvents(events, "", "all", "name").map((event) => event.id)).toEqual(["2", "1", "3"]);
    expect(filterAndSortAdminEvents(events, "", "all", "photos").map((event) => event.id)).toEqual(["2", "3", "1"]);
    expect(events.map((event) => event.id)).toEqual(["1", "2", "3"]);
  });

  it("handles absent locations and empty results", () => {
    expect(filterAndSortAdminEvents(events, "inexistente", "all", "recent")).toEqual([]);
    expect(filterAndSortAdminEvents([], "", "all", "recent")).toEqual([]);
    expect(filterAndSortAdminEvents(events, "casamento", "active", "recent")).toHaveLength(1);
  });

  it("keeps calendar dates in the right day independently of the host timezone", () => {
    const result = formatEventListDate("2026-11-01");
    expect(result.day).toBe("01");
    expect(result.month).toBe("nov");
    expect(result.full).toBe("1 de novembro de 2026");
  });
});
