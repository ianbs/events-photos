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

  it("normalizes optional closing-page fields", () => {
    const result = createEventSchema.parse({
      availabilityUntil: "",
      closingMessage: "  Muito obrigado!  ",
      eventDate: "2026-08-16",
      isActive: false,
      name: "Evento",
      organizerContact: "   ",
      slug: "evento",
    });

    expect(result).toMatchObject({
      availabilityUntil: null,
      closingMessage: "Muito obrigado!",
      organizerContact: null,
    });
  });

  it("rejects an invalid availability date", () => {
    expect(
      createEventSchema.safeParse({
        availabilityUntil: "2026-02-31",
        closingMessage: "Obrigado!",
        eventDate: "2026-08-16",
        isActive: false,
        name: "Evento",
        organizerContact: null,
        slug: "evento",
      }).success,
    ).toBe(false);
  });
});
