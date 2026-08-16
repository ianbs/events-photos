import { describe, expect, it } from "vitest";

import {
  createGuestToken,
  getGuestTokenStorageKey,
  guestTokenSchema,
} from "./guest-token";

describe("guest token", () => {
  it("creates a cryptographically generated UUID", () => {
    expect(guestTokenSchema.safeParse(createGuestToken()).success).toBe(true);
  });

  it("scopes browser storage by event", () => {
    expect(getGuestTokenStorageKey("event-a")).not.toBe(
      getGuestTokenStorageKey("event-b"),
    );
  });
});
