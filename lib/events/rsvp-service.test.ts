import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, authorizeGuest, createOrRecoverGuest, createAdminSupabaseClient } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), authorizeGuest: vi.fn(), createOrRecoverGuest: vi.fn(), createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/guests/guest-service", () => ({ authorizeGuest, createOrRecoverGuest }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

import { listAdminRsvps, readGuestRsvp, saveGuestRsvp } from "./rsvp-service";

const guest = { eventId: "event-a", guestId: "guest-a" };
const input = { guestToken: "11111111-1111-4111-8111-111111111111", name: "  Ana  ", attending: true, companions: 2 };

function client(result: unknown) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result), single: vi.fn().mockResolvedValue(result),
  };
  createAdminSupabaseClient.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}

describe("event RSVP server boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeGuest.mockResolvedValue(guest);
    createOrRecoverGuest.mockResolvedValue(guest);
    requireAdmin.mockResolvedValue({ userId: "admin" });
  });

  it("rejects a declined response with companions before touching guest identity or storage", async () => {
    await expect(saveGuestRsvp("event-a", { ...input, attending: false })).rejects.toMatchObject({ status: 400 });
    expect(authorizeGuest).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it.each([{ name: " " }, { companions: -1 }, { companions: 11 }, { companions: 1.5 }, { attending: "true" }, { guestToken: "invalid" }])(
    "rejects invalid fields %j", async (fields) => {
      await expect(saveGuestRsvp("event-a", { ...input, ...fields })).rejects.toMatchObject({ status: 400 });
      expect(authorizeGuest).not.toHaveBeenCalled();
    },
  );

  it("blocks saves when guest authorization fails", async () => {
    authorizeGuest.mockRejectedValue(new Error("inactive or unauthorized"));
    await expect(saveGuestRsvp("event-a", input)).rejects.toThrow("inactive or unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("upserts only the authorized event and guest even if the body supplies other IDs", async () => {
    const query = client({ data: { name: "Ana", attending: true, companions: 2 }, error: null });
    await saveGuestRsvp("event-a", { ...input, eventId: "event-b", guestId: "guest-b" });
    expect(authorizeGuest).toHaveBeenCalledWith("event-a", input.guestToken);
    expect(query.upsert).toHaveBeenCalledWith({
      event_id: "event-a", guest_id: "guest-a", name: "Ana", attending: true, companions: 2,
      updated_at: expect.any(String),
    }, { onConflict: "event_id,guest_id" });
  });

  it("returns only the current guest's RSVP", async () => {
    const query = client({ data: null, error: null });
    await expect(readGuestRsvp("event-a", input.guestToken)).resolves.toBeNull();
    expect(query.eq.mock.calls).toEqual([["event_id", "event-a"], ["guest_id", "guest-a"]]);
    expect(query.select).toHaveBeenCalledWith("name,attending,companions");
  });

  it("does not query RSVPs when the event cannot be recovered", async () => {
    createOrRecoverGuest.mockRejectedValue(new Error("inactive"));
    await expect(readGuestRsvp("event-a", input.guestToken)).rejects.toThrow("inactive");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("reports failed writes instead of claiming confirmation", async () => {
    client({ data: null, error: { code: "42P01" } });
    await expect(saveGuestRsvp("event-a", input)).rejects.toMatchObject({ status: 503 });
  });

  it("requires an admin before listing responses", async () => {
    requireAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(listAdminRsvps("event-a", 1)).rejects.toThrow("forbidden");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("paginates within the selected event", async () => {
    const query = client({ data: [], error: null, count: 75 });
    const eventId = "11111111-1111-4111-8111-111111111111";
    await expect(listAdminRsvps(eventId, 2)).resolves.toMatchObject({ total: 75, pageSize: 50 });
    expect(query.eq).toHaveBeenCalledWith("event_id", eventId);
    expect(query.range).toHaveBeenCalledWith(50, 99);
  });

  it("rejects invalid admin pagination before querying storage", async () => {
    await expect(listAdminRsvps(input.guestToken, 0)).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
