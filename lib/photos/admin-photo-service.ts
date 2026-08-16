import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { infrastructureError, notFoundError, validationError } from "@/lib/errors/application-error";
import { PHOTO_BUCKET } from "@/lib/photos/upload-policy";
import { createSignedPhotoUrls } from "@/lib/photos/signed-photo-urls";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const photoIdSchema = z.string().uuid();
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const PHOTO_PAGE_SIZE = 500;

type AdminStoredPhoto = {
  created_at: string;
  event_id: string;
  file_size: number;
  id: string;
  mime_type: string;
  original_filename: string;
  storage_path: string;
};

export type AdminPhoto = {
  createdAt: string;
  eventName: string;
  eventSlug: string;
  fileSize: number;
  id: string;
  mimeType: string;
  originalFilename: string;
  signedUrl: string;
};

export async function listAdminPhotos(): Promise<AdminPhoto[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id,name,slug");
  const photos: AdminStoredPhoto[] = [];
  let cursor: string | null = null;

  do {
    let query = supabase
      .from("photos")
      .select(
        "id,event_id,storage_path,original_filename,mime_type,file_size,created_at",
      )
      .order("id", { ascending: false })
      .limit(PHOTO_PAGE_SIZE);

    if (cursor) {
      query = query.lt("id", cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw infrastructureError();
    }

    const page = data ?? [];
    photos.push(...page);
    cursor = page.length === PHOTO_PAGE_SIZE ? page.at(-1)?.id ?? null : null;
  } while (cursor);

  if (eventsError) {
    throw infrastructureError();
  }

  if (photos.length === 0) {
    return [];
  }

  photos.sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );

  const eventsById = new Map(
    (events ?? []).map((event) => [event.id, { name: event.name, slug: event.slug }]),
  );
  const urlsByPath = await createSignedPhotoUrls(
    photos.map((photo) => photo.storage_path),
    SIGNED_URL_TTL_SECONDS,
  );

  return photos.map((photo) => {
    const event = eventsById.get(photo.event_id);
    const signedUrl = urlsByPath.get(photo.storage_path);

    if (!event || !signedUrl) {
      throw infrastructureError();
    }

    return {
      createdAt: photo.created_at,
      eventName: event.name,
      eventSlug: event.slug,
      fileSize: photo.file_size,
      id: photo.id,
      mimeType: photo.mime_type,
      originalFilename: photo.original_filename,
      signedUrl,
    };
  });
}

function validatePhotoId(untrustedPhotoId: string): string {
  const result = photoIdSchema.safeParse(untrustedPhotoId);

  if (!result.success) {
    throw validationError("Identificador da foto inválido.");
  }

  return result.data;
}

export async function createAdminPhotoUrl(
  untrustedPhotoId: string,
  download: boolean,
): Promise<string> {
  await requireAdmin();
  const photoId = validatePhotoId(untrustedPhotoId);
  const supabase = createAdminSupabaseClient();
  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("storage_path,original_filename")
    .eq("id", photoId)
    .maybeSingle();

  if (photoError) {
    throw infrastructureError();
  }

  if (!photo) {
    throw notFoundError("Foto não encontrada.");
  }

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(photo.storage_path, 60, {
      download: download ? photo.original_filename : false,
    });

  if (error || !data) {
    throw infrastructureError();
  }

  return data.signedUrl;
}

export async function deletePhotoAsAdmin(
  untrustedPhotoId: string,
): Promise<void> {
  await requireAdmin();
  const photoId = validatePhotoId(untrustedPhotoId);
  const supabase = createAdminSupabaseClient();
  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", photoId)
    .maybeSingle();

  if (photoError) {
    throw infrastructureError();
  }

  if (!photo) {
    throw notFoundError("Foto não encontrada.");
  }

  const { error: storageError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([photo.storage_path]);

  if (storageError) {
    throw infrastructureError();
  }

  const { error: databaseError } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId);

  if (databaseError) {
    // Retrying is safe: removing an already absent object is idempotent, then
    // the remaining database record can be deleted.
    throw infrastructureError();
  }
}
