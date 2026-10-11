import { describe, expect, it } from "vitest";
import { hasMp3Signature, MAX_EVENT_MUSIC_BYTES, saveEventMusicSchema, validateMusicFile } from "./event-music-contract";

describe("event music validation", () => {
  it("accepts MP3 picks with standard, alternative or missing MIME types", () => {
    for (const type of ["audio/mpeg", "audio/mp3", ""]) {
      const result = validateMusicFile({ name: "Festa.MP3", size: 1024, type });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.mimeType).toBe("audio/mpeg");
    }
  });
  it("rejects other formats, empty files and oversized uploads", () => {
    for (const file of [
      { name: "musica.wav", size: 1024, type: "audio/mpeg" },
      { name: "musica.mp3", size: 1024, type: "text/html" },
      { name: "musica.mp3", size: 0, type: "audio/mpeg" },
      { name: "musica.mp3", size: MAX_EVENT_MUSIC_BYTES + 1, type: "audio/mpeg" },
    ]) expect(validateMusicFile(file).success).toBe(false);
  });
  it("requires exactly one of uploading or removing music", () => {
    const asset = { path: "event/track.mp3", fileSize: 200, mimeType: "audio/mpeg" };
    expect(saveEventMusicSchema.safeParse({ uploadedMusic: null, removeMusic: true }).success).toBe(true);
    expect(saveEventMusicSchema.safeParse({ uploadedMusic: asset, removeMusic: false }).success).toBe(true);
    expect(saveEventMusicSchema.safeParse({ uploadedMusic: asset, removeMusic: true }).success).toBe(false);
    expect(saveEventMusicSchema.safeParse({ uploadedMusic: null, removeMusic: false }).success).toBe(false);
  });
  it("recognizes MP3 headers with ID3 tags or MPEG frames", () => {
    expect(hasMp3Signature(new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20]), 200)).toBe(true);
    expect(hasMp3Signature(new Uint8Array([0xff, 0xfb, 0x90, 0x64]), 200)).toBe(true);
    expect(hasMp3Signature(new Uint8Array([0xff, 0xf3, 0x80, 0x64]), 200)).toBe(true);
  });
  it("rejects non-audio content, truncated tags and reserved MPEG values", () => {
    for (const header of [
      [0x3c, 0x68, 0x74, 0x6d], [], [0xff, 0xfb, 0xff, 0x64],
      [0xff, 0xeb, 0x90, 0x64], [0xff, 0xfd, 0x90, 0x64],
      [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 127],
      [0x49, 0x44, 0x33, 4, 0, 0, 0x80, 0, 0, 0],
    ]) expect(hasMp3Signature(new Uint8Array(header), 100)).toBe(false);
  });
});
