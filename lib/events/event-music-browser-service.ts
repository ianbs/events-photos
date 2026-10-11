import "client-only";

import { EVENT_MUSIC_BUCKET, musicUploadResponseSchema, validateMusicFile, type UploadedMusic } from "@/lib/events/event-music-contract";
import { apiErrorResponseSchema } from "@/lib/photos/upload-contract";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

async function readApiError(response: Response, fallback: string) {
  try {
    const parsed = apiErrorResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error.message : fallback;
  } catch { return fallback; }
}

export async function cleanupMusicUpload(eventId: string, asset: UploadedMusic) {
  try {
    await fetch(`/api/admin/events/${eventId}/music/uploads`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(asset),
    });
  } catch { /* Cleanup is best effort; the current saved music is protected server-side. */ }
}

export async function uploadEventMusic(eventId: string, file: File): Promise<UploadedMusic> {
  const validated = validateMusicFile(file);
  if (!validated.success) throw new Error("Envie um arquivo MP3 de até 15 MB.");
  const response = await fetch(`/api/admin/events/${eventId}/music/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated.data),
  });
  if (!response.ok) throw new Error(await readApiError(response, "Não foi possível iniciar o upload."));
  const { path, token } = musicUploadResponseSchema.parse(await response.json());
  const asset: UploadedMusic = { path, fileSize: file.size, mimeType: "audio/mpeg" };
  try {
    const { error } = await createBrowserSupabaseClient().storage.from(EVENT_MUSIC_BUCKET)
      .uploadToSignedUrl(path, token, file, { contentType: "audio/mpeg", upsert: false, cacheControl: "3600" });
    if (error) throw new Error("Falha ao enviar a música. Tente novamente.");
    return asset;
  } catch (error) {
    await cleanupMusicUpload(eventId, asset);
    throw error;
  }
}

export async function persistEventMusic(eventId: string, uploadedMusic: UploadedMusic | null, removeMusic: boolean) {
  const response = await fetch(`/api/admin/events/${eventId}/music`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadedMusic, removeMusic }),
  });
  if (!response.ok) throw new Error(await readApiError(response, "Não foi possível salvar a música."));
}
