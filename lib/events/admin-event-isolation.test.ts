import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const { requireAdmin, createAdminSupabaseClient } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

import { findAdminEventById, listAdminEvents, listAdminEventSummaries, updateAdminEvent, createAdminEvent } from "./admin-event-service";
import { listAdminRsvps, readAdminRsvpSummary } from "./rsvp-service";
import { listRsvpInvitations, createRsvpInvitationBatch } from "./rsvp-invitation-service";
import { findEventDeletionSummary, deleteAdminEventBatch } from "./admin-event-deletion-service";
import { initializeEventMusicUpload, cleanupEventMusicUpload, saveEventMusic } from "./event-music-service";
import { initializeEventBrandingUpload, finalizeEventBranding, cleanupEventBrandingUpload } from "./event-branding-service";
import { createAdminPhotoUrl, deletePhotoAsAdmin, listAdminPhotos } from "../photos/admin-photo-service";
import { createEventPhotoArchive, createSelectedPhotoArchive } from "../photos/admin-photo-archive-service";

const ownerId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const photoId = "33333333-3333-4333-8333-333333333333";
const eventInput = { name: "Festa", slug: "festa", eventDate: "2026-10-19", isActive: true };

// Use the real SDK to verify the actual PostgREST filters sent to the database.
function setup(owned = false) {
  const requests: URL[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = new URL(String(input));
    requests.push(url);
    const table = url.pathname.split("/").at(-1);
    if (table === "events") expect(url.searchParams.get("owner_id")).toBe(`eq.${ownerId}`);
    else if (table === "photos") {
      expect(url.searchParams.get("select")).toContain("events!inner(owner_id)");
      expect(url.searchParams.get("events.owner_id")).toBe(`eq.${ownerId}`);
    } else throw new Error(`Unauthorized downstream request: ${table}`);
    const rows = table === "events" && owned
      ? [{ id: eventId, name: "Festa", slug: "festa", event_date: "2026-10-19" }]
      : [];
    return new Response(options?.method === "HEAD" ? null : JSON.stringify(rows), {
      headers: { "content-type": "application/json", "content-range": `*/${rows.length}` },
    });
  });
  createAdminSupabaseClient.mockReturnValue(createClient("https://isolation.example.com", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
  }));
  return { requests, fetch };
}

describe.each(["admin", "super_admin"])("event ownership for %s", (role) => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ userId: ownerId, role });
  });

  it("lists only owned events and does not query summaries for an empty list", async () => {
    const { requests } = setup();
    await expect(listAdminEvents()).resolves.toEqual([]);
    await expect(listAdminEventSummaries()).resolves.toEqual([]);
    expect(requests).toHaveLength(2);
  });

  it("returns the user's own events", async () => {
    setup(true);
    await expect(listAdminEvents()).resolves.toMatchObject([{ id: eventId, name: "Festa" }]);
  });

  it.each([
    ["read", () => findAdminEventById(eventId)],
    ["update", () => updateAdminEvent(eventId, eventInput)],
    ["invitations", () => listRsvpInvitations(eventId)],
    ["batch invitations", () => createRsvpInvitationBatch(eventId, {})],
    ["responses", () => listAdminRsvps(eventId, 1)],
    ["response summary", () => readAdminRsvpSummary(eventId)],
    ["deletion summary", () => findEventDeletionSummary(eventId)],
    ["event ZIP", () => createEventPhotoArchive(eventId)],
    ["music upload", () => initializeEventMusicUpload(eventId, { originalFilename: "a.mp3", mimeType: "audio/mpeg", fileSize: 100 })],
    ["music save", () => saveEventMusic(eventId, { uploadedMusic: null, removeMusic: true })],
    ["music cleanup", () => cleanupEventMusicUpload(eventId, { path: `${eventId}/${photoId}.mp3`, mimeType: "audio/mpeg", fileSize: 100 })],
    ["branding upload", () => initializeEventBrandingUpload(eventId, { assetType: "cover", originalFilename: "a.png", mimeType: "image/png", fileSize: 100 })],
    ["branding save", () => finalizeEventBranding(eventId, { primaryColor: "#047857", accentColor: "#10b981", uploadedAssets: [], removeCover: true, removeLogo: false })],
    ["branding cleanup", () => cleanupEventBrandingUpload(eventId, { assetType: "cover", path: `${eventId}/cover/${photoId}.png`, mimeType: "image/png", fileSize: 100 })],
    ["open photo", () => createAdminPhotoUrl(photoId, false)],
    ["download photo", () => createAdminPhotoUrl(photoId, true)],
    ["delete photo", () => deletePhotoAsAdmin(photoId)],
    ["selected ZIP", () => createSelectedPhotoArchive([photoId])],
  ])("blocks foreign or ownerless data: %s", async (_name, operation) => {
    const { requests } = setup();
    await expect(operation()).rejects.toMatchObject({ status: 404 });
    expect(requests).toHaveLength(1);
  });

  it("cannot remove files from a foreign event through event deletion", async () => {
    const { requests } = setup();
    await deleteAdminEventBatch(eventId, { confirmation: "Festa" });
    expect(requests).toHaveLength(1);
  });

  it("scopes photo pagination and totals even without an event filter", async () => {
    const { requests } = setup();
    await expect(listAdminPhotos()).resolves.toEqual({ photos: [], nextCursor: null, totalCount: 0 });
    expect(requests).toHaveLength(3);
  });

  it("rejects foreign branding paths before verification or failure cleanup", async () => {
    const { requests } = setup(true);
    await expect(finalizeEventBranding(eventId, {
      primaryColor: "#047857", accentColor: "#10b981", removeCover: false, removeLogo: false,
      uploadedAssets: [{ assetType: "cover", path: `${photoId}/cover/${photoId}.png`, mimeType: "image/png", fileSize: 100 }],
    })).rejects.toMatchObject({ status: 400 });
    expect(requests).toHaveLength(1);
  });

  it("assigns the creator from the authenticated identity, ignoring a forged owner", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      expect(JSON.parse(String(options?.body)).owner_id).toBe(ownerId);
      return new Response(JSON.stringify({ id: eventId, name: "Festa" }), {
        headers: { "content-type": "application/json" },
      });
    });
    createAdminSupabaseClient.mockReturnValue(createClient("https://isolation.example.com", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
    }));
    await createAdminEvent({ ...eventInput, owner_id: eventId, ownerId: eventId });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
