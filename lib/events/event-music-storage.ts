import "server-only";

import { infrastructureError, validationError } from "@/lib/errors/application-error";
import { EVENT_MUSIC_BUCKET, hasMp3Signature, type UploadedMusic } from "@/lib/events/event-music-contract";
import { eventIdSchema } from "@/lib/events/event-validation";
import { readPrivateStorageObjectHeader } from "@/lib/storage/private-storage";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export function validateMusicPath(eventId: string, path: string): void {
  const [ownerId, filename, extra] = path.split("/");
  const [fileId, extension, extraExtension] = (filename ?? "").split(".");
  if (ownerId !== eventId || extra !== undefined || extraExtension !== undefined ||
    extension !== "mp3" || !eventIdSchema.safeParse(fileId).success) {
    throw validationError("Caminho da música inválido.");
  }
}

export async function initializeMusicStorageUpload(eventId: string) {
  const path = `${eventId}/${crypto.randomUUID()}.mp3`;
  const { data, error } = await createAdminSupabaseClient().storage
    .from(EVENT_MUSIC_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw infrastructureError();
  return { path, token: data.token };
}

export async function verifyUploadedMusic(eventId: string, asset: UploadedMusic) {
  validateMusicPath(eventId, asset.path);
  const { data, error } = await createAdminSupabaseClient().storage
    .from(EVENT_MUSIC_BUCKET).info(asset.path);
  if (error || !data || data.size !== asset.fileSize || data.contentType !== asset.mimeType) {
    throw validationError("O áudio armazenado não corresponde ao upload.");
  }
  const header = await readPrivateStorageObjectHeader(EVENT_MUSIC_BUCKET, asset.path);
  if (!hasMp3Signature(header, asset.fileSize)) {
    throw validationError("O arquivo enviado não contém um MP3 válido.");
  }
}

export async function removeMusicObjectBestEffort(path: string) {
  try {
    const { error } = await createAdminSupabaseClient().storage.from(EVENT_MUSIC_BUCKET).remove([path]);
    if (error) console.error("Failed to clean up event music");
  } catch {
    console.error("Failed to clean up event music");
  }
}

export async function createEventMusicUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  // Audio is optional: a Storage outage must not block the invitation or RSVP.
  try {
    const { data, error } = await createAdminSupabaseClient().storage
      .from(EVENT_MUSIC_BUCKET).createSignedUrl(path, 60 * 60);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    // Keep the event accessible when signing fails.
  }
  console.error("Failed to sign event music URL");
  return null;
}
