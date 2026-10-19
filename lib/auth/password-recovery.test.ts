import { describe, expect, it } from "vitest";
import { newPasswordSchema, readRecoveryCredentials } from "./password-recovery";

describe("password recovery", () => {
  it("requires a matching password of at least twelve characters", () => {
    expect(newPasswordSchema.safeParse({ password: "short", confirmation: "short" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "a-strong-password", confirmation: "different" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "a-strong-password", confirmation: "a-strong-password" }).success).toBe(true);
  });

  it("accepts recovery and invitation sessions from default Supabase email links", () => {
    for (const type of ["recovery", "invite"]) {
      expect(readRecoveryCredentials(new URL("https://example.com/admin/reset-password#access_token=access&refresh_token=refresh&type=" + type))).toEqual({
        kind: "session", accessToken: "access", refreshToken: "refresh",
      });
    }
  });

  it("supports token hashes from a custom email template", () => {
    expect(readRecoveryCredentials(new URL("https://example.com/admin/reset-password?token_hash=token&type=recovery"))).toEqual({
      kind: "token", tokenHash: "token", type: "recovery",
    });
  });

  it("rejects expired, incomplete and unrelated authentication callbacks", () => {
    for (const suffix of [
      "#error=access_denied&error_code=otp_expired",
      "#access_token=access&type=recovery",
      "#access_token=access&refresh_token=refresh&type=signup",
      "?code=unusable-pkce-code",
      "?token_hash=token&type=signup",
    ]) {
      expect(readRecoveryCredentials(new URL("https://example.com/admin/reset-password" + suffix))).toEqual({ kind: "invalid" });
    }
  });

  it("distinguishes a clean URL so an authenticated user can resume after refresh", () => {
    expect(readRecoveryCredentials(new URL("https://example.com/admin/reset-password"))).toEqual({ kind: "none" });
  });
});
