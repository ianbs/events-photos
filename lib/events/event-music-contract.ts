import { z } from "zod";

export const EVENT_MUSIC_BUCKET = "event-music";
export const MAX_EVENT_MUSIC_BYTES = 15 * 1024 * 1024;

export const musicUploadInputSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255).regex(/\.mp3$/i),
  fileSize: z.number().int().min(1).max(MAX_EVENT_MUSIC_BYTES),
  mimeType: z.literal("audio/mpeg"),
});

export const uploadedMusicSchema = musicUploadInputSchema
  .omit({ originalFilename: true })
  .extend({ path: z.string().min(1).max(1024) });

export const musicUploadResponseSchema = z.object({
  path: z.string().min(1).max(1024),
  token: z.string().min(1),
});

export const saveEventMusicSchema = z.object({
  uploadedMusic: uploadedMusicSchema.nullable(),
  removeMusic: z.boolean(),
}).refine((input) => Boolean(input.uploadedMusic) !== input.removeMusic);

export type UploadedMusic = z.infer<typeof uploadedMusicSchema>;

export function validateMusicFile(file: Pick<File, "name" | "size" | "type">) {
  // Some devices leave the MIME type empty when picking an MP3.
  return musicUploadInputSchema.safeParse({
    originalFilename: file.name,
    fileSize: file.size,
    mimeType: file.type === "" || file.type === "audio/mp3" ? "audio/mpeg" : file.type,
  });
}

export function hasMp3Signature(header: Uint8Array, fileSize: number): boolean {
  if (header.length >= 10 && header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
    const version = header[3];
    const sizeBytes = header.slice(6, 10);
    if (version < 2 || version > 4 || header[4] === 0xff || sizeBytes.some((byte) => byte >= 128)) return false;
    const tagSize = sizeBytes.reduce((size, byte) => size * 128 + byte, 0);
    return fileSize > tagSize + 10;
  }
  // MPEG audio frame: valid version, Layer III, bitrate and sampling rate.
  return header.length >= 4 && header[0] === 0xff &&
    (header[1] & 0xe0) === 0xe0 && (header[1] & 0x18) !== 0x08 &&
    (header[1] & 0x06) === 0x02 && (header[2] & 0xf0) !== 0 &&
    (header[2] & 0xf0) !== 0xf0 && (header[2] & 0x0c) !== 0x0c;
}
