import { describe, expect, it } from "vitest";

import {
  createEventSchema,
  suggestEventSlug,
} from "./event-validation";

describe("event input validation", () => {
  it("normalizes a suggested slug without accents", () => {
    expect(suggestEventSlug("Casamento Ana & João!")).toBe(
      "casamento-ana-joao",
    );
  });

  it("accepts a valid calendar date", () => {
    expect(
      createEventSchema.safeParse({
        eventDate: "2026-08-16",
        isActive: true,
        name: "Evento de teste",
        slug: "evento-de-teste",
      }).success,
    ).toBe(true);
  });

  it("rejects impossible dates and unsafe slugs", () => {
    expect(
      createEventSchema.safeParse({
        eventDate: "2026-02-31",
        isActive: true,
        name: "Evento",
        slug: "Evento com espaços",
      }).success,
    ).toBe(false);
  });
});
