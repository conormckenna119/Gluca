// Tiny PNG evidence helper for canvas/Playwright RGB(A) exports; no product dependency or private fixtures.
import { inflateSync, deflateSync, crc32 } from "node:zlib";
export function photoFixture(width: number, height: number, rgb: number[]) {
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type),
      size = Buffer.alloc(4),
      crc = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([size, t, data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * (width * 4 + 1) + 1 + x * 4;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
      raw[p + 3] = 255;
    }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export function pngProof(buffer: Buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error("Not a PNG");
  const width = buffer.readUInt32BE(16),
    height = buffer.readUInt32BE(20),
    type = buffer[25],
    channels = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (buffer[24] !== 8 || !channels || buffer[28] !== 0)
    throw new Error("Expected non-interlaced 8-bit RGB(A) PNG");
  const parts: Buffer[] = [];
  for (let p = 8; p < buffer.length;) {
    const size = buffer.readUInt32BE(p),
      name = buffer.toString("ascii", p + 4, p + 8);
    if (name === "IDAT") parts.push(buffer.subarray(p + 8, p + 8 + size));
    p += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(parts)),
    stride = width * channels;
  let previous = Buffer.alloc(stride),
    at = 0,
    transparent = 0,
    white = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[at++],
      row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0,
        b = previous[x],
        c = x >= channels ? previous[x - channels] : 0,
        p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const prediction =
        filter === 0
          ? 0
          : filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? Math.floor((a + b) / 2)
                : filter === 4
                  ? pa <= pb && pa <= pc
                    ? a
                    : pb <= pc
                      ? b
                      : c
                  : NaN;
      if (!Number.isFinite(prediction)) throw new Error("Invalid PNG filter");
      row[x] = (raw[at++] + prediction) & 255;
    }
    for (let x = 0; x < stride; x += channels) {
      const alpha = channels === 4 ? row[x + 3] : 255;
      if (!alpha) transparent++;
      if (alpha > 240 && row[x] > 240 && row[x + 1] > 240 && row[x + 2] > 240)
        white++;
    }
    previous = row;
  }
  return { width, height, transparent, white, pixels: width * height };
}
