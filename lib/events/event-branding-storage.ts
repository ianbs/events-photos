import "server-only";

import {
  infrastructureError,
  notFoundError,
  validationError,
} from "@/lib/errors/application-error";
import type { UploadedBrandingAsset } from "@/lib/events/event-branding-contract";
import {
  EVENT_BRANDING_BUCKET,
  getBrandingExtension,
  validateBrandingImage,
  type BrandingAssetType,
  type BrandingImageMimeType,
} from "@/lib/events/event-branding-policy";
import { eventIdSchema } from "@/lib/events/event-validation";
import { imageSignatureMatchesMimeType } from "@/lib/photos/image-signature";
import { readPrivateStorageObjectHeader } from "@/lib/storage/private-storage";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const BRANDING_URL_TTL_SECONDS = 60 * 60;

export type EventBrandingUrls = {
  coverImageUrl: string | null;
  logoImageUrl: string | null;
};

export function validateBrandingAssetPath(
  eventId: string,
  asset: UploadedBrandingAsset,
  mimeType: BrandingImageMimeType,
): void {
  const [pathEventId, pathAssetType, filename, extraSegment] =
    asset.path.split("/");
  const [fileId, extension, extraExtension] = (filename ?? "").split(".");

  if (
    extraSegment !== undefined ||
    extraExtension !== undefined ||
    pathEventId !== eventId ||
    pathAssetType !== asset.assetType ||
    !eventIdSchema.safeParse(fileId).success ||
    extension !== getBrandingExtension(mimeType)
  ) {
    throw validationError("Caminho da imagem de identidade inválido.");
  }
}

export async function removeBrandingObjectsBestEffort(
  paths: string[],
): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));

  if (uniquePaths.length === 0) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.storage
    .from(EVENT_BRANDING_BUCKET)
    .remove(uniquePaths);

  if (error) {
    console.error("Failed to clean up event branding objects");
  }
}

export async function initializeBrandingStorageUpload(
  eventId: string,
  assetType: BrandingAssetType,
  mimeType: BrandingImageMimeType,
) {
  const extension = getBrandingExtension(mimeType);
  const path = `${eventId}/${assetType}/${crypto.randomUUID()}.${extension}`;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(EVENT_BRANDING_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });

  if (error || !data) {
    throw infrastructureError();
  }

  return { path, token: data.token };
}

export async function verifyBrandingAsset(
  eventId: string,
  asset: UploadedBrandingAsset,
): Promise<void> {
  const validation = validateBrandingImage({
    name: asset.path,
    size: asset.fileSize,
    type: asset.mimeType,
  });

  if (!validation.valid) {
    throw validationError(validation.message);
  }

  validateBrandingAssetPath(eventId, asset, validation.mimeType);
  const supabase = createAdminSupabaseClient();
  const { data: storedObject, error } = await supabase.storage
    .from(EVENT_BRANDING_BUCKET)
    .info(asset.path);

  if (error || !storedObject) {
    throw notFoundError("A imagem enviada não foi encontrada.");
  }

  if (
    storedObject.size !== asset.fileSize ||
    storedObject.contentType !== validation.mimeType
  ) {
    throw validationError("A imagem armazenada não corresponde ao upload.");
  }

  const header = await readPrivateStorageObjectHeader(
    EVENT_BRANDING_BUCKET,
    asset.path,
  );

  if (!imageSignatureMatchesMimeType(header, validation.mimeType)) {
    throw validationError("O arquivo enviado não contém uma imagem válida.");
  }
}

export async function createEventBrandingUrls(
  coverPath: string | null,
  logoPath: string | null,
): Promise<EventBrandingUrls> {
  const paths = [coverPath, logoPath].filter(
    (path): path is string => Boolean(path),
  );

  if (paths.length === 0) {
    return { coverImageUrl: null, logoImageUrl: null };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(EVENT_BRANDING_BUCKET)
    .createSignedUrls(paths, BRANDING_URL_TTL_SECONDS);

  if (error || !data) {
    throw infrastructureError();
  }

  const urls = new Map(
    data.flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [],
    ),
  );
  const coverImageUrl = coverPath ? urls.get(coverPath) : null;
  const logoImageUrl = logoPath ? urls.get(logoPath) : null;

  if ((coverPath && !coverImageUrl) || (logoPath && !logoImageUrl)) {
    throw infrastructureError();
  }

  return {
    coverImageUrl: coverImageUrl ?? null,
    logoImageUrl: logoImageUrl ?? null,
  };
}
