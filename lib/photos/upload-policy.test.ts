import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_SIZE_BYTES,
  normalizeOriginalFilename,
  validateImageUpload,
} from "./upload-policy";

describe("image upload policy", () => {
  it("accepts an allowed image within the size limit", () => {
    expect(
      validateImageUpload({
        name: "foto.jpg",
        size: MAX_UPLOAD_SIZE_BYTES,
        type: "image/jpeg",
      }),
    ).toEqual({ valid: true, mimeType: "image/jpeg" });
  });

  it("rejects an unsupported MIME type", () => {
    expect(
      validateImageUpload({
        name: "foto.gif",
        size: 1024,
        type: "image/gif",
      }),
    ).toEqual({ valid: false, message: "Formato de imagem não permitido." });
  });

  it("rejects files above the configured limit", () => {
    expect(
      validateImageUpload({
        name: "foto.png",
        size: MAX_UPLOAD_SIZE_BYTES + 1,
        type: "image/png",
      }),
    ).toEqual({
      valid: false,
      message: "A imagem deve ter no máximo 15 MB.",
    });
  });

  it("normalizes filenames before persistence", () => {
    expect(normalizeOriginalFilename(" ../foto\u0000.jpg ")).toBe(".._foto_.jpg");
  });
});
