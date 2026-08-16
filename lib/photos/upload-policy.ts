export const PHOTO_BUCKET = "event-photos";
export const MAX_UPLOAD_SIZE_MB = 15;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const extensionByMimeType: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export type ImageUploadCandidate = {
  name: string;
  size: number;
  type: string;
};

export type ImageValidationResult =
  | { valid: true; mimeType: AllowedImageMimeType }
  | { valid: false; message: string };

export function isAllowedImageMimeType(
  value: string,
): value is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPES.some((mimeType) => mimeType === value);
}

export function validateImageUpload(
  candidate: ImageUploadCandidate,
  maximumSizeBytes = MAX_UPLOAD_SIZE_BYTES,
): ImageValidationResult {
  if (!candidate.name.trim()) {
    return { valid: false, message: "O arquivo precisa ter um nome." };
  }

  if (!isAllowedImageMimeType(candidate.type)) {
    return { valid: false, message: "Formato de imagem não permitido." };
  }

  if (!Number.isSafeInteger(candidate.size) || candidate.size <= 0) {
    return { valid: false, message: "O arquivo está vazio ou é inválido." };
  }

  if (candidate.size > maximumSizeBytes) {
    const maximumSizeMb = Math.floor(maximumSizeBytes / 1024 / 1024);
    return {
      valid: false,
      message: `A imagem deve ter no máximo ${maximumSizeMb} MB.`,
    };
  }

  return { valid: true, mimeType: candidate.type };
}

export function getExtensionForMimeType(
  mimeType: AllowedImageMimeType,
): string {
  return extensionByMimeType[mimeType];
}

export function normalizeOriginalFilename(filename: string): string {
  return filename
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .trim()
    .slice(0, 255);
}
