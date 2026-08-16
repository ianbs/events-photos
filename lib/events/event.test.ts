import { describe, expect, it } from "vitest";

import { isEventActive } from "./event";

describe("event rules", () => {
  it("recognizes an active event", () => {
    expect(isEventActive({ isActive: true })).toBe(true);
  });

  it("rejects an inactive event", () => {
    expect(isEventActive({ isActive: false })).toBe(false);
  });
});
