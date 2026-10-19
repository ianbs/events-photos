import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, createAdminSupabaseClient, getPhotoStorage, remove } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), createAdminSupabaseClient: vi.fn(), getPhotoStorage: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));
vi.mock("@/lib/storage/photo-storage", () => ({
  getPhotoStorage, parseStorageProvider: (value: string) => value,
}));

const eventId = "11111111-1111-4111-8111-111111111111";
const event = { id: eventId, name: "Evento teste", slug: "teste", cover_storage_path: null, logo_storage_path: null, music_storage_path: null };
const input = { confirmation: event.name };

function query(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn> | unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "update", "delete", "maybeSingle"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}
function setup(results: unknown[], rpcResults: unknown[] = [{ data: false, error: null }, { data: true, error: null }]) {
  const from = vi.fn();
  for (const result of results) from.mockReturnValueOnce(query(result));
  const rpc = vi.fn();
  for (const result of rpcResults) rpc.mockResolvedValueOnce(result);
  const storageRemove = vi.fn().mockResolvedValue({ error: null });
  createAdminSupabaseClient.mockReturnValue({ from, rpc, storage: { from: vi.fn(() => ({ remove: storageRemove })) } });
  return { from, rpc, storageRemove };
}
const found = { data: event, error: null };
const paused = { data: { id: eventId }, error: null };
const noPhotos = { data: [], error: null };

describe("event deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ userId: "admin-id" });
    getPhotoStorage.mockReturnValue({ remove });
    remove.mockResolvedValue(undefined);
  });

  it("authorizes before accessing the privileged client", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).rejects.toThrow("forbidden");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an exact event-name confirmation before any mutation", async () => {
    const { from, rpc } = setup([found]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, { confirmation: "outro evento" })).rejects.toMatchObject({ status: 400 });
    expect(from).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("safely handles a retry after the event has already been deleted", async () => {
    const { rpc } = setup([{ data: null, error: null }]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).resolves.toMatchObject({ deleted: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not start file removal if the migration has not been applied", async () => {
    const { from } = setup([found], [{ data: null, error: { code: "PGRST202" } }]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).rejects.toMatchObject({ status: 503 });
    expect(from).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes a bounded photo batch through each stored provider before deleting rows", async () => {
    const photos = [
      { id: "photo1", storage_path: eventId + "/guest/photo1.png", storage_provider: "supabase" },
      { id: "photo2", storage_path: eventId + "/guest/photo2.png", storage_provider: "s3" },
    ];
    const { rpc, from } = setup([found, paused, { data: photos, error: null }, { error: null }, { error: null }]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).resolves.toMatchObject({ deleted: false, removedPhotos: 2 });
    expect(getPhotoStorage).toHaveBeenCalledWith("supabase");
    expect(getPhotoStorage).toHaveBeenCalledWith("s3");
    expect(from).toHaveBeenCalledTimes(5);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_check_only: true });
  });

  it("preserves a photo row for retry when storage removal fails", async () => {
    remove.mockRejectedValue(new Error("storage unavailable"));
    const { from, rpc } = setup([found, paused, { data: [{ id: "photo", storage_path: eventId + "/guest/photo.png", storage_provider: "s3" }], error: null }]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).rejects.toMatchObject({ status: 503 });
    expect(from).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("refuses to remove files belonging to a different event", async () => {
    setup([found, paused, { data: [{ id: "photo", storage_path: "other-event/photo.png", storage_provider: "supabase" }], error: null }]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).rejects.toMatchObject({ status: 503 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("cleans branding and music before the final guarded deletion", async () => {
    const cover = eventId + "/cover/file.png";
    const music = eventId + "/file.mp3";
    const { rpc, storageRemove } = setup([
      { data: { ...event, cover_storage_path: cover, music_storage_path: music }, error: null },
      paused, noPhotos, { error: null }, { error: null },
    ]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).resolves.toMatchObject({ deleted: true });
    expect(storageRemove).toHaveBeenCalledWith([cover]);
    expect(storageRemove).toHaveBeenCalledWith([music]);
    expect(rpc).toHaveBeenLastCalledWith("finish_admin_event_deletion", {
      p_actor_id: "admin-id", p_event_id: eventId, p_confirmation: event.name,
    });
  });

  it("retries if new assets or photos appeared before finalization", async () => {
    setup([found, paused, noPhotos], [{ data: false, error: null }, { data: false, error: null }]);
    const { deleteAdminEventBatch } = await import("./admin-event-deletion-service");
    await expect(deleteAdminEventBatch(eventId, input)).resolves.toMatchObject({ deleted: false });
  });
});
