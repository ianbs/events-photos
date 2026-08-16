import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const createAdminSupabaseClient = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

describe("admin photo authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not touch Storage or the database when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const { deletePhotoAsAdmin } = await import("./admin-photo-service");

    await expect(
      deletePhotoAsAdmin("11111111-1111-4111-8111-111111111111"),
    ).rejects.toThrow("unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
