import { describe, expect, it } from "vitest";
import { createInvitationCsv, createInvitationMessage, createWhatsAppUrl } from "./invitation-distribution";
import { rsvpGuestInputSchema } from "./rsvp-guest-contract";

describe("WhatsApp invitation preparation", () => {
  it("personalizes the configured message and preserves line breaks", () => {
    expect(createInvitationMessage("Ana", "Festa", "https://example.com/convite", "Olá, {nome}!\nEsperamos você em {evento}.\n{link}"))
      .toBe("Olá, Ana!\nEsperamos você em Festa.\nhttps://example.com/convite");
  });
  it("always includes the private invitation link", () => {
    expect(createInvitationMessage("Ana", "Festa", "https://example.com/convite", "Venha celebrar!"))
      .toBe("Venha celebrar!\n\nhttps://example.com/convite");
  });
  it("does not interpret placeholders contained in guest names", () => {
    expect(createInvitationMessage("{link}", "{nome}", "https://example.com/convite", "{nome} · {evento} · {link}"))
      .toBe("{link} · {nome} · https://example.com/convite");
  });
  it("normalizes international phone formatting and rejects invalid numbers", () => {
    expect(rsvpGuestInputSchema.parse({ name: "Ana", phone: "+55 (11) 99999-9999" }).phone).toBe("5511999999999");
    expect(rsvpGuestInputSchema.safeParse({ name: "Ana", phone: "not-a-number" }).success).toBe(false);
  });
  it("encodes the entire message, including the private invitation fragment", () => {
    const message = createInvitationMessage("Ana & João", "Festa", "https://example.com/#convite=code");
    expect(createWhatsAppUrl("5511999999999", message)).toBe(`https://wa.me/5511999999999?text=${encodeURIComponent(message)}`);
    expect(createWhatsAppUrl(null, message)).toBeNull();
  });
  it("escapes CSV cells and neutralizes spreadsheet formulas", () => {
    expect(createInvitationCsv([["Nome", "Link"], ['=HYPERLINK("bad")', "https://example.com/#convite=code"]]))
      .toBe('\uFEFF"Nome";"Link"\r\n"\'=HYPERLINK(""bad"")";"https://example.com/#convite=code"');
  });
});
