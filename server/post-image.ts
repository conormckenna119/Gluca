import { crc32, inflateSync } from "node:zlib";
/** Accept only bounded, complete RGB/RGBA PNG exports. Never decode arbitrary uploads. */
export function exportedPng(data: unknown) {
  if (
    typeof data !== "string" ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data) ||
    data.length > 12 * 1024 * 1024
  )
    throw new Error("Choose a PNG export smaller than 9 MB.");
  const bytes = Buffer.from(data.slice(22), "base64");
  if (
    bytes.toString("base64") !== data.slice(22) ||
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new Error("Invalid PNG.");
  let offset = 8,
    width = 0,
    height = 0,
    channels = 0,
    ended = false;
  const compressed: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset),
      end = offset + size + 12;
    if (end > bytes.length) throw new Error("Incomplete PNG.");
    const type = bytes.toString("ascii", offset + 4, offset + 8),
      payload = bytes.subarray(offset + 8, end - 4);
    if (
      crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)
    )
      throw new Error("Invalid PNG checksum.");
    if (offset === 8 && type !== "IHDR") throw new Error("Missing PNG header.");
    if (type === "IHDR") {
      if (width || size !== 13) throw new Error("Invalid PNG header.");
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      channels = payload[9] === 6 ? 4 : payload[9] === 2 ? 3 : 0;
      if (
        width !== 1080 ||
        ![1080, 1350, 1920].includes(height) ||
        payload[8] !== 8 ||
        !channels ||
        payload[10] ||
        payload[11] ||
        payload[12]
      )
        throw new Error("Unsupported PNG export.");
    }
    if (type === "IDAT") compressed.push(payload);
    if (type === "IEND") {
      if (size || end !== bytes.length) throw new Error("Invalid PNG end.");
      ended = true;
      break;
    }
    offset = end;
  }
  if (!ended || !compressed.length) throw new Error("Incomplete PNG.");
  const row = width * channels + 1,
    expected = row * height;
  const decoded = inflateSync(Buffer.concat(compressed), {
    maxOutputLength: expected,
  });
  if (decoded.length !== expected) throw new Error("Incomplete PNG pixels.");
  for (let y = 0; y < height; y++)
    if (decoded[y * row] > 4) throw new Error("Invalid PNG filter.");
  return { bytes, width, height };
}
