import { beforeEach, describe, expect, it, vi } from "vitest";
const { createAdminSupabaseClient } = vi.hoisted(() => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));
import { hashInvitationCode, resolveRsvpIdentity } from "./rsvp-identity-service";

function setup(active = true, invite = true) {
  const eventQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: active ? { id: "event-a" } : null, error: null }) };
  const identityQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: invite ? { guest_id: "canonical-guest" } : null, error: null }) };
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
    await expect(resolveRsvpIdentity("event-a", invitation)).resolves.toEqual({ eventId: "event-a", guestId: "canonical-guest" });
    expect(identityQuery.eq.mock.calls).toEqual([["event_id", "event-a"], ["invitation_hash", hashInvitationCode(invitation.invitationCode)]]);
    expect(identityQuery.is).toHaveBeenCalledWith("invitation_revoked_at", null);
    expect(identityQuery.select).toHaveBeenCalledWith("guest_id");
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
});
