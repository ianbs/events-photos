import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { infrastructureError, notFoundError, validationError } from "@/lib/errors/application-error";
import { eventDateSchema } from "@/lib/events/event-validation";
import { createSignedPhotoUrls } from "@/lib/photos/signed-photo-urls";
import {
  getPhotoStorage,
  parseStorageProvider,
} from "@/lib/storage/photo-storage";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const photoIdSchema = z.string().uuid();
const SIGNED_URL_TTL_SECONDS = 5 * 60;
export const ADMIN_PHOTO_PAGE_SIZE = 24;

const adminPhotoSortSchema = z.enum(["newest", "oldest"]);
const photoCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export type AdminPhotoSort = z.infer<typeof adminPhotoSortSchema>;

export type AdminPhotoFilters = {
  cursor: string | null;
  eventId: string | null;
  fromDate: string | null;
  sort: AdminPhotoSort;
  toDate: string | null;
};

type AdminStoredPhoto = {
  created_at: string;
  event_id: string;
  file_size: number;
  id: string;
  mime_type: string;
  original_filename: string;
  storage_path: string;
  storage_provider: string;
};

export type AdminPhoto = {
  createdAt: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  fileSize: number;
  id: string;
  mimeType: string;
  originalFilename: string;
  signedUrl: string;
};

export type AdminPhotoPage = {
  nextCursor: string | null;
  photos: AdminPhoto[];
  totalCount: number;
};

export function normalizeAdminPhotoFilters(input: {
  cursor?: string;
  event?: string;
  from?: string;
  sort?: string;
  to?: string;
}): AdminPhotoFilters {
  return {
    cursor: input.cursor?.trim() || null,
    eventId: photoIdSchema.safeParse(input.event).success ? input.event! : null,
    fromDate: eventDateSchema.safeParse(input.from).success ? input.from! : null,
    sort: adminPhotoSortSchema.catch("newest").parse(input.sort),
    toDate: eventDateSchema.safeParse(input.to).success ? input.to! : null,
  };
}

function decodePhotoCursor(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return photoCursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}

function encodePhotoCursor(photo: AdminStoredPhoto): string {
  return Buffer.from(
    JSON.stringify({ createdAt: photo.created_at, id: photo.id }),
  ).toString("base64url");
}

function getExclusiveEndDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export async function listAdminPhotos(
  filters: AdminPhotoFilters = normalizeAdminPhotoFilters({}),
): Promise<AdminPhotoPage> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id,name,slug");
  const ascending = filters.sort === "oldest";
  const cursor = decodePhotoCursor(filters.cursor);
  let query = supabase
    .from("photos")
    .select(
      "id,event_id,storage_path,storage_provider,original_filename,mime_type,file_size,created_at",
    )
    .order("created_at", { ascending })
    .order("id", { ascending })
    .limit(ADMIN_PHOTO_PAGE_SIZE + 1);
  let countQuery = supabase
    .from("photos")
    .select("id", { count: "exact", head: true });

  if (filters.eventId) {
    query = query.eq("event_id", filters.eventId);
    countQuery = countQuery.eq("event_id", filters.eventId);
  }

  if (filters.fromDate) {
    query = query.gte("created_at", `${filters.fromDate}T00:00:00.000Z`);
    countQuery = countQuery.gte(
      "created_at",
      `${filters.fromDate}T00:00:00.000Z`,
    );
  }

  if (filters.toDate) {
    const exclusiveEndDate = getExclusiveEndDate(filters.toDate);
    query = query.lt("created_at", exclusiveEndDate);
    countQuery = countQuery.lt("created_at", exclusiveEndDate);
  }

  if (cursor) {
    const direction = ascending ? "gt" : "lt";
    query = query.or(
      `created_at.${direction}.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.${direction}.${cursor.id})`,
    );
  }

  const [
    { data, error },
    { count, error: countError },
  ] = await Promise.all([query, countQuery]);

  if (eventsError || error || countError) {
    throw infrastructureError();
  }

  const result = (data ?? []) as AdminStoredPhoto[];
  const hasNextPage = result.length > ADMIN_PHOTO_PAGE_SIZE;
  const photos = result.slice(0, ADMIN_PHOTO_PAGE_SIZE);

  const eventsById = new Map(
    (events ?? []).map((event) => [event.id, { name: event.name, slug: event.slug }]),
  );
  const urlsByPath = photos.length
    ? await createSignedPhotoUrls(
        photos.map((photo) => ({
      storagePath: photo.storage_path,
      storageProvider: parseStorageProvider(photo.storage_provider),
    })),
        SIGNED_URL_TTL_SECONDS,
      )
    : new Map<string, string>();

  const mappedPhotos = photos.map((photo) => {
    const event = eventsById.get(photo.event_id);
    const signedUrl = urlsByPath.get(photo.storage_path);

    if (!event || !signedUrl) {
      throw infrastructureError();
    }

    return {
      createdAt: photo.created_at,
      eventId: photo.event_id,
      eventName: event.name,
      eventSlug: event.slug,
      fileSize: photo.file_size,
      id: photo.id,
      mimeType: photo.mime_type,
      originalFilename: photo.original_filename,
      signedUrl,
    };
  });

  return {
    nextCursor: hasNextPage ? encodePhotoCursor(photos.at(-1)!) : null,
    photos: mappedPhotos,
    totalCount: count ?? 0,
  };
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
    .select("storage_path,storage_provider,original_filename")
    .eq("id", photoId)
    .maybeSingle();

  if (photoError) {
    throw infrastructureError();
  }

  if (!photo) {
    throw notFoundError("Foto não encontrada.");
  }

  return getPhotoStorage(parseStorageProvider(photo.storage_provider)).createReadUrl(
    photo.storage_path,
    60,
    download ? photo.original_filename : undefined,
  );
}

export async function deletePhotoAsAdmin(
  untrustedPhotoId: string,
): Promise<void> {
  await requireAdmin();
  const photoId = validatePhotoId(untrustedPhotoId);
  const supabase = createAdminSupabaseClient();
  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("storage_path,storage_provider")
    .eq("id", photoId)
    .maybeSingle();

  if (photoError) {
    throw infrastructureError();
  }

  if (!photo) {
    throw notFoundError("Foto não encontrada.");
  }

  await getPhotoStorage(parseStorageProvider(photo.storage_provider)).remove(
    photo.storage_path,
  );

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
