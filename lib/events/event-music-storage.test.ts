import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminSupabaseClient = vi.fn();
const readPrivateStorageObjectHeader = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));
vi.mock("@/lib/storage/private-storage", () => ({ readPrivateStorageObjectHeader }));

const eventId = "11111111-1111-4111-8111-111111111111";
const asset = { path: `${eventId}/22222222-2222-4222-8222-222222222222.mp3`, fileSize: 200, mimeType: "audio/mpeg" as const };

describe("private event music storage", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects cross-event paths and traversal before accessing storage", async () => {
    const { verifyUploadedMusic } = await import("./event-music-storage");
    for (const path of [asset.path.replace(eventId, "33333333-3333-4333-8333-333333333333"), `${eventId}/../music.mp3`, `${asset.path}/extra`, asset.path.replace("mp3", "html")]) {
      await expect(verifyUploadedMusic(eventId, { ...asset, path })).rejects.toMatchObject({ status: 400 });
    }
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
  it("requires the stored metadata and audio signature to match the upload", async () => {
    const info = vi.fn().mockResolvedValue({ data: { size: 200, contentType: "audio/mpeg" }, error: null });
    createAdminSupabaseClient.mockReturnValue({ storage: { from: vi.fn(() => ({ info })) } });
    readPrivateStorageObjectHeader.mockResolvedValue(new Uint8Array([0xff, 0xfb, 0x90, 0x64]));
    const { verifyUploadedMusic } = await import("./event-music-storage");
    await expect(verifyUploadedMusic(eventId, asset)).resolves.toBeUndefined();
    readPrivateStorageObjectHeader.mockResolvedValue(new Uint8Array([0x3c, 0x68, 0x74, 0x6d]));
    await expect(verifyUploadedMusic(eventId, asset)).rejects.toMatchObject({ status: 400 });
    info.mockResolvedValue({ data: { size: 201, contentType: "audio/mpeg" }, error: null });
    await expect(verifyUploadedMusic(eventId, asset)).rejects.toMatchObject({ status: 400 });
  });
  it("keeps unsigned events and storage outages accessible", async () => {
    const { createEventMusicUrl } = await import("./event-music-storage");
    expect(await createEventMusicUrl(null)).toBeNull();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: {} });
    createAdminSupabaseClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createEventMusicUrl(asset.path)).toBeNull();
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example/signed.mp3" }, error: null });
    expect(await createEventMusicUrl(asset.path)).toBe("https://storage.example/signed.mp3");
    expect(createSignedUrl).toHaveBeenCalledWith(asset.path, 3600);
    log.mockRestore();
  });
});
