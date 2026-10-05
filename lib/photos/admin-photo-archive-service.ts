import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import {
  infrastructureError,
  notFoundError,
  validationError,
} from "@/lib/errors/application-error";
import { eventIdSchema } from "@/lib/events/event-validation";
import { createStoredZipStream } from "@/lib/photos/photo-zip";
import { PHOTO_BUCKET } from "@/lib/photos/upload-policy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const selectedPhotoIdsSchema = z.array(z.string().uuid()).min(1).max(100);
const ARCHIVE_QUERY_PAGE_SIZE = 500;
const MAX_ARCHIVE_SIZE_BYTES = 3_500_000_000;

type ArchivePhoto = {
  created_at: string;
  file_size: number;
  id: string;
  original_filename: string;
  storage_path: string;
};

export type AdminPhotoArchive = {
  fileName: string;
  stream: ReadableStream<Uint8Array>;
};

function sanitizeArchiveEntryName(value: string): string {
  const sanitized = value
    .normalize("NFC")
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .trim();

  return (sanitized || "foto").slice(0, 180);
}

function validateArchiveSize(photos: ArchivePhoto[]) {
  const totalSize = photos.reduce((sum, photo) => sum + photo.file_size, 0);

  if (totalSize > MAX_ARCHIVE_SIZE_BYTES) {
    throw validationError(
      "O acervo é grande demais para um único ZIP. Use os filtros e baixe em partes.",
    );
  }
}

function createArchive(
  fileName: string,
  photos: ArchivePhoto[],
  download: (path: string) => Promise<Blob>,
): AdminPhotoArchive {
  validateArchiveSize(photos);

  const digits = Math.max(3, String(photos.length).length);
  const entries = photos.map((photo, index) => ({
    fileName: `${String(index + 1).padStart(digits, "0")}-${sanitizeArchiveEntryName(photo.original_filename)}`,
    getData: () => download(photo.storage_path),
    modifiedAt: new Date(photo.created_at),
  }));

  return { fileName, stream: createStoredZipStream(entries) };
}

async function downloadPrivatePhoto(
  path: string,
  supabase: ReturnType<typeof createAdminSupabaseClient>,
) {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);

  if (error || !data) {
    throw infrastructureError();
  }

  return data;
}

export async function createEventPhotoArchive(
  untrustedEventId: string,
): Promise<AdminPhotoArchive> {
  await requireAdmin();
  const parsedEventId = eventIdSchema.safeParse(untrustedEventId);

  if (!parsedEventId.success) {
    throw notFoundError("Evento não encontrado.");
  }

  const supabase = createAdminSupabaseClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,slug")
    .eq("id", parsedEventId.data)
    .maybeSingle();

  if (eventError) {
    throw infrastructureError();
  }

  if (!event) {
    throw notFoundError("Evento não encontrado.");
  }

  const photos: ArchivePhoto[] = [];
  let cursor: string | null = null;

  do {
    let query = supabase
      .from("photos")
      .select("id,storage_path,original_filename,file_size,created_at")
      .eq("event_id", event.id)
      .order("id", { ascending: true })
      .limit(ARCHIVE_QUERY_PAGE_SIZE);

    if (cursor) {
      query = query.gt("id", cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw infrastructureError();
    }

    const page = (data ?? []) as ArchivePhoto[];
    photos.push(...page);
    cursor = page.length === ARCHIVE_QUERY_PAGE_SIZE ? page.at(-1)?.id ?? null : null;
  } while (cursor);

  if (photos.length === 0) {
    throw validationError("Este evento ainda não possui fotos para baixar.");
  }

  return createArchive(
    `fotos-${event.slug}.zip`,
    photos,
    (path) => downloadPrivatePhoto(path, supabase),
  );
}

export async function createSelectedPhotoArchive(
  untrustedPhotoIds: unknown,
): Promise<AdminPhotoArchive> {
  await requireAdmin();
  const parsedPhotoIds = selectedPhotoIdsSchema.safeParse(untrustedPhotoIds);

  if (!parsedPhotoIds.success) {
    throw validationError("Selecione entre 1 e 100 fotos válidas.");
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("photos")
    .select("id,storage_path,original_filename,file_size,created_at")
    .in("id", parsedPhotoIds.data)
    .order("created_at", { ascending: false });

  if (error) {
    throw infrastructureError();
  }

  const photos = (data ?? []) as ArchivePhoto[];
  if (photos.length !== new Set(parsedPhotoIds.data).size) {
    throw notFoundError("Uma ou mais fotos selecionadas não foram encontradas.");
  }

  return createArchive(
    "fotos-selecionadas.zip",
    photos,
    (path) => downloadPrivatePhoto(path, supabase),
  );
}
