/** Canvas-relative center and uniform scale; independent of data, template and photo. */
export interface OverlayTransform {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: 0; // Reserved. Rotation is deliberately unsupported for now.
}
export const DEFAULT_OVERLAY: OverlayTransform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  opacity: 1,
  rotation: 0,
};
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 1.5;
const finite = (v: number, fallback: number) =>
  Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export function normalizeOverlay(t: OverlayTransform): OverlayTransform {
  const scale = clamp(finite(t.scale, 1), MIN_SCALE, MAX_SCALE);
  // Keep the center inside the canvas. Edges may intentionally crop; the group
  // and its clamped editing handles can never be lost outside the canvas.
  const margin = 0.1;
  return {
    x: clamp(finite(t.x, 0.5), margin, 1 - margin),
    y: clamp(finite(t.y, 0.5), margin, 1 - margin),
    scale,
    opacity: clamp(finite(t.opacity, 1), 0.2, 1),
    rotation: 0,
  };
}
export function moveOverlay(t: OverlayTransform, dx: number, dy: number) {
  return normalizeOverlay({ ...t, x: t.x + dx, y: t.y + dy });
}
export function scaleOverlay(t: OverlayTransform, ratio: number) {
  return normalizeOverlay({ ...t, scale: t.scale * finite(ratio, 1) });
}
export function overlayBounds(t: OverlayTransform, w: number, h: number) {
  const n = normalizeOverlay(t);
  return {
    left: (n.x - n.scale / 2) * w,
    top: (n.y - n.scale / 2) * h,
    width: n.scale * w,
    height: n.scale * h,
  };
}
/** Wrap only the foreground SVG. Background photography stays in the separate photo layer.
 * Root dimensions/viewBox and alpha remain intact. Both preview and export call this.
 */
export function transformOverlaySvg(
  svg: string,
  w: number,
  h: number,
  t: OverlayTransform,
) {
  const n = normalizeOverlay(t),
    b = overlayBounds(n, w, h);
  // Source disclosure is a safety label, not an editable caption. Keep it at
  // full opacity in its original footer position when the group moves/crops.
  const disclosure =
    svg.match(/<g id="source-disclosure">[\s\S]*?<\/g>/)?.[0] ?? "";
  svg = svg.replace(disclosure, "");
  const start = svg.indexOf(">", svg.indexOf("<svg")) + 1;
  const end = svg.lastIndexOf("</svg>");
  if (!start || end < start) throw new Error("Invalid story SVG.");
  return `${svg.slice(0, start)}<g transform="translate(${b.left} ${b.top}) scale(${n.scale})" opacity="${n.opacity}">${svg.slice(start, end)}</g>${disclosure}${svg.slice(end)}`;
}
