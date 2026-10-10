import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireAdmin, createAdminSupabaseClient } = vi.hoisted(() => ({ requireAdmin: vi.fn(), createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));
vi.mock("@/lib/config/server-environment", () => ({ getServerEnvironment: () => ({ NEXT_PUBLIC_APP_URL: "https://events.example.com" }) }));
import { changeRsvpInvitation, createRsvpInvitation, deleteRsvpGuest, exportRsvpInvitations, listRsvpInvitations } from "./rsvp-invitation-service";

const eventId = "11111111-1111-4111-8111-111111111111";
const code = "a".repeat(43);
const guestRow: { guest_id: string; name: string; email: string | null; phone: string | null; invitation_code: string | null; invitation_revoked_at: string | null } = {
  guest_id: eventId, name: "Ana", email: null, phone: "5511999999999", invitation_code: code, invitation_revoked_at: null,
};
function setup(rows = [guestRow], whatsappMessage: string | null = null) {
  const eventQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: eventId, name: "Festa", slug: "event-a", is_active: true, whatsapp_message: whatsappMessage }, error: null }) };
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: rows, error: null, count: rows.length }),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  const responses = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) };
  const rpc = vi.fn().mockResolvedValue({ data: eventId, error: null });
  createAdminSupabaseClient.mockReturnValue({ from: vi.fn((table) => table === "events" ? eventQuery : table === "event_rsvps" ? responses : query), rpc });
  return { query, rpc };
}

describe("guest registration and recoverable invitations", () => {
  beforeEach(() => { vi.clearAllMocks(); requireAdmin.mockResolvedValue({ userId: "admin" }); });
  it("requires admin authorization for all access to recoverable secrets", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(createRsvpInvitation(eventId, {})).rejects.toThrow("forbidden");
    await expect(listRsvpInvitations(eventId)).rejects.toThrow("forbidden");
    await expect(changeRsvpInvitation(eventId, { guestId: eventId, action: "retrieve" })).rejects.toThrow("forbidden");
    await expect(exportRsvpInvitations(eventId, { guestIds: [eventId] })).rejects.toThrow("forbidden");
    await expect(deleteRsvpGuest(eventId, { guestId: eventId })).rejects.toThrow("forbidden");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
  it("registers a guest and persists the code for future retrieval", async () => {
    const { rpc } = setup();
    const result = await createRsvpInvitation(eventId, { name: " Ana ", phone: "+55 (11) 99999-9999" });
    expect(result.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rpc).toHaveBeenCalledWith("create_rsvp_guest", { p_event_id: eventId, p_name: "Ana", p_code: result.code, p_phone: "5511999999999", p_email: undefined, p_max_companions: undefined });
    expect(result.whatsappUrl).toContain("https://wa.me/5511999999999");
  });
  it("retrieves the same link repeatedly without overwriting the secret or RSVP", async () => {
    const { query } = setup();
    const first = await changeRsvpInvitation(eventId, { guestId: eventId, action: "retrieve" });
    const second = await changeRsvpInvitation(eventId, { guestId: eventId, action: "retrieve" });
    expect(first).toEqual(second);
    expect(first?.url).toBe(`https://events.example.com/e/event-a/save-the-date#convite=${code}`);
    expect(query.update).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("event_id", eventId);
  });
  it("does not recover revoked invitations", async () => {
    setup([{ ...guestRow, invitation_revoked_at: "2026-10-05" }]);
    await expect(changeRsvpInvitation(eventId, { guestId: eventId, action: "retrieve" })).rejects.toMatchObject({ status: 400 });
  });
  it("changes contact details without replacing the invitation code", async () => {
    const { query } = setup();
    await changeRsvpInvitation(eventId, { guestId: eventId, action: "edit", name: "Ana Maria", phone: "5511888888888" });
    expect(query.update).toHaveBeenCalledWith({ name: "Ana Maria", phone: "5511888888888", email: null, max_companions: null });
  });
  it("omits recoverable secrets from the default guest listing", async () => {
    const { query } = setup();
    const result = await listRsvpInvitations(eventId, 2);
    expect(result.invitations[0]).toMatchObject({ hasRecoverableLink: true, response: null });
    expect(result.invitations[0]).not.toHaveProperty("invitation_code");
    expect(query.range).toHaveBeenCalledWith(50, 99);
  });
  it("exports selected guests only within the authorized event", async () => {
    const { query } = setup();
    const csv = await exportRsvpInvitations(eventId, { guestIds: [eventId] });
    expect(query.eq).toHaveBeenCalledWith("event_id", eventId);
    expect(query.in).toHaveBeenCalledWith("guest_id", [eventId]);
    expect(csv).toContain("5511999999999"); expect(csv).toContain(`#convite=${code}`);
  });
  it("rejects an export containing guests from another event", async () => {
    setup([]);
    await expect(exportRsvpInvitations(eventId, { guestIds: [eventId] })).rejects.toMatchObject({ status: 400 });
  });
  it("rejects duplicate email registration without overwriting the existing guest", async () => {
    const { rpc } = setup(); rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(createRsvpInvitation(eventId, { name: "Ana", email: "ana@example.com" })).rejects.toMatchObject({ status: 409 });
  });
  it("creates an individual invitation with an explicit zero companion allowance", async () => {
    const { rpc } = setup();
    await createRsvpInvitation(eventId, { name: "Ana", maxCompanions: "0" });
    expect(rpc).toHaveBeenCalledWith("create_rsvp_guest", expect.objectContaining({ p_max_companions: 0 }));
  });
  it("edits the companion allowance without changing the invitation code", async () => {
    const { query } = setup();
    await changeRsvpInvitation(eventId, { guestId: eventId, action: "edit", name: "Ana", maxCompanions: "3" });
    expect(query.update).toHaveBeenCalledWith({ name: "Ana", email: null, phone: null, max_companions: 3 });
  });
  it.each([-1, 1.5, "abc", true, 2147483648])("rejects invalid individual allowance %s", async (maxCompanions) => {
    const { rpc } = setup();
    await expect(createRsvpInvitation(eventId, { name: "Ana", maxCompanions })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses the configured message for recovery and CSV export", async () => {
    setup([guestRow], "Oi, {nome}!\nParticipe de {evento}: {link}");
    const invitation = await changeRsvpInvitation(eventId, { guestId: eventId, action: "retrieve" });
    expect(invitation?.message).toBe(`Oi, Ana!\nParticipe de Festa: ${invitation?.url}`);
    const csv = await exportRsvpInvitations(eventId, { guestIds: [eventId] });
    expect(csv).toContain(invitation!.message);
    expect(csv).toContain(invitation!.whatsappUrl);
  });
  it("scopes atomic deletion to both the event and guest", async () => {
    const { rpc } = setup(); rpc.mockResolvedValue({ data: true, error: null });
    await deleteRsvpGuest(eventId, { guestId: eventId });
    expect(rpc).toHaveBeenCalledWith("delete_rsvp_guest", { p_event_id: eventId, p_guest_id: eventId });
  });
  it("rejects invalid or missing guests without reporting successful deletion", async () => {
    const { rpc } = setup();
    await expect(deleteRsvpGuest(eventId, { guestId: "invalid" })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(deleteRsvpGuest(eventId, { guestId: eventId })).rejects.toMatchObject({ status: 404 });
    rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await expect(deleteRsvpGuest(eventId, { guestId: eventId })).rejects.toMatchObject({ status: 503 });
  });
});
