import "client-only";

import {
  brandingUploadInitializationResponseSchema,
  type UploadedBrandingAsset,
} from "@/lib/events/event-branding-contract";
import {
  EVENT_BRANDING_BUCKET,
  validateBrandingImage,
  type BrandingAssetType,
} from "@/lib/events/event-branding-policy";
import { apiErrorResponseSchema } from "@/lib/photos/upload-contract";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

async function readApiError(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    const result = apiErrorResponseSchema.safeParse(body);
    return result.success ? result.data.error.message : fallback;
  } catch {
    return fallback;
  }
}

export async function cleanupBrandingUploads(
  eventId: string,
  assets: UploadedBrandingAsset[],
): Promise<void> {
  await Promise.allSettled(
    assets.map((asset) =>
      fetch(`/api/admin/events/${eventId}/branding/uploads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset),
      }),
    ),
  );
}

export async function uploadBrandingAsset(
  eventId: string,
  assetType: BrandingAssetType,
  file: File,
): Promise<UploadedBrandingAsset> {
  const validation = validateBrandingImage(file);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const response = await fetch(
    `/api/admin/events/${eventId}/branding/uploads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType,
        fileSize: file.size,
        mimeType: validation.mimeType,
        originalFilename: file.name,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Não foi possível iniciar o upload."),
    );
  }

  const initialization = brandingUploadInitializationResponseSchema.parse(
    await response.json(),
  );
  const uploadedAsset: UploadedBrandingAsset = {
    assetType,
    fileSize: file.size,
    mimeType: validation.mimeType,
    path: initialization.path,
  };
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.storage
    .from(EVENT_BRANDING_BUCKET)
    .uploadToSignedUrl(initialization.path, initialization.token, file, {
      cacheControl: "3600",
      contentType: validation.mimeType,
      upsert: false,
    });

  if (error) {
    await cleanupBrandingUploads(eventId, [uploadedAsset]);
    throw new Error("Falha ao enviar a imagem. Tente novamente.");
  }

  return uploadedAsset;
}

export async function saveEventBranding(
  eventId: string,
  input: {
    accentColor: string;
    primaryColor: string;
    removeCover: boolean;
    removeLogo: boolean;
    uploadedAssets: UploadedBrandingAsset[];
  },
): Promise<void> {
  const response = await fetch(`/api/admin/events/${eventId}/branding`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Não foi possível salvar a identidade."),
    );
  }
}
