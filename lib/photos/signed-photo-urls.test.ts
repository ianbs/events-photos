import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseUrls = vi.fn();
const createS3Urls = vi.fn();
const getPhotoStorage = vi.fn((provider: "supabase" | "s3") => ({
  createReadUrls: provider === "supabase" ? createSupabaseUrls : createS3Urls,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/photo-storage", () => ({ getPhotoStorage }));

describe("createSignedPhotoUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseUrls.mockResolvedValue(
      new Map([["event/old.jpg", "https://supabase.test/old"]]),
    );
    createS3Urls.mockResolvedValue(
      new Map([["event/new.jpg", "https://s3.test/new"]]),
    );
  });

  it("signs mixed historical photos with their original provider", async () => {
    const { createSignedPhotoUrls } = await import("./signed-photo-urls");
    const urls = await createSignedPhotoUrls(
      [
        {
          storagePath: "event/old.jpg",
          storageProvider: "supabase",
        },
        { storagePath: "event/new.jpg", storageProvider: "s3" },
      ],
      300,
    );

    expect(createSupabaseUrls).toHaveBeenCalledWith(["event/old.jpg"], 300);
    expect(createS3Urls).toHaveBeenCalledWith(["event/new.jpg"], 300);
    expect(urls).toEqual(
      new Map([
        ["event/old.jpg", "https://supabase.test/old"],
        ["event/new.jpg", "https://s3.test/new"],
      ]),
    );
  });
});
