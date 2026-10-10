import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, resolveRsvpIdentity, createAdminSupabaseClient } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), resolveRsvpIdentity: vi.fn(), createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/events/rsvp-identity-service", () => ({ resolveRsvpIdentity }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

import { listAdminRsvps, readGuestRsvp, saveGuestRsvp } from "./rsvp-service";

const guest = { eventId: "event-a", guestId: "guest-a" };
const credentials = { method: "invitation", invitationCode: "a".repeat(43) };
const input = { credentials, name: "  Ana  ", attending: true, companions: 2 };

function client(result: unknown, maxCompanions: number | null = null) {
  resolveRsvpIdentity.mockResolvedValue({ ...guest, companionLimit: maxCompanions ?? 10 });
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result), single: vi.fn().mockResolvedValue(result),
  };
  const eventQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { max_companions: maxCompanions }, error: null }) };
  createAdminSupabaseClient.mockReturnValue({ from: vi.fn((table) => table === "events" ? eventQuery : query) });
  return query;
}

describe("event RSVP server boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRsvpIdentity.mockResolvedValue({ ...guest, companionLimit: 10 });
    requireAdmin.mockResolvedValue({ userId: "admin" });
  });

  it("rejects a declined response with companions before touching guest identity or storage", async () => {
    await expect(saveGuestRsvp("event-a", { ...input, attending: false })).rejects.toMatchObject({ status: 400 });
    expect(resolveRsvpIdentity).not.toHaveBeenCalled();
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it.each([{ name: " " }, { companions: -1 }, { companions: 2147483648 }, { companions: 1.5 }, { attending: "true" }, { credentials: { method: "invitation", invitationCode: "invalid" } }])(
    "rejects invalid fields %j", async (fields) => {
      await expect(saveGuestRsvp("event-a", { ...input, ...fields })).rejects.toMatchObject({ status: 400 });
      expect(resolveRsvpIdentity).not.toHaveBeenCalled();
    },
  );

  it("blocks saves when guest authorization fails", async () => {
    resolveRsvpIdentity.mockRejectedValue(new Error("inactive or unauthorized"));
    await expect(saveGuestRsvp("event-a", input)).rejects.toThrow("inactive or unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("upserts only the authorized event and guest even if the body supplies other IDs", async () => {
    const query = client({ data: { name: "Ana", attending: true, companions: 2 }, error: null });
    await saveGuestRsvp("event-a", { ...input, eventId: "event-b", guestId: "guest-b" });
    expect(resolveRsvpIdentity).toHaveBeenCalledWith("event-a", input.credentials);
    expect(query.upsert).toHaveBeenCalledWith({
      event_id: "event-a", guest_id: "guest-a", name: "Ana", attending: true, companions: 2,
      companion_names: [],
      updated_at: expect.any(String),
    }, { onConflict: "event_id,guest_id" });
  });

  it("returns only the current guest's RSVP", async () => {
    const query = client({ data: null, error: null });
    await expect(readGuestRsvp("event-a", input.credentials)).resolves.toEqual({ rsvp: null, companionLimit: 10 });
    expect(query.eq.mock.calls).toEqual([["event_id", "event-a"], ["guest_id", "guest-a"]]);
    expect(query.select).toHaveBeenCalledWith("name,attending,companions,companion_names");
  });

  it("does not query RSVPs when the event cannot be recovered", async () => {
    resolveRsvpIdentity.mockRejectedValue(new Error("inactive"));
    await expect(readGuestRsvp("event-a", input.credentials)).rejects.toThrow("inactive");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("reports failed writes instead of claiming confirmation", async () => {
    client({ data: null, error: { code: "42P01" } });
    await expect(saveGuestRsvp("event-a", input)).rejects.toMatchObject({ status: 503 });
  });

  it("rejects companions for zero-capacity events even if a client submits them", async () => {
    const query = client({ data: null, error: null }, 0);
    await expect(saveGuestRsvp("event-a", { ...input, maxCompanions: 100 })).rejects.toMatchObject({ status: 400, message: "Seu convite não permite acompanhantes." });
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("allows a guest to confirm without companions when capacity is zero", async () => {
    const query = client({ data: { name: "Ana", attending: true, companions: 0 }, error: null }, 0);
    await expect(saveGuestRsvp("event-a", { ...input, companions: 0 })).resolves.toMatchObject({ companions: 0 });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ companions: 0 }), { onConflict: "event_id,guest_id" });
  });

  it("returns a validation error when configuration changes during the write", async () => {
    client({ data: null, error: { code: "23514" } });
    await expect(saveGuestRsvp("event-a", input)).rejects.toMatchObject({ status: 400 });
  });

  it("enforces the configured positive limit per guest", async () => {
    const query = client({ data: null, error: null }, 1);
    await expect(saveGuestRsvp("event-a", input)).rejects.toMatchObject({ status: 400 });
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("accepts the configured limit even when it exceeds the previous default", async () => {
    client({ data: { name: "Ana", attending: true, companions: 12 }, error: null }, 12);
    await expect(saveGuestRsvp("event-a", { ...input, companions: 12 })).resolves.toMatchObject({ companions: 12 });
  });

  it("uses the default limit when no limit was configured", async () => {
    const query = client({ data: null, error: null }, null);
    await expect(saveGuestRsvp("event-a", { ...input, companions: 11 })).rejects.toMatchObject({ status: 400 });
    expect(query.upsert).not.toHaveBeenCalled();
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
    await expect(listAdminRsvps("11111111-1111-4111-8111-111111111111", 0)).rejects.toMatchObject({ status: 400 });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
  it("stores normalized companion names for the authorized guest", async () => {
    const query = client({ data: { name: "Ana", attending: true, companions: 2, companion_names: ["João", "Maria"] }, error: null }, 2);
    await expect(saveGuestRsvp("event-a", { ...input, companionNames: [" João ", " Maria "] }))
      .resolves.toMatchObject({ companion_names: ["João", "Maria"] });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ companion_names: ["João", "Maria"] }), { onConflict: "event_id,guest_id" });
  });
  it.each([["João", "Maria", "Pedro"], [" "], ["a".repeat(201)], [null]].map((companionNames) => ({ companionNames })))("rejects invalid companion names $companionNames before authorization", async ({ companionNames }) => {
    await expect(saveGuestRsvp("event-a", { ...input, companionNames })).rejects.toMatchObject({ status: 400 });
    expect(resolveRsvpIdentity).not.toHaveBeenCalled();
  });
  it("returns the individual limit even before a first response", async () => {
    client({ data: null, error: null }, 1);
    await expect(readGuestRsvp("event-a", credentials)).resolves.toEqual({ rsvp: null, companionLimit: 1 });
  });
  it("clears companion names when a guest declines", async () => {
    const query = client({ data: { name: "Ana", attending: false, companions: 0, companion_names: [] }, error: null });
    await saveGuestRsvp("event-a", { ...input, attending: false, companions: 0, companionNames: [] });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ attending: false, companions: 0, companion_names: [] }), { onConflict: "event_id,guest_id" });
  });
});
