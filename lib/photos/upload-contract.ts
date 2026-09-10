import { z } from "zod";

import { guestTokenSchema } from "@/lib/guests/guest-token";

export const initializeUploadRequestSchema = z.object({
  guestToken: guestTokenSchema,
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
});

const storageProviderSchema = z.enum(["supabase", "s3"]);

export const completeUploadRequestSchema = initializeUploadRequestSchema.extend({
  storageProvider: storageProviderSchema,
});

export const cleanupUploadRequestSchema = z.object({
  guestToken: guestTokenSchema,
  mimeType: z.string().min(1).max(100),
  storageProvider: storageProviderSchema,
});

export const uploadInitializationResponseSchema = z.discriminatedUnion(
  "provider",
  [
    z.object({
      photoId: z.string().uuid(),
      path: z.string().min(1),
      provider: z.literal("supabase"),
      token: z.string().min(1),
    }),
    z.object({
      photoId: z.string().uuid(),
      path: z.string().min(1),
      provider: z.literal("s3"),
      uploadUrl: z.string().url(),
    }),
  ],
);

export const uploadCompletionResponseSchema = z.object({
  photoId: z.string().uuid(),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
