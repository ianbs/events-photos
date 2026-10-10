import { z } from "zod";
const optionalText = (value: unknown) => typeof value === "string" ? value.trim() || null : value ?? null;
export const rsvpGuestInputSchema = z.object({
  maxCompanions: z.preprocess(
    (value) => value === null || value === undefined || (typeof value === "string" && !value.trim())
      ? null : typeof value === "string" ? Number(value) : value,
    z.number().int().min(0).max(2147483647).nullable(),
  ).default(null),
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
