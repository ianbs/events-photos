import { z } from "zod";

export const invitationCodeSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/);

export const rsvpCredentialsSchema = z.object({ method: z.literal("invitation"), invitationCode: invitationCodeSchema });
export type RsvpCredentials = z.infer<typeof rsvpCredentialsSchema>;

export const rsvpInputSchema = z.object({
  credentials: rsvpCredentialsSchema,
  name: z.string().trim().min(1).max(200),
  attending: z.boolean(),
  companions: z.number().int().min(0).max(2147483647),
}).refine((input) => input.attending || input.companions === 0, {
  message: "Quem não comparecer deve informar zero acompanhantes.",
  path: ["companions"],
});

export const rsvpResponseSchema = z.object({
  rsvp: z.object({
    name: z.string(),
    attending: z.boolean(),
    companions: z.number().int(),
  }).nullable(),
});

export type Rsvp = NonNullable<z.infer<typeof rsvpResponseSchema>["rsvp"]>;
