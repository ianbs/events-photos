import { z } from "zod";

import { guestTokenSchema } from "@/lib/guests/guest-token";

export const guestGalleryRequestSchema = z.object({
  guestToken: guestTokenSchema,
});

export const photoGalleryItemSchema = z.object({
  createdAt: z.string(),
  fileSize: z.number().int().positive(),
  id: z.string().uuid(),
  mimeType: z.string(),
  originalFilename: z.string(),
  signedUrl: z.string().url(),
});

export const guestGalleryResponseSchema = z.object({
  photos: z.array(photoGalleryItemSchema),
});

export type PhotoGalleryItem = z.infer<typeof photoGalleryItemSchema>;
