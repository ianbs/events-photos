import "server-only";

import { z } from "zod";

import { getServerEnvironment } from "@/lib/config/server-environment";
import {
  infrastructureError,
  notFoundError,
  validationError,
} from "@/lib/errors/application-error";
import { authorizeGuest, type AuthorizedGuest } from "@/lib/guests/guest-service";
import { imageSignatureMatchesMimeType } from "@/lib/photos/image-signature";
import {
  getExtensionForMimeType,
  isAllowedImageMimeType,
  normalizeOriginalFilename,
  PHOTO_BUCKET,
  validateImageUpload,
} from "@/lib/photos/upload-policy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { readPrivateStorageObjectHeader } from "@/lib/storage/private-storage";

const photoIdSchema = z.string().uuid();

export type PhotoUploadInput = {
  guestToken: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

function getMaximumUploadSizeBytes(): number {
  return getServerEnvironment().MAX_UPLOAD_SIZE_MB * 1024 * 1024;
}

function validateUploadInput(input: PhotoUploadInput) {
  const originalFilename = normalizeOriginalFilename(input.originalFilename);
  const result = validateImageUpload(
    {
      name: originalFilename,
      size: input.fileSize,
      type: input.mimeType,
    },
    getMaximumUploadSizeBytes(),
  );

  if (!result.valid) {
    throw validationError(result.message);
  }

  return { originalFilename, mimeType: result.mimeType };
}

function validatePhotoId(untrustedPhotoId: string): string {
  const result = photoIdSchema.safeParse(untrustedPhotoId);

  if (!result.success) {
    throw validationError("Identificador de upload inválido.");
  }

  return result.data;
}

function buildStoragePath(
  guest: AuthorizedGuest,
  photoId: string,
  mimeType: string,
): string {
  if (!isAllowedImageMimeType(mimeType)) {
    throw validationError("Formato de imagem não permitido.");
  }

  const extension = getExtensionForMimeType(mimeType);
  return `${guest.eventId}/${guest.guestId}/${photoId}.${extension}`;
}

async function removeStorageObject(path: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);

  if (error) {
    console.error("Failed to clean up a Storage object");
  }
}

export async function initializePhotoUpload(
  slug: string,
  input: PhotoUploadInput,
) {
  const validatedInput = validateUploadInput(input);
  const guest = await authorizeGuest(slug, input.guestToken);
  const photoId = crypto.randomUUID();
  const path = buildStoragePath(
    guest,
    photoId,
    validatedInput.mimeType,
  );
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });

  if (error || !data) {
    throw infrastructureError();
  }

  return { photoId, path, token: data.token };
}

export async function completePhotoUpload(
  slug: string,
  untrustedPhotoId: string,
  input: PhotoUploadInput,
) {
  const photoId = validatePhotoId(untrustedPhotoId);
  const validatedInput = validateUploadInput(input);
  const guest = await authorizeGuest(slug, input.guestToken);
  const path = buildStoragePath(
    guest,
    photoId,
    validatedInput.mimeType,
  );
  const supabase = createAdminSupabaseClient();
  const { data: existingPhoto, error: existingPhotoError } = await supabase
    .from("photos")
    .select("id")
    .eq("id", photoId)
    .eq("event_id", guest.eventId)
    .eq("guest_id", guest.guestId)
    .maybeSingle();

  if (existingPhotoError) {
    throw infrastructureError();
  }

  if (existingPhoto) {
    return { photoId: existingPhoto.id };
  }

  const { data: storedObject, error: storedObjectError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .info(path);

  if (storedObjectError || !storedObject) {
    throw notFoundError("O arquivo enviado não foi encontrado.");
  }

  const observedSize = storedObject.size ?? 0;
  const observedMimeType = storedObject.contentType ?? "";
  const observedValidation = validateImageUpload(
    {
      name: validatedInput.originalFilename,
      size: observedSize,
      type: observedMimeType,
    },
    getMaximumUploadSizeBytes(),
  );

  if (
    !observedValidation.valid ||
    observedValidation.mimeType !== validatedInput.mimeType ||
    observedSize !== input.fileSize
  ) {
    await removeStorageObject(path);
    throw validationError("O arquivo armazenado não corresponde ao upload autorizado.");
  }

  let fileHeader: Uint8Array;

  try {
    fileHeader = await readPrivateStorageObjectHeader(PHOTO_BUCKET, path);
  } catch {
    await removeStorageObject(path);
    throw infrastructureError();
  }

  if (!imageSignatureMatchesMimeType(fileHeader, observedValidation.mimeType)) {
    await removeStorageObject(path);
    throw validationError("O conteúdo do arquivo não corresponde a uma imagem permitida.");
  }

  const { error: insertError } = await supabase.from("photos").insert({
    id: photoId,
    event_id: guest.eventId,
    guest_id: guest.guestId,
    storage_path: path,
    original_filename: validatedInput.originalFilename,
    mime_type: observedValidation.mimeType,
    file_size: observedSize,
  });

  if (insertError) {
    await removeStorageObject(path);
    throw infrastructureError();
  }

  return { photoId };
}

export async function cleanupPhotoUpload(
  slug: string,
  untrustedPhotoId: string,
  guestToken: string,
  mimeType: string,
): Promise<void> {
  const photoId = validatePhotoId(untrustedPhotoId);
  const guest = await authorizeGuest(slug, guestToken);
  const path = buildStoragePath(guest, photoId, mimeType);

  await removeStorageObject(path);
}
