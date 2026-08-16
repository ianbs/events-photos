import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeGuest = vi.fn();
const createAdminSupabaseClient = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/guests/guest-service", () => ({ authorizeGuest }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

describe("listGuestPhotos authorization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by the event and guest resolved by server-side authorization", async () => {
    authorizeGuest.mockResolvedValue({
      eventId: "11111111-1111-4111-8111-111111111111",
      guestId: "22222222-2222-4222-8222-222222222222",
      guestToken: "33333333-3333-4333-8333-333333333333",
    });
    const equals = vi.fn();
    const query = {
      eq(column: string, value: string) {
        equals(column, value);
        return this;
      },
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      order() {
        return this;
      },
      select() {
        return this;
      },
    };
    createAdminSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });
    const { listGuestPhotos } = await import("./photo-gallery-service");

    await listGuestPhotos(
      "evento",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(equals).toHaveBeenCalledWith(
      "event_id",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(equals).toHaveBeenCalledWith(
      "guest_id",
      "22222222-2222-4222-8222-222222222222",
    );
  });
});
