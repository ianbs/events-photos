import { z } from "zod";
const optionalText = (value: unknown) => typeof value === "string" ? value.trim() || null : value ?? null;
export const rsvpGuestInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.preprocess((v) => typeof v === "string" ? v.trim().toLowerCase() || null : v ?? null, z.email().max(254).nullable()),
  phone: z.preprocess((v) => {
    const value = optionalText(v);
    if (typeof value !== "string") return value;
    if (!/^[+\d\s().-]+$/.test(value)) return value;
    return value.replace(/\D/g, "");
  }, z.string().regex(/^[1-9][0-9]{7,14}$/).nullable()),
});

export const invitationExportSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1).max(500),
});

export const MAX_RSVP_GUEST_BATCH = 100;
export const rsvpGuestBatchSchema = z.object({
  batchId: z.string().uuid(),
  guests: z.array(rsvpGuestInputSchema).min(1).max(MAX_RSVP_GUEST_BATCH),
}).superRefine(({ guests }, context) => {
  const emails = new Set<string>();
  guests.forEach((guest, index) => {
    if (!guest.email) return;
    if (emails.has(guest.email)) context.addIssue({
      code: "custom", path: ["guests", index, "email"],
      message: "Este e-mail já foi informado em outra linha.",
    });
    emails.add(guest.email);
  });
});

export const rsvpGuestBatchResponseSchema = z.object({ savedCount: z.number().int().min(1).max(MAX_RSVP_GUEST_BATCH) });
