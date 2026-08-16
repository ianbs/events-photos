import { z } from "zod";

import { guestTokenSchema } from "@/lib/guests/guest-token";

export const initializeUploadRequestSchema = z.object({
  guestToken: guestTokenSchema,
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
});

export const completeUploadRequestSchema = initializeUploadRequestSchema;

export const cleanupUploadRequestSchema = z.object({
  guestToken: guestTokenSchema,
  mimeType: z.string().min(1).max(100),
});

export const uploadInitializationResponseSchema = z.object({
  photoId: z.string().uuid(),
  path: z.string().min(1),
  token: z.string().min(1),
});

export const uploadCompletionResponseSchema = z.object({
  photoId: z.string().uuid(),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
