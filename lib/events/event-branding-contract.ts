import { z } from "zod";

import {
  brandingAssetTypeSchema,
  brandingColorSchema,
} from "@/lib/events/event-branding-policy";

export const brandingUploadInputSchema = z.object({
  assetType: brandingAssetTypeSchema,
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
  originalFilename: z.string().min(1).max(255),
});

export const brandingUploadInitializationResponseSchema = z.object({
  path: z.string().min(1),
  token: z.string().min(1),
});

export const uploadedBrandingAssetSchema = z.object({
  assetType: brandingAssetTypeSchema,
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
  path: z.string().min(1).max(1024),
});

export const cleanupBrandingUploadSchema = uploadedBrandingAssetSchema;

export const finalizeEventBrandingSchema = z.object({
  accentColor: brandingColorSchema,
  primaryColor: brandingColorSchema,
  removeCover: z.boolean(),
  removeLogo: z.boolean(),
  uploadedAssets: z.array(uploadedBrandingAssetSchema).max(2),
});

export type BrandingUploadInput = z.infer<typeof brandingUploadInputSchema>;
export type FinalizeEventBrandingInput = z.infer<
  typeof finalizeEventBrandingSchema
>;
export type UploadedBrandingAsset = z.infer<
  typeof uploadedBrandingAssetSchema
>;
