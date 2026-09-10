type ZipEntry = {
  fileName: string;
  getData: () => Promise<Blob>;
  modifiedAt: Date;
};

type CentralDirectoryEntry = {
  crc32: number;
  fileName: Uint8Array;
  localHeaderOffset: number;
  size: number;
  zipDate: number;
  zipTime: number;
};

const encoder = new TextEncoder();
const UTF8_WITH_DATA_DESCRIPTOR = 0x0808;
const MAX_ZIP_32_VALUE = 0xffffffff;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function updateCrc32(crc: number, chunk: Uint8Array): number {
  let nextCrc = crc;

  for (const byte of chunk) {
    nextCrc = crcTable[(nextCrc ^ byte) & 0xff] ^ (nextCrc >>> 8);
  }

  return nextCrc >>> 0;
}

function createBytes(length: number, write: (view: DataView) => void) {
  const bytes = new Uint8Array(length);
  write(new DataView(bytes.buffer));
  return bytes;
}

function setUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function setUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function getDosDateTime(date: Date) {
  const year = Math.max(1980, date.getUTCFullYear());

  return {
    zipDate:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
    zipTime:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
  };
}

function createLocalHeader(fileName: Uint8Array, zipDate: number, zipTime: number) {
  const header = createBytes(30, (view) => {
    setUint32(view, 0, 0x04034b50);
    setUint16(view, 4, 20);
    setUint16(view, 6, UTF8_WITH_DATA_DESCRIPTOR);
    setUint16(view, 8, 0);
    setUint16(view, 10, zipTime);
    setUint16(view, 12, zipDate);
    setUint16(view, 26, fileName.length);
  });

  return [header, fileName];
}

function createDataDescriptor(crc32: number, size: number) {
  return createBytes(16, (view) => {
    setUint32(view, 0, 0x08074b50);
    setUint32(view, 4, crc32);
    setUint32(view, 8, size);
    setUint32(view, 12, size);
  });
}

function createCentralDirectoryHeader(entry: CentralDirectoryEntry) {
  const header = createBytes(46, (view) => {
    setUint32(view, 0, 0x02014b50);
    setUint16(view, 4, 20);
    setUint16(view, 6, 20);
    setUint16(view, 8, UTF8_WITH_DATA_DESCRIPTOR);
    setUint16(view, 10, 0);
    setUint16(view, 12, entry.zipTime);
    setUint16(view, 14, entry.zipDate);
    setUint32(view, 16, entry.crc32);
    setUint32(view, 20, entry.size);
    setUint32(view, 24, entry.size);
    setUint16(view, 28, entry.fileName.length);
    setUint32(view, 42, entry.localHeaderOffset);
  });

  return [header, entry.fileName];
}

function createEndOfCentralDirectory(
  entryCount: number,
  directorySize: number,
  directoryOffset: number,
) {
  return createBytes(22, (view) => {
    setUint32(view, 0, 0x06054b50);
    setUint16(view, 8, entryCount);
    setUint16(view, 10, entryCount);
    setUint32(view, 12, directorySize);
    setUint32(view, 16, directoryOffset);
  });
}

export function createStoredZipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const centralDirectory: CentralDirectoryEntry[] = [];
      let outputOffset = 0;

      function enqueue(bytes: Uint8Array) {
        controller.enqueue(bytes);
        outputOffset += bytes.byteLength;
      }

      try {
        for (const entry of entries) {
          const fileName = encoder.encode(entry.fileName);
          const { zipDate, zipTime } = getDosDateTime(entry.modifiedAt);
          const localHeaderOffset = outputOffset;

          for (const bytes of createLocalHeader(fileName, zipDate, zipTime)) {
            enqueue(bytes);
          }

          const blob = await entry.getData();
          const reader = blob.stream().getReader();
          let crc32 = 0xffffffff;
          let size = 0;

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            size += value.byteLength;
            if (size > MAX_ZIP_32_VALUE) {
              throw new Error("ZIP entry exceeds the supported size");
            }
            crc32 = updateCrc32(crc32, value);
            enqueue(value);
          }

          crc32 = (crc32 ^ 0xffffffff) >>> 0;
          enqueue(createDataDescriptor(crc32, size));
          centralDirectory.push({
            crc32,
            fileName,
            localHeaderOffset,
            size,
            zipDate,
            zipTime,
          });
        }

        const directoryOffset = outputOffset;

        for (const entry of centralDirectory) {
          for (const bytes of createCentralDirectoryHeader(entry)) {
            enqueue(bytes);
          }
        }

        const directorySize = outputOffset - directoryOffset;
        if (
          centralDirectory.length > 0xffff ||
          directoryOffset > MAX_ZIP_32_VALUE ||
          directorySize > MAX_ZIP_32_VALUE
        ) {
          throw new Error("ZIP archive exceeds the supported size");
        }

        enqueue(
          createEndOfCentralDirectory(
            centralDirectory.length,
            directorySize,
            directoryOffset,
          ),
        );
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
