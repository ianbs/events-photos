import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient } = vi.hoisted(() => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

function setup(membership: unknown, user: unknown = { id: "actor", email: "admin@example.com", user_metadata: { role: "super_admin" } }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: membership, error: null });
  createServerSupabaseClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
  });
}

describe("administrative authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects anonymous access", async () => {
    setup(null, null);
    const { requireAdmin } = await import("./admin-authorization");
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it("rejects blocked accounts despite a valid session", async () => {
    setup({ user_id: "actor", role: "super_admin", is_active: false });
    const { requireAdmin, getCurrentAdmin } = await import("./admin-authorization");
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("does not authorize superadmin from user-editable metadata", async () => {
    setup({ user_id: "actor", role: "admin", is_active: true });
    const { requireAdmin, requireSuperAdmin } = await import("./admin-authorization");
    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
    await expect(requireSuperAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("authorizes an active superadministrator", async () => {
    setup({ user_id: "actor", role: "super_admin", is_active: true });
    const { requireSuperAdmin } = await import("./admin-authorization");
    await expect(requireSuperAdmin()).resolves.toMatchObject({ userId: "actor", role: "super_admin" });
  });

  it("rejects unknown roles", async () => {
    setup({ user_id: "actor", role: "other", is_active: true });
    const { requireAdmin } = await import("./admin-authorization");
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
});
