import { z } from "zod";

export const EVENT_BRANDING_BUCKET = "event-branding";
export const MAX_BRANDING_IMAGE_SIZE_MB = 5;
export const MAX_BRANDING_IMAGE_SIZE_BYTES =
  MAX_BRANDING_IMAGE_SIZE_MB * 1024 * 1024;

export const BRANDING_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const brandingAssetTypeSchema = z.enum(["cover", "logo"]);
export const brandingColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/);
export const eventBrandingColorsSchema = z.object({
  accentColor: brandingColorSchema,
  primaryColor: brandingColorSchema,
});

export type BrandingAssetType = z.infer<typeof brandingAssetTypeSchema>;
export type BrandingImageMimeType = (typeof BRANDING_IMAGE_MIME_TYPES)[number];

const extensionByMimeType: Record<BrandingImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type BrandingImageCandidate = {
  name: string;
  size: number;
  type: string;
};

export type BrandingImageValidationResult =
  | { mimeType: BrandingImageMimeType; valid: true }
  | { message: string; valid: false };

export function isBrandingImageMimeType(
  value: string,
): value is BrandingImageMimeType {
  return BRANDING_IMAGE_MIME_TYPES.some((mimeType) => mimeType === value);
}

export function validateBrandingImage(
  candidate: BrandingImageCandidate,
): BrandingImageValidationResult {
  if (!candidate.name.trim()) {
    return { message: "O arquivo precisa ter um nome.", valid: false };
  }

  if (!isBrandingImageMimeType(candidate.type)) {
    return {
      message: "Use uma imagem JPEG, PNG ou WebP.",
      valid: false,
    };
  }

  if (!Number.isSafeInteger(candidate.size) || candidate.size <= 0) {
    return { message: "O arquivo está vazio ou é inválido.", valid: false };
  }

  if (candidate.size > MAX_BRANDING_IMAGE_SIZE_BYTES) {
    return {
      message: `A imagem deve ter no máximo ${MAX_BRANDING_IMAGE_SIZE_MB} MB.`,
      valid: false,
    };
  }

  return { mimeType: candidate.type, valid: true };
}

export function getBrandingExtension(
  mimeType: BrandingImageMimeType,
): string {
  return extensionByMimeType[mimeType];
}
