// Cover-fit rectangle maths for drawing a photo behind artwork.
// Returns the source crop (centre) that fills the target exactly.
export type CoverRect = { sx: number; sy: number; sw: number; sh: number };

export function coverFit(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CoverRect {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0)
    return { sx: 0, sy: 0, sw: Math.max(srcW, 0), sh: Math.max(srcH, 0) };
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    // Wider than target: crop the sides.
    const sw = srcH * dstRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  // Taller than (or same ratio as) target: crop top and bottom.
  const sh = srcW / dstRatio;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}
