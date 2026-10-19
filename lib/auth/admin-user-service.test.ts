import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSuperAdmin, createAdminSupabaseClient } = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(), createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireSuperAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));
vi.mock("@/lib/config/server-environment", () => ({
  getServerEnvironment: () => ({ NEXT_PUBLIC_APP_URL: "https://eventos.example.com" }),
}));

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const valid = { email: " New@Example.com ", role: "admin" };
function createClient() {
  const updateUserById = vi.fn().mockResolvedValue({ data: { user: { id: targetId } }, error: null });
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: targetId } }, error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
  const getUserById = vi.fn().mockResolvedValue({ data: { user: { id: targetId, email: "canonical@example.com" } }, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { is_active: true }, error: null });
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }));
  const client = { auth: { admin: { createUser, getUserById, updateUserById }, resetPasswordForEmail }, rpc, from };
  createAdminSupabaseClient.mockReturnValue(client);
  return { createUser, updateUserById, rpc, resetPasswordForEmail, getUserById, maybeSingle, client };
}

describe("superadministrator account management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSuperAdmin.mockResolvedValue({ userId: actorId, role: "super_admin" });
  });

  it("authorizes every entry point before touching privileged clients", async () => {
    requireSuperAdmin.mockRejectedValue(new Error("forbidden"));
    const { createAdminUser, updateAdminUserAccess, listAdminUsers, sendAdminUserPasswordEmail, setAdminUserPassword } = await import("./admin-user-service");
    await expect(createAdminUser(valid)).rejects.toThrow("forbidden");
    await expect(setAdminUserPassword({})).rejects.toThrow("forbidden");
    await expect(updateAdminUserAccess({})).rejects.toThrow("forbidden");
    await expect(listAdminUsers()).rejects.toThrow("forbidden");
    await expect(sendAdminUserPasswordEmail(targetId)).rejects.toThrow("forbidden");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects invalid emails and roles without creating accounts", async () => {
    const { createAdminUser } = await import("./admin-user-service");
    await expect(createAdminUser({ ...valid, email: "invalid" })).rejects.toMatchObject({ status: 400 });
    await expect(createAdminUser({ ...valid, role: "root" })).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("uses a random private password and sends the link only after granting access", async () => {
    const { createUser, rpc, resetPasswordForEmail } = createClient();
    const { createAdminUser } = await import("./admin-user-service");
    await createAdminUser({ ...valid, password: "must-not-be-used" });
    expect(createUser).toHaveBeenCalledWith({ email: "new@example.com", password: expect.any(String), email_confirm: true });
    expect(createUser.mock.calls[0][0].password.length).toBeGreaterThanOrEqual(32);
    expect(createUser.mock.calls[0][0].password).not.toBe("must-not-be-used");
    expect(rpc).toHaveBeenCalledWith("manage_admin_access", { p_actor_id: actorId, p_user_id: targetId, p_role: "admin", p_is_active: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("new@example.com", { redirectTo: "https://eventos.example.com/admin/reset-password" });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(resetPasswordForEmail.mock.invocationCallOrder[0]);
  });

  it("does not overwrite passwords or send mail for an existing account", async () => {
    const { createUser, rpc, resetPasswordForEmail } = createClient();
    createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    const { createAdminUser } = await import("./admin-user-service");
    await expect(createAdminUser(valid)).rejects.toMatchObject({ status: 409 });
    expect(rpc).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("does not send mail if granting access fails", async () => {
    const { rpc, resetPasswordForEmail } = createClient();
    rpc.mockResolvedValue({ error: { code: "42501" } });
    const { createAdminUser } = await import("./admin-user-service");
    await expect(createAdminUser(valid)).rejects.toMatchObject({ status: 409 });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("reports a recoverable partial creation if SMTP refuses the email", async () => {
    const { resetPasswordForEmail } = createClient();
    resetPasswordForEmail.mockResolvedValue({ error: { code: "email_address_not_authorized" } });
    const { createAdminUser } = await import("./admin-user-service");
    await expect(createAdminUser(valid)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("SMTP") });
  });

  it("sends reset links to the stored email instead of a client-supplied address", async () => {
    const { getUserById, resetPasswordForEmail } = createClient();
    const { sendAdminUserPasswordEmail } = await import("./admin-user-service");
    await sendAdminUserPasswordEmail(targetId);
    expect(getUserById).toHaveBeenCalledWith(targetId);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("canonical@example.com", { redirectTo: "https://eventos.example.com/admin/reset-password" });
  });

  it("does not send reset links to blocked or unapproved accounts", async () => {
    const { maybeSingle, resetPasswordForEmail } = createClient();
    maybeSingle.mockResolvedValue({ data: { is_active: false }, error: null });
    const { sendAdminUserPasswordEmail } = await import("./admin-user-service");
    await expect(sendAdminUserPasswordEmail(targetId)).rejects.toMatchObject({ status: 400 });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("provides a clear retry message for email rate limits", async () => {
    const { resetPasswordForEmail } = createClient();
    resetPasswordForEmail.mockResolvedValue({ error: { status: 429 } });
    const { sendAdminUserPasswordEmail } = await import("./admin-user-service");
    await expect(sendAdminUserPasswordEmail(targetId)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("limite") });
  });

  it("prevents self-demotion and self-blocking before the write", async () => {
    const { updateAdminUserAccess } = await import("./admin-user-service");
    await expect(updateAdminUserAccess({ userId: actorId, role: "admin", isActive: false })).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("honors database revalidation of a revoked actor", async () => {
    const { rpc } = createClient();
    rpc.mockResolvedValue({ error: { code: "42501" } });
    const { updateAdminUserAccess } = await import("./admin-user-service");
    await expect(updateAdminUserAccess({ userId: targetId, role: "admin", isActive: false })).rejects.toMatchObject({ status: 403 });
  });

  it("lists a bounded Auth page and returns only display fields", async () => {
    const listUsers = vi.fn().mockResolvedValue({ data: { users: [{ id: targetId, email: "test@example.com", created_at: "2026-10-18", app_metadata: { secret: true } }], nextPage: 1 }, error: null });
    const inQuery = vi.fn().mockResolvedValue({ data: [{ user_id: targetId, role: "super_admin", is_active: false }], error: null });
    createAdminSupabaseClient.mockReturnValue({
      auth: { admin: { listUsers } }, from: vi.fn(() => ({ select: vi.fn(() => ({ in: inQuery })) })),
    });
    const { listAdminUsers } = await import("./admin-user-service");
    const result = await listAdminUsers("9");
    expect(listUsers).toHaveBeenCalledWith({ page: 9, perPage: 30 });
    expect(result.hasNext).toBe(true);
    expect(result.users[0]).toEqual({ id: targetId, email: "test@example.com", createdAt: "2026-10-18", role: "super_admin", isActive: false, hasAccess: true });
  });

  it("creates a manual-password account without invoking the email service", async () => {
    const { createUser, rpc, resetPasswordForEmail } = createClient();
    const { createAdminUser } = await import("./admin-user-service");
    const password = "A-long-manual-password-123!";
    await expect(createAdminUser({ ...valid, passwordMode: "manual", password, confirmation: password }))
      .resolves.toEqual({ passwordMode: "manual" });
    expect(createUser).toHaveBeenCalledWith({ email: "new@example.com", password, email_confirm: true });
    expect(rpc).toHaveBeenCalledWith("manage_admin_access", expect.objectContaining({ p_is_active: true, p_role: "admin" }));
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each([
    { password: "short", confirmation: "short" },
    { password: "a".repeat(129), confirmation: "a".repeat(129) },
    { password: "long-enough-password", confirmation: "different-password" },
  ])("validates a manual password before account creation", async (fields) => {
    const { createAdminUser } = await import("./admin-user-service");
    await expect(createAdminUser({ ...valid, passwordMode: "manual", ...fields })).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("does not change an existing account when its email is entered in manual creation", async () => {
    const { createUser, updateUserById, rpc, resetPasswordForEmail } = createClient();
    createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    const { createAdminUser } = await import("./admin-user-service");
    await expect(createAdminUser({ ...valid, passwordMode: "manual", password: "new-manual-password", confirmation: "new-manual-password" }))
      .rejects.toMatchObject({ status: 409 });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("updates only the requested password without email or access changes", async () => {
    const { updateUserById, rpc, resetPasswordForEmail, client } = createClient();
    const { setAdminUserPassword } = await import("./admin-user-service");
    await setAdminUserPassword({ userId: targetId, password: "new-long-password-123!", confirmation: "new-long-password-123!", role: "super_admin", isActive: true });
    expect(updateUserById).toHaveBeenCalledWith(targetId, { password: "new-long-password-123!" });
    expect(rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each([
    { userId: "invalid", password: "long-enough-password", confirmation: "long-enough-password" },
    { userId: targetId, password: "short", confirmation: "short" },
    { userId: targetId, password: "long-enough-password", confirmation: "does-not-match" },
  ])("validates password changes before using the privileged client", async (input) => {
    const { setAdminUserPassword } = await import("./admin-user-service");
    await expect(setAdminUserPassword(input)).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it.each([
    { code: "weak_password", status: 400 },
    { code: "same_password", status: 400 },
    { code: "user_not_found", status: 400 },
    { code: "unexpected_failure", status: 503 },
  ])("reports an Auth password-change error safely: $code", async ({ code, status }) => {
    const { updateUserById, resetPasswordForEmail } = createClient();
    updateUserById.mockResolvedValue({ data: { user: null }, error: { code } });
    const { setAdminUserPassword } = await import("./admin-user-service");
    await expect(setAdminUserPassword({ userId: targetId, password: "long-enough-password", confirmation: "long-enough-password" }))
      .rejects.toMatchObject({ status });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
