import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const createAdminSupabaseClient = vi.fn();
const verifyUploadedMusic = vi.fn();
const initializeMusicStorageUpload = vi.fn();
const removeMusicObjectBestEffort = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));
vi.mock("@/lib/events/event-music-storage", async (importOriginal) => ({
  ...await importOriginal<typeof import("./event-music-storage")>(),
  verifyUploadedMusic, initializeMusicStorageUpload, removeMusicObjectBestEffort,
}));

const eventId = "11111111-1111-4111-8111-111111111111";
const asset = { path: `${eventId}/22222222-2222-4222-8222-222222222222.mp3`, fileSize: 200, mimeType: "audio/mpeg" };
const oldPath = `${eventId}/33333333-3333-4333-8333-333333333333.mp3`;

function setup(currentPath: string | null = null, writeResult: { data: { slug: string } | null; error: unknown } = { data: { slug: "festa" }, error: null }) {
  const read = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { music_storage_path: currentPath, slug: "festa" }, error: null }) };
  read.select.mockReturnValue(read); read.eq.mockReturnValue(read);
  const write = { eq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(writeResult) };
  write.eq.mockReturnValue(write); write.is.mockReturnValue(write); write.select.mockReturnValue(write);
  const update = vi.fn(() => write);
  const from = vi.fn(() => ({ ...read, update }));
  createAdminSupabaseClient.mockReturnValue({ from });
  return { read, write, update };
}

describe("event music administration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); requireAdmin.mockResolvedValue({ userId: "admin" });
    verifyUploadedMusic.mockResolvedValue(undefined);
    removeMusicObjectBestEffort.mockResolvedValue(undefined);
  });
  it("authorizes every operation before accessing privileged storage or database", async () => {
    requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const service = await import("./event-music-service");
    for (const operation of [service.initializeEventMusicUpload, service.saveEventMusic, service.cleanupEventMusicUpload]) {
      await expect(operation(eventId, {})).rejects.toThrow("unauthorized");
    }
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
    expect(initializeMusicStorageUpload).not.toHaveBeenCalled();
  });
  it("rejects invalid IDs and files before issuing an upload token", async () => {
    const { initializeEventMusicUpload } = await import("./event-music-service");
    await expect(initializeEventMusicUpload("invalid", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(initializeEventMusicUpload(eventId, { originalFilename: "image.png", fileSize: 200, mimeType: "image/png" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
  it("checks that the event exists before initializing its signed upload", async () => {
    const { read } = setup();
    const { initializeEventMusicUpload } = await import("./event-music-service");
    await initializeEventMusicUpload(eventId, { originalFilename: "musica.mp3", fileSize: 200, mimeType: "audio/mpeg" });
    expect(read.eq).toHaveBeenCalledWith("id", eventId);
    expect(initializeMusicStorageUpload).toHaveBeenCalledWith(eventId);
    read.maybeSingle.mockResolvedValue({ data: null, error: null });
    initializeMusicStorageUpload.mockClear();
    await expect(initializeEventMusicUpload(eventId, { originalFilename: "musica.mp3", fileSize: 200, mimeType: "audio/mpeg" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(initializeMusicStorageUpload).not.toHaveBeenCalled();
  });
  it("verifies the stored MP3 before updating and deletes the replaced audio only after saving", async () => {
    const { update, write } = setup(oldPath);
    const { saveEventMusic } = await import("./event-music-service");
    await expect(saveEventMusic(eventId, { uploadedMusic: asset, removeMusic: false })).resolves.toEqual({ slug: "festa" });
    expect(verifyUploadedMusic).toHaveBeenCalledWith(eventId, asset);
    expect(update).toHaveBeenCalledWith({ music_storage_path: asset.path });
    expect(write.eq).toHaveBeenCalledWith("id", eventId);
    expect(write.eq).toHaveBeenCalledWith("music_storage_path", oldPath);
    expect(removeMusicObjectBestEffort).toHaveBeenCalledWith(oldPath);
  });
  it("preserves existing music when verification or the database write fails", async () => {
    const { update, write } = setup(oldPath);
    const { saveEventMusic } = await import("./event-music-service");
    verifyUploadedMusic.mockRejectedValueOnce(new Error("bad signature"));
    await expect(saveEventMusic(eventId, { uploadedMusic: asset, removeMusic: false })).rejects.toThrow("bad signature");
    expect(update).not.toHaveBeenCalled();
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "failure" } });
    await expect(saveEventMusic(eventId, { uploadedMusic: asset, removeMusic: false })).rejects.toMatchObject({ status: 503 });
    expect(removeMusicObjectBestEffort).not.toHaveBeenCalled();
  });
  it("treats a concurrent edit as a conflict and preserves its music", async () => {
    setup(oldPath, { data: null, error: null });
    const { saveEventMusic } = await import("./event-music-service");
    await expect(saveEventMusic(eventId, { uploadedMusic: asset, removeMusic: false })).rejects.toMatchObject({ status: 409 });
    expect(removeMusicObjectBestEffort).not.toHaveBeenCalled();
  });
  it("removes audio explicitly, without uploading a replacement", async () => {
    const { update } = setup(oldPath);
    const { saveEventMusic } = await import("./event-music-service");
    await saveEventMusic(eventId, { uploadedMusic: null, removeMusic: true });
    expect(update).toHaveBeenCalledWith({ music_storage_path: null });
    expect(verifyUploadedMusic).not.toHaveBeenCalled();
    expect(removeMusicObjectBestEffort).toHaveBeenCalledWith(oldPath);
  });
  it("never cleans up the currently attached audio after an uncertain save response", async () => {
    setup(asset.path);
    const { cleanupEventMusicUpload } = await import("./event-music-service");
    await cleanupEventMusicUpload(eventId, asset);
    expect(removeMusicObjectBestEffort).not.toHaveBeenCalled();
  });
  it("limits cleanup to unused files of the requested event", async () => {
    setup(oldPath);
    const { cleanupEventMusicUpload } = await import("./event-music-service");
    await expect(cleanupEventMusicUpload(eventId, { ...asset, path: asset.path.replace(eventId, "44444444-4444-4444-8444-444444444444") })).rejects.toMatchObject({ status: 400 });
    expect(removeMusicObjectBestEffort).not.toHaveBeenCalled();
    await cleanupEventMusicUpload(eventId, asset);
    expect(removeMusicObjectBestEffort).toHaveBeenCalledWith(asset.path);
  });
});
