import { z } from "zod";

import { guestTokenSchema } from "@/lib/guests/guest-token";

export const rsvpInputSchema = z.object({
  guestToken: guestTokenSchema,
  name: z.string().trim().min(1).max(200),
  attending: z.boolean(),
  companions: z.number().int().min(0).max(10),
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
