import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const createAdminSupabaseClient = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

describe("admin photo archive authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not read database or Storage before authorization", async () => {
    requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const { createEventPhotoArchive } = await import(
      "./admin-photo-archive-service"
    );

    await expect(
      createEventPhotoArchive("11111111-1111-4111-8111-111111111111"),
    ).rejects.toThrow("unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
