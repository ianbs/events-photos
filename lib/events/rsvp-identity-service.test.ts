import { beforeEach, describe, expect, it, vi } from "vitest";
const { createAdminSupabaseClient } = vi.hoisted(() => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));
import { hashInvitationCode, resolveRsvpIdentity } from "./rsvp-identity-service";

function setup(active = true, invite = true, eventLimit: number | null = null, guestLimit: number | null = null) {
  const eventQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: active ? { id: "event-a", max_companions: eventLimit } : null, error: null }) };
  const identityQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: invite ? { guest_id: "canonical-guest", max_companions: guestLimit } : null, error: null }) };
  createAdminSupabaseClient.mockReturnValue({ from: vi.fn((table) => table === "events" ? eventQuery : identityQuery) });
  return { identityQuery };
}

describe("invitation-only RSVP authorization", () => {
  beforeEach(() => vi.clearAllMocks());
  const invitation = { method: "invitation", invitationCode: "a".repeat(43) };
  it.each([{ guestToken: crypto.randomUUID() }, { method: "email", accessToken: "valid-session" }])("rejects discontinued authentication %j", async (credentials) => {
    await expect(resolveRsvpIdentity("event-a", credentials)).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
  it("scopes authorization to the event and a non-revoked invitation hash", async () => {
    const { identityQuery } = setup();
    await expect(resolveRsvpIdentity("event-a", invitation)).resolves.toEqual({ eventId: "event-a", guestId: "canonical-guest", companionLimit: 10 });
    expect(identityQuery.eq.mock.calls).toEqual([["event_id", "event-a"], ["invitation_hash", hashInvitationCode(invitation.invitationCode)]]);
    expect(identityQuery.is).toHaveBeenCalledWith("invitation_revoked_at", null);
    expect(identityQuery.select).toHaveBeenCalledWith("guest_id,max_companions");
  });
  it("denies invalid, revoked and other-event invitations", async () => {
    setup(true, false);
    await expect(resolveRsvpIdentity("event-a", invitation)).rejects.toMatchObject({ status: 403 });
  });
  it("denies inactive events", async () => {
    const { identityQuery } = setup(false);
    await expect(resolveRsvpIdentity("event-a", invitation)).rejects.toMatchObject({ status: 404 });
    expect(identityQuery.select).not.toHaveBeenCalled();
  });
  it.each([[2, 0, 0], [0, 3, 3], [2, null, 2], [null, null, 10]])("resolves event limit %s and individual limit %s to %s", async (eventLimit, guestLimit, expected) => {
    setup(true, true, eventLimit, guestLimit);
    await expect(resolveRsvpIdentity("event-a", invitation)).resolves.toMatchObject({ companionLimit: expected });
  });
});
