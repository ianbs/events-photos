import "server-only";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import {
  infrastructureError,
  notFoundError,
  validationError,
} from "@/lib/errors/application-error";
import {
  brandingUploadInputSchema,
  cleanupBrandingUploadSchema,
  finalizeEventBrandingSchema,
} from "@/lib/events/event-branding-contract";
import {
  isBrandingImageMimeType,
  validateBrandingImage,
} from "@/lib/events/event-branding-policy";
import {
  initializeBrandingStorageUpload,
  removeBrandingObjectsBestEffort,
  validateBrandingAssetPath,
  verifyBrandingAsset,
} from "@/lib/events/event-branding-storage";
import { eventIdSchema } from "@/lib/events/event-validation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type EventBrandingUpdate =
  Database["public"]["Tables"]["events"]["Update"];

type StoredEventBranding = {
  accent_color: string;
  cover_storage_path: string | null;
  logo_storage_path: string | null;
  primary_color: string;
};

function validateEventId(untrustedEventId: string): string {
  const eventId = eventIdSchema.safeParse(untrustedEventId);

  if (!eventId.success) {
    throw notFoundError("Evento não encontrado.");
  }

  return eventId.data;
}

async function findStoredBranding(
  eventId: string,
): Promise<StoredEventBranding> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "primary_color,accent_color,cover_storage_path,logo_storage_path",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw infrastructureError();
  }

  if (!data) {
    throw notFoundError("Evento não encontrado.");
  }

  return data;
}

export async function initializeEventBrandingUpload(
  untrustedEventId: string,
  untrustedInput: unknown,
) {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  const input = brandingUploadInputSchema.safeParse(untrustedInput);

  if (!input.success) {
    throw validationError("Dados do upload de identidade inválidos.");
  }

  const validation = validateBrandingImage({
    name: input.data.originalFilename,
    size: input.data.fileSize,
    type: input.data.mimeType,
  });

  if (!validation.valid) {
    throw validationError(validation.message);
  }

  await findStoredBranding(eventId);
  return initializeBrandingStorageUpload(
    eventId,
    input.data.assetType,
    validation.mimeType,
  );
}

export async function finalizeEventBranding(
  untrustedEventId: string,
  untrustedInput: unknown,
): Promise<void> {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  const input = finalizeEventBrandingSchema.safeParse(untrustedInput);

  if (!input.success) {
    throw validationError("Dados da identidade visual inválidos.");
  }

  const assetsByType = new Map(
    input.data.uploadedAssets.map((asset) => [asset.assetType, asset]),
  );

  if (assetsByType.size !== input.data.uploadedAssets.length) {
    throw validationError("Envie no máximo uma imagem de cada tipo.");
  }

  const newPaths = input.data.uploadedAssets.map((asset) => asset.path);
  let current: StoredEventBranding;

  try {
    current = await findStoredBranding(eventId);
    for (const asset of input.data.uploadedAssets) {
      await verifyBrandingAsset(eventId, asset);
    }
  } catch (error) {
    await removeBrandingObjectsBestEffort(newPaths);
    throw error;
  }

  const cover = assetsByType.get("cover");
  const logo = assetsByType.get("logo");
  const update: EventBrandingUpdate = {
    accent_color: input.data.accentColor,
    primary_color: input.data.primaryColor,
  };

  if (cover) {
    update.cover_storage_path = cover.path;
  } else if (input.data.removeCover) {
    update.cover_storage_path = null;
  }

  if (logo) {
    update.logo_storage_path = logo.path;
  } else if (input.data.removeLogo) {
    update.logo_storage_path = null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .update(update)
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    await removeBrandingObjectsBestEffort(newPaths);
    throw infrastructureError();
  }

  const oldPaths = [
    ...(cover || input.data.removeCover
      ? [current.cover_storage_path]
      : []),
    ...(logo || input.data.removeLogo ? [current.logo_storage_path] : []),
  ].filter((path): path is string => Boolean(path));

  await removeBrandingObjectsBestEffort(oldPaths);
}

export async function cleanupEventBrandingUpload(
  untrustedEventId: string,
  untrustedAsset: unknown,
): Promise<void> {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  const asset = cleanupBrandingUploadSchema.safeParse(untrustedAsset);

  if (!asset.success || !isBrandingImageMimeType(asset.data.mimeType)) {
    throw validationError("Dados de limpeza inválidos.");
  }

  validateBrandingAssetPath(eventId, asset.data, asset.data.mimeType);
  await removeBrandingObjectsBestEffort([asset.data.path]);
}
