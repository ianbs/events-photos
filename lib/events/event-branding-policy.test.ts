import { describe, expect, it } from "vitest";

import {
  MAX_BRANDING_IMAGE_SIZE_BYTES,
  validateBrandingImage,
} from "./event-branding-policy";

describe("event branding image policy", () => {
  it("accepts supported images within the limit", () => {
    expect(
      validateBrandingImage({
        name: "cover.webp",
        size: 1024,
        type: "image/webp",
      }),
    ).toEqual({ mimeType: "image/webp", valid: true });
  });

  it("rejects executable or unsupported content types", () => {
    expect(
      validateBrandingImage({
        name: "logo.svg",
        size: 1024,
        type: "image/svg+xml",
      }),
    ).toMatchObject({ valid: false });
  });

  it("rejects images above the branding bucket limit", () => {
    expect(
      validateBrandingImage({
        name: "cover.jpg",
        size: MAX_BRANDING_IMAGE_SIZE_BYTES + 1,
        type: "image/jpeg",
      }),
    ).toMatchObject({ valid: false });
  });
});
