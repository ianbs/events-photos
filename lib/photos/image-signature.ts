import type { AllowedImageMimeType } from "@/lib/photos/upload-policy";

type DetectedImageFormat = "jpeg" | "png" | "webp" | "heif";

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  return Array.from(value).every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );
}

export function detectImageFormat(
  bytes: Uint8Array,
): DetectedImageFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) {
    return "webp";
  }

  if (asciiAt(bytes, 4, "ftyp")) {
    const header = new TextDecoder("ascii").decode(bytes).toLowerCase();
    const compatibleBrands = ["heic", "heix", "hevc", "hevx", "mif1", "msf1"];

    if (compatibleBrands.some((brand) => header.includes(brand))) {
      return "heif";
    }
  }

  return null;
}

export function imageSignatureMatchesMimeType(
  bytes: Uint8Array,
  mimeType: AllowedImageMimeType,
): boolean {
  const detectedFormat = detectImageFormat(bytes);

  if (mimeType === "image/heic" || mimeType === "image/heif") {
    return detectedFormat === "heif";
  }

  return (
    (mimeType === "image/jpeg" && detectedFormat === "jpeg") ||
    (mimeType === "image/png" && detectedFormat === "png") ||
    (mimeType === "image/webp" && detectedFormat === "webp")
  );
}
