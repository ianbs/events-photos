import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSuperAdmin, createAdminSupabaseClient } = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(), createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireSuperAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const input = { userId: targetId, confirmation: "target@example.com" };

function createClient() {
  const getUserById = vi.fn().mockResolvedValue({ data: { user: { id: targetId, email: input.confirmation } }, error: null });
  const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { role: "super_admin" }, error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }));
  createAdminSupabaseClient.mockReturnValue({ auth: { admin: { getUserById, deleteUser } }, from, rpc });
  return { getUserById, deleteUser, maybeSingle, rpc, from };
}

beforeEach(() => {
  vi.resetAllMocks();
  requireSuperAdmin.mockResolvedValue({ userId: actorId, role: "super_admin" });
});

describe("admin user deletion", () => {
  it("requires a superadministrator before using privileged credentials", async () => {
    requireSuperAdmin.mockRejectedValue({ status: 403 });
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await expect(deleteAdminUser(input)).rejects.toMatchObject({ status: 403 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects self-deletion before creating a privileged client", async () => {
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await expect(deleteAdminUser({ ...input, userId: actorId })).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("validates the identifier and requires a confirmation", async () => {
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await expect(deleteAdminUser({ userId: "invalid", confirmation: "" })).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("compares confirmation to the canonical Auth email before any write", async () => {
    const { rpc, deleteUser } = createClient();
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await expect(deleteAdminUser({ ...input, confirmation: "someone@example.com" })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("revokes access with actor revalidation before permanently deleting Auth", async () => {
    const { rpc, deleteUser, from } = createClient();
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await deleteAdminUser({ ...input, confirmation: " TARGET@EXAMPLE.COM " });
    expect(rpc).toHaveBeenCalledWith("manage_admin_access", {
      p_actor_id: actorId, p_user_id: targetId, p_role: "super_admin", p_is_active: false,
    });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0]);
    expect(deleteUser).toHaveBeenCalledWith(targetId, false);
    expect(from).toHaveBeenCalledExactlyOnceWith("admin_users");
  });

  it("stops before deletion if the actor was revoked concurrently", async () => {
    const { rpc, deleteUser } = createClient();
    rpc.mockResolvedValue({ error: { code: "42501" } });
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await expect(deleteAdminUser(input)).rejects.toMatchObject({ status: 403 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("can remove an account that never had administration access", async () => {
    const { maybeSingle, rpc, deleteUser } = createClient();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await deleteAdminUser(input);
    expect(rpc).toHaveBeenCalledWith("manage_admin_access", expect.objectContaining({ p_role: "admin", p_is_active: false }));
    expect(deleteUser).toHaveBeenCalledOnce();
  });

  it("keeps access blocked and explains an Auth deletion failure", async () => {
    const { rpc, deleteUser } = createClient();
    deleteUser.mockResolvedValue({ error: { code: "unexpected_failure" } });
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await expect(deleteAdminUser(input)).rejects.toMatchObject({ status: 503, message: expect.stringContaining("foi bloqueado") });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("allows safe retries after the account has already been deleted", async () => {
    const { getUserById, rpc, deleteUser } = createClient();
    getUserById.mockResolvedValue({ data: { user: null }, error: { code: "user_not_found" } });
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await expect(deleteAdminUser(input)).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("supports accounts without an email by confirming their identifier", async () => {
    const { getUserById, deleteUser } = createClient();
    getUserById.mockResolvedValue({ data: { user: { id: targetId, email: null } }, error: null });
    const { deleteAdminUser } = await import("./admin-user-deletion-service");
    await deleteAdminUser({ userId: targetId, confirmation: targetId });
    expect(deleteUser).toHaveBeenCalledWith(targetId, false);
  });
});
