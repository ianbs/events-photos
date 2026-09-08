import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("S3-compatible photo storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("creates a direct signed PUT without exposing credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("STORAGE_PROVIDER", "s3");
    vi.stubEnv("S3_ENDPOINT", "https://account.r2.cloudflarestorage.com");
    vi.stubEnv("S3_REGION", "auto");
    vi.stubEnv("S3_BUCKET", "event-photos");
    vi.stubEnv("S3_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret-key");

    const { getPhotoStorage } = await import("./photo-storage");
    const upload = await getPhotoStorage("s3").createUpload(
      "event/guest/photo.jpg",
      "image/jpeg",
      1024,
    );

    expect(upload.provider).toBe("s3");
    if (upload.provider !== "s3") {
      throw new Error("Expected an S3 upload");
    }

    const signedUrl = new URL(upload.uploadUrl);
    expect(signedUrl.hostname).toBe(
      "event-photos.account.r2.cloudflarestorage.com",
    );
    expect(signedUrl.pathname).toBe("/event/guest/photo.jpg");
    expect(signedUrl.searchParams.get("X-Amz-Credential")).toContain(
      "access-key",
    );
    expect(upload.uploadUrl).not.toContain("secret-key");
  });
});
