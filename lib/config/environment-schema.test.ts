import { describe, expect, it } from "vitest";

import {
  parseAdminEnvironment,
  parsePublicEnvironment,
  parseServerEnvironment,
} from "./environment-schema";

const validPublicEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-key",
};

describe("environment configuration", () => {
  it("accepts valid public configuration", () => {
    expect(parsePublicEnvironment(validPublicEnvironment)).toEqual(
      validPublicEnvironment,
    );
  });

  it("coerces the upload limit to a number", () => {
    const environment = parseServerEnvironment({
      ...validPublicEnvironment,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      MAX_UPLOAD_SIZE_MB: "15",
    });

    expect(environment.MAX_UPLOAD_SIZE_MB).toBe(15);
  });

  it("applies safe server defaults for local development", () => {
    const environment = parseServerEnvironment(validPublicEnvironment);

    expect(environment.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(environment.MAX_UPLOAD_SIZE_MB).toBe(15);
    expect(environment.STORAGE_PROVIDER).toBe("supabase");
    expect(environment.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it("rejects unsafe or malformed configuration", () => {
    expect(() =>
      parseServerEnvironment({
        ...validPublicEnvironment,
        NEXT_PUBLIC_APP_URL: "not-a-url",
        MAX_UPLOAD_SIZE_MB: "0",
      }),
    ).toThrow(
      "Invalid environment configuration: NEXT_PUBLIC_APP_URL, MAX_UPLOAD_SIZE_MB",
    );
  });

  it("requires the service role key only at the admin boundary", () => {
    expect(() =>
      parseAdminEnvironment({
        ...validPublicEnvironment,
        SUPABASE_SECRET_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow("Invalid environment configuration: SUPABASE_SECRET_KEY");
  });

  it("accepts a modern secret key at the admin boundary", () => {
    const environment = parseAdminEnvironment({
      ...validPublicEnvironment,
      SUPABASE_SECRET_KEY: "sb_secret_test-key",
    });

    expect(environment.SUPABASE_ADMIN_KEY).toBe("sb_secret_test-key");
  });

  it("requires complete S3 credentials when S3 is selected", () => {
    expect(() =>
      parseServerEnvironment({
        ...validPublicEnvironment,
        STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      }),
    ).toThrow(
      "Invalid environment configuration: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY",
    );
  });

  it("accepts an S3-compatible storage configuration", () => {
    const environment = parseServerEnvironment({
      ...validPublicEnvironment,
      STORAGE_PROVIDER: "s3",
      S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      S3_REGION: "auto",
      S3_BUCKET: "event-photos",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      S3_FORCE_PATH_STYLE: "true",
    });

    expect(environment).toMatchObject({
      STORAGE_PROVIDER: "s3",
      S3_BUCKET: "event-photos",
      S3_FORCE_PATH_STYLE: true,
    });
  });
});
