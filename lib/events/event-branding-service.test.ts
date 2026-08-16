import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const createAdminSupabaseClient = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

describe("event branding authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockRejectedValue(new Error("unauthorized"));
  });

  it("does not initialize Storage before authorization", async () => {
    const { initializeEventBrandingUpload } = await import(
      "./event-branding-service"
    );

    await expect(
      initializeEventBrandingUpload(
        "11111111-1111-4111-8111-111111111111",
        {
          assetType: "cover",
          fileSize: 1024,
          mimeType: "image/jpeg",
          originalFilename: "cover.jpg",
        },
      ),
    ).rejects.toThrow("unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("does not update an event before authorization", async () => {
    const { finalizeEventBranding } = await import("./event-branding-service");

    await expect(
      finalizeEventBranding("11111111-1111-4111-8111-111111111111", {
        accentColor: "#10b981",
        primaryColor: "#047857",
        removeCover: false,
        removeLogo: false,
        uploadedAssets: [],
      }),
    ).rejects.toThrow("unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
