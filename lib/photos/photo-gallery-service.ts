import "server-only";

import { infrastructureError } from "@/lib/errors/application-error";
import { authorizeGuest } from "@/lib/guests/guest-service";
import type { PhotoGalleryItem } from "@/lib/photos/photo-gallery-contract";
import { createSignedPhotoUrls } from "@/lib/photos/signed-photo-urls";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const PHOTO_PAGE_SIZE = 500;

type StoredPhoto = {
  created_at: string;
  file_size: number;
  id: string;
  mime_type: string;
  original_filename: string;
  storage_path: string;
};

async function signPhotos(photos: StoredPhoto[]): Promise<PhotoGalleryItem[]> {
  if (photos.length === 0) {
    return [];
  }

  const urlsByPath = await createSignedPhotoUrls(
    photos.map((photo) => photo.storage_path),
    SIGNED_URL_TTL_SECONDS,
  );

  return photos.map((photo) => {
    const signedUrl = urlsByPath.get(photo.storage_path);

    if (!signedUrl) {
      throw infrastructureError();
    }

    return {
      createdAt: photo.created_at,
      fileSize: photo.file_size,
      id: photo.id,
      mimeType: photo.mime_type,
      originalFilename: photo.original_filename,
      signedUrl,
    };
  });
}

export async function listGuestPhotos(
  slug: string,
  guestToken: string,
): Promise<PhotoGalleryItem[]> {
  const guest = await authorizeGuest(slug, guestToken);
  const supabase = createAdminSupabaseClient();
  const photos: StoredPhoto[] = [];
  let cursor: string | null = null;

  do {
    let query = supabase
      .from("photos")
      .select(
        "id,storage_path,original_filename,mime_type,file_size,created_at",
      )
      .eq("event_id", guest.eventId)
      .eq("guest_id", guest.guestId)
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

  photos.sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );

  return signPhotos(photos);
}
