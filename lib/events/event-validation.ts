import { z } from "zod";

export const eventIdSchema = z.string().uuid();

export const eventSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const eventDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  });

export const DEFAULT_EVENT_CLOSING_MESSAGE =
  "Obrigado por compartilhar este momento conosco!";

const optionalEventDateSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  eventDateSchema.nullable(),
);

const optionalOrganizerContactSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  },
  z.string().max(300).nullable(),
);

const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value ?? null,
  z.string().max(max).nullable(),
);

export const eventMapsUrlSchema = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value ?? null,
  z.url().max(2000).refine((value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Informe um link de mapa válido, começando com https:// ou http://.").nullable(),
);

export const createEventSchema = z.object({
  location: optionalText(500).default(null),
  mapsUrl: eventMapsUrlSchema.default(null),
  maxCompanions: z.preprocess(
    (value) => value === null || value === undefined || (typeof value === "string" && !value.trim())
      ? null : typeof value === "string" ? Number(value) : value,
    z.number().int().min(0).max(2147483647).nullable(),
  ).default(null),
  availabilityUntil: optionalEventDateSchema.default(null),
  closingMessage: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .default(DEFAULT_EVENT_CLOSING_MESSAGE),
  eventDate: eventDateSchema,
  isActive: z.boolean(),
  name: z.string().trim().min(1).max(200),
  organizerContact: optionalOrganizerContactSchema.default(null),
  slug: eventSlugSchema,
});

export type EventInput = z.infer<typeof createEventSchema>;

export function suggestEventSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}
