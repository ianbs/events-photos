import { describe, expect, it } from "vitest";

import { imageSignatureMatchesMimeType } from "./image-signature";

describe("image signatures", () => {
  it("recognizes JPEG bytes", () => {
    expect(
      imageSignatureMatchesMimeType(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        "image/jpeg",
      ),
    ).toBe(true);
  });

  it("recognizes PNG bytes", () => {
    expect(
      imageSignatureMatchesMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
  });

  it("recognizes WebP bytes", () => {
    expect(
      imageSignatureMatchesMimeType(
        new TextEncoder().encode("RIFF0000WEBP"),
        "image/webp",
      ),
    ).toBe(true);
  });

  it("accepts HEIF-compatible container brands", () => {
    expect(
      imageSignatureMatchesMimeType(
        new Uint8Array([
          0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0,
        ]),
        "image/heic",
      ),
    ).toBe(true);
  });

  it("rejects content that only claims an image MIME type", () => {
    expect(
      imageSignatureMatchesMimeType(
        new TextEncoder().encode("not-an-image"),
        "image/jpeg",
      ),
    ).toBe(false);
  });
});
