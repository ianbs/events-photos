import { describe, expect, it } from "vitest";

import {
  createEventSchema,
  suggestEventSlug,
} from "./event-validation";

describe("event input validation", () => {
  const validEvent = { eventDate: "2026-08-16", isActive: true, name: "Evento", slug: "evento" };

  it("normalizes optional invitation fields and preserves paragraphs", () => {
    expect(createEventSchema.parse({ ...validEvent, instructions: "  Traje social.\nChegue às 18h.  ", whatsappMessage: "  Olá, {nome}! {link}  " }))
      .toMatchObject({ instructions: "Traje social.\nChegue às 18h.", whatsappMessage: "Olá, {nome}! {link}" });
    expect(createEventSchema.parse({ ...validEvent, instructions: " ", whatsappMessage: " " }))
      .toMatchObject({ instructions: null, whatsappMessage: null });
  });
  it("rejects oversized invitation fields", () => {
    expect(createEventSchema.safeParse({ ...validEvent, instructions: "a".repeat(5001) }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, whatsappMessage: "a".repeat(3001) }).success).toBe(false);
  });

  it("normalizes location and optional capacity", () => {
    expect(createEventSchema.parse({ ...validEvent, location: "  Salão  ", mapsUrl: " ", maxCompanions: "150" }))
      .toMatchObject({ location: "Salão", mapsUrl: null, maxCompanions: 150 });
    expect(createEventSchema.parse({ ...validEvent, location: " ", maxCompanions: "" }))
      .toMatchObject({ location: null, mapsUrl: null, maxCompanions: null });
  });

  it.each([0, "0"])("accepts zero capacity %s", (maxCompanions) => {
    expect(createEventSchema.parse({ ...validEvent, maxCompanions }).maxCompanions).toBe(0);
  });

  it.each(["-1", "1.5", "abc", "2147483648", true])("rejects invalid capacity %s", (maxCompanions) => {
    expect(createEventSchema.safeParse({ ...validEvent, maxCompanions }).success).toBe(false);
  });

  it.each(["not a link", "https://", "javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:password@example.com"])("rejects unsafe maps link %s", (mapsUrl) => {
    expect(createEventSchema.safeParse({ ...validEvent, mapsUrl }).success).toBe(false);
  });

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
