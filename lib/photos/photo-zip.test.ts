import { describe, expect, it } from "vitest";

import { createStoredZipStream } from "./photo-zip";

async function readStream(stream: ReadableStream<Uint8Array>) {
  const response = new Response(stream);
  return new Uint8Array(await response.arrayBuffer());
}

describe("photo ZIP stream", () => {
  it("creates a ZIP archive with UTF-8 names and a central directory", async () => {
    const archive = await readStream(
      createStoredZipStream([
        {
          fileName: "001-foto-á.jpg",
          getData: async () => new Blob([new Uint8Array([1, 2, 3, 4])]),
          modifiedAt: new Date("2026-08-16T12:30:00Z"),
        },
      ]),
    );
    const view = new DataView(archive.buffer);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(archive)).toContain("001-foto-á.jpg");
    expect(view.getUint32(archive.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(archive.length - 12, true)).toBe(1);
  });

  it("creates a valid empty ZIP", async () => {
    const archive = await readStream(createStoredZipStream([]));
    const view = new DataView(archive.buffer);

    expect(archive).toHaveLength(22);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
  });
});
