import { z } from "zod";

export const invitationCodeSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/);

export const rsvpCredentialsSchema = z.object({ method: z.literal("invitation"), invitationCode: invitationCodeSchema });
export type RsvpCredentials = z.infer<typeof rsvpCredentialsSchema>;

export const rsvpInputSchema = z.object({
  credentials: rsvpCredentialsSchema,
  name: z.string().trim().min(1).max(200),
  attending: z.boolean(),
  companions: z.number().int().min(0).max(2147483647),
  companionNames: z.array(z.string().trim().min(1).max(200)).default([]),
}).refine((input) => input.attending || input.companions === 0, {
  message: "Quem não comparecer deve informar zero acompanhantes.",
  path: ["companions"],
}).refine((input) => input.companionNames.length <= input.companions, {
  message: "Informe no máximo um nome por acompanhante.", path: ["companionNames"],
});

export const rsvpResponseSchema = z.object({
  rsvp: z.object({
    name: z.string(),
    attending: z.boolean(),
    companions: z.number().int(),
    companion_names: z.array(z.string()).default([]),
  }).nullable(),
});

export const rsvpAccessResponseSchema = rsvpResponseSchema.extend({
  companionLimit: z.number().int().min(0).max(2147483647),
});

export type Rsvp = NonNullable<z.infer<typeof rsvpResponseSchema>["rsvp"]>;
