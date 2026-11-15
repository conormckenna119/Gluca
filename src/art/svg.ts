// SVG drawing primitives and colour utilities for the artwork engine. Pure string building: no DOM.
// The preview and the exported PNG are produced from the same SVG, so what is previewed is what is exported.

import { formatGlucose, DAY_MS, gapEdges, type Pt, type Stats, type TargetRange, type Unit } from './analytics';

export const FONT_FAMILY = "'GlucaInter', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export const n1 = (v: number): string => (Math.round(v * 10) / 10).toString();

// ---------- colour ----------
export const isValidHex = (s: string): boolean => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
export function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const v = parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const rgbToHex = (c: number[]): string => '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
export function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return rgbToHex(ra.map((x, i) => x + (rb[i] - x) * t));
}
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Nudge `fg` toward black (on light backgrounds) or white (on dark ones) until it reaches `min` contrast against `bg`. */
export function ensureContrast(fg: string, bg: string, min: number): string {
  const toward = luminance(bg) > 0.4 ? '#000000' : '#FFFFFF';
  let c = fg;
  for (let i = 0; i < 20 && contrast(c, bg) < min; i++) c = mix(fg, toward, (i + 1) * 0.05);
  return c;
}

export const SWATCHES = { mint: '#91E6B2', blue: '#76B8FF', lavender: '#C5B3FF', amber: '#FFBD82', white: '#FFFFFF', ink: '#101412' } as const;
export const NEAR_BLACK = '#101412';
export const SURFACE = '#1B231F';
export const PAPER = '#F6F8F6';

export interface Palette {
  transparent: boolean;
  bg0: string; bg1: string;
  text: string; muted: string;
  accent: string;       // fills / lines / large shapes
  accentText: string;   // accent used as text colour (contrast-checked)
  surface: string; surfaceStroke: string;
  band: string; bandOpacity: number;
  shadow: { color: string; opacity: number } | null;
  below: string; above: string;
}

const DIST = ['#76B8FF', '#FFBD82', '#C5B3FF', '#91E6B2'];
function distColors(accent: string, bg: string): [string, string] {
  const dist = (a: string, b: string) => { const x = hexToRgb(a), y = hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const ranked = DIST.map((c) => ({ c, d: dist(c, accent) })).sort((p, q) => q.d - p.d).slice(0, 2).map((x) => x.c);
  const fix = (c: string) => ensureContrast(c, bg, 3);
  return [fix(ranked[0]), fix(ranked[1])];
}

export function buildPalette(theme: 'dark' | 'light', accentIn: string, transparent: boolean): Palette {
  const accent = isValidHex(accentIn) ? accentIn : SWATCHES.mint;
  if (transparent) {
    const light = luminance(accent) > 0.35;
    const [below, above] = distColors(accent, light ? '#000000' : '#FFFFFF');
    return {
      transparent: true, bg0: 'none', bg1: 'none', text: accent, muted: accent, accent, accentText: accent,
      surface: 'none', surfaceStroke: accent, band: accent, bandOpacity: 0.16,
      shadow: { color: light ? '#000000' : '#FFFFFF', opacity: light ? 0.5 : 0.45 }, below, above,
    };
  }
  if (theme === 'dark') {
    const [below, above] = distColors(accent, NEAR_BLACK);
    return {
      transparent: false, bg0: NEAR_BLACK, bg1: SURFACE, text: '#FFFFFF', muted: '#B9C2BD',
      accent: ensureContrast(accent, NEAR_BLACK, 3), accentText: ensureContrast(accent, NEAR_BLACK, 4.5),
      surface: '#222C27', surfaceStroke: '#FFFFFF', band: accent, bandOpacity: 0.12, shadow: null, below, above,
    };
  }
  const [below, above] = distColors(accent, PAPER);
  return {
    transparent: false, bg0: PAPER, bg1: '#E6EDE8', text: NEAR_BLACK, muted: '#47524C',
    accent: ensureContrast(accent, PAPER, 3), accentText: ensureContrast(accent, PAPER, 4.5),
    surface: '#FFFFFF', surfaceStroke: '#101412', band: ensureContrast(accent, PAPER, 3), bandOpacity: 0.16, shadow: null, below, above,
  };
}

// ---------- text ----------
export type Measure = (text: string, size: number, weight: number) => number;
/** Rough Inter width model, used when no real measurer is supplied (tests, server). The browser app passes a canvas measurer. */
export const approxMeasure: Measure = (t, size, weight) => t.length * size * (weight >= 700 ? 0.6 : 0.56);

export function wrapText(text: string, maxW: number, size: number, weight: number, measure: Measure): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    const flush = () => { if (line) out.push(line); line = ''; };
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (measure(trial, size, weight) <= maxW) { line = trial; continue; }
      flush();
      if (measure(w, size, weight) <= maxW) { line = w; continue; }
      // a single word wider than the box: break it by characters
      let chunk = '';
      for (const ch of w) {
        if (measure(chunk + ch, size, weight) > maxW && chunk) { out.push(chunk); chunk = ch; } else chunk += ch;
      }
      line = chunk;
    }
    flush();
  }
  return out;
}

export interface Fitted { lines: string[]; size: number }

/** Re-wrap at the narrowest width that keeps the same number of lines, so lines come out even instead of leaving a lone last word. */
function balanced(text: string, maxW: number, size: number, weight: number, measure: Measure, lines: string[]): string[] {
  if (lines.length < 2) return lines;
  const widest = Math.max(...text.split(/\s+/).map((w) => measure(w, size, weight)));
  let lo = Math.min(maxW, Math.max(maxW * 0.35, widest)), hi = maxW;  // never narrower than the longest word
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrapText(text, mid, size, weight, measure).length <= lines.length) hi = mid; else lo = mid;
  }
  return wrapText(text, hi, size, weight, measure);
}

/** Largest size (down to `min`) at which the text fits in `maxLines` (balanced across lines); at `min` it is truncated with an ellipsis. */
export function fitText(text: string, o: { maxW: number; maxLines: number; size: number; min: number; weight: number; measure: Measure }): Fitted {
  let size = o.size;
  for (; size >= o.min; size -= 2) {
    // shrink until every word fits on a line by itself, so a word is only ever split at the size floor
    if (text.split(/\s+/).some((w) => o.measure(w, size, o.weight) > o.maxW) && size > o.min) continue;
    const lines = wrapText(text, o.maxW, size, o.weight, o.measure);
    if (lines.length <= o.maxLines) return { lines: balanced(text, o.maxW, size, o.weight, o.measure, lines), size };
  }
  size = o.min;
  const lines = wrapText(text, o.maxW, size, o.weight, o.measure).slice(0, o.maxLines);
  const last = lines.length - 1;
  let t = lines[last] ?? '';
  while (t.length > 1 && o.measure(t + '…', size, o.weight) > o.maxW) t = t.slice(0, -1);
  lines[last] = t.replace(/[\s.,;:!?-]+$/, '') + '…';
  return { lines, size };
}

export interface TextOpts { size: number; weight?: number; fill: string; anchor?: 'start' | 'middle' | 'end'; ls?: number; opacity?: number; shadow?: boolean }
export function text(x: number, y: number, s: string, o: TextOpts): string {
  return `<text x="${n1(x)}" y="${n1(y)}" font-size="${o.size}" font-weight="${o.weight ?? 700}" fill="${o.fill}"${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.opacity !== undefined && o.opacity !== 1 ? ` fill-opacity="${o.opacity}"` : ''}${o.shadow ? ' filter="url(#sh)"' : ''}>${esc(s)}</text>`;
}
/** Multi-line block. `yTop` is the top of the first line box. Returns markup and total height. */
export function block(lines: string[], x: number, yTop: number, o: TextOpts & { lh?: number }): { svg: string; h: number } {
  const lh = o.lh ?? 1.1;
  const svg = lines.map((l, i) => text(x, yTop + o.size * 0.82 + i * o.size * lh, l, o)).join('');
  return { svg, h: lines.length * o.size * lh };
}

// ---------- chart ----------
export interface ChartOpts {
  x: number; y: number; w: number; h: number;
  start: number; end: number;
  segs: Pt[][];
  stats: Stats;
  range: TargetRange; unit: Unit;
  p: Palette;
  stroke: string;              // colour or url(#gradient)
  strokeW: number;
  glow: boolean;
  showBand: boolean; showAxis: boolean;
  gradientStops?: string[];    // when set, a horizontal gradient is defined as #lg
  weekLabels?: boolean;
  /** Logged events in wall-clock time. Drawn as icon badges in a lane above the plot; labels are never drawn. */
  events?: ArtEvent[];
}

export type ArtEventKind = 'meal' | 'activity' | 'note';
/** An event in the artwork's wall-clock time. `label` is carried for the app but never drawn. */
export interface ArtEvent { kind: ArtEventKind; t: number; durationMin: number; label?: string }
export interface EventBadge { kind: ArtEventKind; cx: number; cy: number; px: number; row: number; barX0: number; barX1: number }
export interface EventLane { badges: EventBadge[]; laneH: number; counts: Record<ArtEventKind, number> }

export const EVENT_R = 22;               // badge radius
const EVENT_GAP = 6;                     // space between badges
const EVENT_ROW = EVENT_R * 2 + EVENT_GAP + 2;
const EVENT_BAR_STRIP = 14;              // strip between the badges and the plot top for activity duration bars
const EVENT_MAX_ROWS = 3;

/**
 * Where event badges go. Only events whose start lies inside [start, end) are used. Badges sit in a lane above the plot
 * (so never on the trace, the range labels or the right gutter), centred on their time but kept inside [x, x + w] and
 * nudged apart (or stacked into more rows) so they never overlap. `cy` is measured from the top of the chart box.
 */
export function layoutEvents(events: readonly ArtEvent[] | undefined, start: number, end: number, x: number, w: number): EventLane | null {
  const inside = (events ?? []).filter((e) => Number.isFinite(e.t) && e.t >= start && e.t < end).sort((a, b) => a.t - b.t);
  if (!inside.length || w < EVENT_R * 2) return null;
  const D = EVENT_R * 2 + EVENT_GAP;
  const cap = Math.floor((w - EVENT_R * 2) / D) + 1;
  const rows = Math.min(EVENT_MAX_ROWS, Math.ceil(inside.length / cap));
  const used = inside.slice(0, rows * cap);
  const pxOf = (t: number) => x + ((t - start) / (end - start)) * w;
  const laneH = rows * EVENT_ROW + EVENT_BAR_STRIP;
  const badges: EventBadge[] = [];
  for (let r = 0; r < rows; r++) {
    const row = used.filter((_, i) => i % rows === r);
    const cs = row.map((e) => Math.min(x + w - EVENT_R, Math.max(x + EVENT_R, pxOf(e.t))));
    for (let i = 1; i < cs.length; i++) cs[i] = Math.max(cs[i], cs[i - 1] + D);
    const over = cs.length ? cs[cs.length - 1] - (x + w - EVENT_R) : 0;
    if (over > 0) { cs[cs.length - 1] -= over; for (let i = cs.length - 2; i >= 0; i--) cs[i] = Math.min(cs[i], cs[i + 1] - D); }
    const cy = laneH - EVENT_BAR_STRIP - EVENT_GAP / 2 - EVENT_R - r * EVENT_ROW;
    row.forEach((e, i) => {
      const px = pxOf(e.t);
      const bx1 = e.kind === 'activity' && e.durationMin > 0 ? Math.min(x + w, pxOf(Math.min(end, e.t + e.durationMin * 60000))) : px;
      badges.push({ kind: e.kind, cx: cs[i], cy, px, row: r, barX0: px, barX1: bx1 });
    });
  }
  const counts: Record<ArtEventKind, number> = { meal: 0, activity: 0, note: 0 };
  for (const b of badges) counts[b.kind]++;
  return { badges, laneH, counts };
}

/** Original icons on a 24x24 grid, drawn in `ink` with round caps. */
function eventIcon(kind: ArtEventKind, ink: string): string {
  const st = `fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
  if (kind === 'meal') return `<path d="M6.5 4.5V9.5Q6.5 11.5 8.5 11.5Q10.5 11.5 10.5 9.5V4.5M8.5 4.5V19.5M16.5 19.5V4.5Q13.8 6.5 13.8 11.5H16.5" ${st}/>`;
  if (kind === 'activity') return `<circle cx="14.6" cy="5.2" r="1.9" fill="${ink}"/><path d="M13.6 9.4L10.8 13.2L14 15.6L12.4 20M14.3 15.8L18 19M8.2 11.4L11.6 9.6L15.8 9.8L17.8 12.4" ${st}/>`;
  return `<path d="M7 4.5H14L17.5 8V19.5H7ZM14 4.5V8H17.5M9.6 12.5H15M9.6 15.6H13.6" ${st}/>`;
}

function eventsSvg(lane: EventLane, o: { x: number; y: number; w: number; plotTop: number; p: Palette }): string {
  const { p } = o;
  const sh = p.shadow ? ' filter="url(#sh)"' : '';
  const ink = peakColor(p);
  let s = '';
  for (const b of lane.badges) {
    const cy = o.y + b.cy;
    if (b.kind === 'activity' && b.barX1 - b.barX0 > 0.5) s += `<rect x="${n1(b.barX0)}" y="${n1(o.plotTop - 10)}" width="${n1(b.barX1 - b.barX0)}" height="6" rx="3" fill="${p.accent}" fill-opacity="0.9"${sh}/>`;
    if (b.row === 0) s += `<line x1="${n1(b.cx)}" y1="${n1(cy + EVENT_R)}" x2="${n1(b.px)}" y2="${n1(o.plotTop - 10)}" stroke="${p.accent}" stroke-opacity="0.7" stroke-width="2" stroke-linecap="round"${sh}/>`;
  }
  for (const b of lane.badges) {
    const cy = o.y + b.cy;
    s += `<g data-ev="${b.kind}" data-b="${n1(b.cx)},${n1(cy)},${EVENT_R}"${sh}><circle cx="${n1(b.cx)}" cy="${n1(cy)}" r="${EVENT_R}" fill="${p.accent}"/><g transform="translate(${n1(b.cx - 15.6)},${n1(cy - 15.6)}) scale(1.3)">${eventIcon(b.kind, ink)}</g></g>`;
  }
  return s;
}

/** The "What's on this image" line for drawn events, e.g. "Logged events: 2 meals, 1 activity, 1 note (icons only, no text)". */
export function eventsContentLine(c: Record<ArtEventKind, number>): string | null {
  const parts: string[] = [];
  if (c.meal) parts.push(`${c.meal} ${c.meal === 1 ? 'meal' : 'meals'}`);
  if (c.activity) parts.push(`${c.activity} ${c.activity === 1 ? 'activity' : 'activities'}`);
  if (c.note) parts.push(`${c.note} ${c.note === 1 ? 'note' : 'notes'}`);
  return parts.length ? `Logged events: ${parts.join(', ')} (icons only, no text)` : null;
}

const RANGE_LABEL_SIZE = 24;
/** Width reserved right of the plot for the two target labels, so they never sit on the trace. 0 when the band is off. */
export function rangeGutter(o: Pick<ChartOpts, 'showBand' | 'range' | 'unit'>): number {
  if (!o.showBand) return 0;
  const chars = Math.max(formatGlucose(o.range.high, o.unit).length, formatGlucose(o.range.low, o.unit).length);
  return Math.ceil(chars * RANGE_LABEL_SIZE * 0.62 + 18);
}

export function chartSvg(o: ChartOpts): { svg: string; axisH: number; events: Record<ArtEventKind, number> } {
  const { x, start, end, p } = o;
  const gutter = rangeGutter(o);
  const w = o.w - gutter; // plot width; the target labels live in the gutter to the right
  // With events, the top of the chart box becomes an icon lane and the plot shrinks to what is below it; without, nothing changes.
  const lane = layoutEvents(o.events, start, end, x, w);
  const y = o.y + (lane ? lane.laneH : 0), h = o.h - (lane ? lane.laneH : 0);
  const lo = Math.max(20, Math.min(50, (o.stats.min ?? o.range.low) - 8));
  const hi = Math.min(420, Math.max(240, (o.stats.max ?? o.range.high) + 10));
  const px = (t: number) => x + ((t - start) / (end - start)) * w;
  const py = (v: number) => y + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * h;
  const lab = RANGE_LABEL_SIZE;
  const sh = p.shadow ? ' filter="url(#sh)"' : '';
  let s = '';
  if (o.gradientStops) {
    const st = o.gradientStops;
    s += `<defs><linearGradient id="lg" gradientUnits="userSpaceOnUse" x1="${x}" y1="0" x2="${x + w}" y2="0">${st.map((c, i) => `<stop offset="${(i / (st.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;
  }
  if (o.showBand) {
    const yh = py(o.range.high), yl = py(o.range.low);
    s += `<rect x="${x}" y="${n1(yh)}" width="${w}" height="${n1(yl - yh)}" rx="10" fill="${p.band}" fill-opacity="${p.bandOpacity}"/>`;
    for (const yy of [yh, yl]) s += `<line x1="${x}" y1="${n1(yy)}" x2="${x + w}" y2="${n1(yy)}" stroke="${p.band}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/>`;
    // labels sit in the gutter right of the plot, centred on their lines; if the band is very short they are pushed apart so they never overlap
    const half = lab * 0.36;
    let ty1 = yh + half, ty2 = yl + half;
    if (ty2 - ty1 < lab + 2) { const mid = (ty1 + ty2) / 2; ty1 = mid - (lab + 2) / 2; ty2 = mid + (lab + 2) / 2; }
    s += text(x + o.w, ty1, formatGlucose(o.range.high, o.unit), { size: lab, weight: 600, fill: p.muted, anchor: 'end', shadow: !!p.shadow });
    s += text(x + o.w, ty2, formatGlucose(o.range.low, o.unit), { size: lab, weight: 600, fill: p.muted, anchor: 'end', shadow: !!p.shadow });
  }
  // "no data" markers: dashed edges around each gap. Gaps are never bridged or interpolated.
  for (const [a, b] of gapEdges(o.segs)) {
    for (const t of [a, b]) s += `<line x1="${n1(px(t))}" y1="${y}" x2="${n1(px(t))}" y2="${y + h}" stroke="${p.muted}" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="4 8"${sh}/>`;
  }
  const d = o.segs.filter((g) => g.length > 1).map((g) => 'M' + g.map((q) => `${n1(px(q.t))} ${n1(py(q.v))}`).join('L')).join(' ');
  const dots = o.segs.filter((g) => g.length === 1).map((g) => `<circle cx="${n1(px(g[0].t))}" cy="${n1(py(g[0].v))}" r="${o.strokeW / 2}" fill="${o.stroke}"/>`).join('');
  if (o.glow && !p.transparent && d) s += `<path d="${d}" fill="none" stroke="${o.stroke}" stroke-width="${o.strokeW * 2.4}" stroke-linecap="round" stroke-linejoin="round" opacity="0.5" filter="url(#bl)"/>`;
  s += `<path d="${d}" fill="none" stroke="${o.stroke}" stroke-width="${o.strokeW}" stroke-linecap="round" stroke-linejoin="round"${sh}/>${dots}`;

  let axisH = 0;
  if (o.showAxis) {
    axisH = 52;
    const ty = y + h + 38;
    const days = Math.round((end - start) / DAY_MS);
    if (days <= 1) {
      const ticks: Array<[number, string]> = [[0, '12a'], [6, '6a'], [12, '12p'], [18, '6p'], [24, '12a']];
      for (const [hr, l] of ticks) {
        const tx = x + (hr / 24) * w;
        s += text(tx, ty, l, { size: lab, weight: 600, fill: p.muted, anchor: hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle', shadow: !!p.shadow });
      }
    } else {
      const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      for (let i = 0; i < days; i++) {
        const t0 = start + i * DAY_MS;
        const cx = x + ((i + 0.5) / days) * w;
        if (i > 0) s += `<line x1="${n1(px(t0))}" y1="${y}" x2="${n1(px(t0))}" y2="${y + h}" stroke="${p.muted}" stroke-opacity="0.18" stroke-width="2"/>`;
        s += text(cx, ty, WD[new Date(t0).getUTCDay()], { size: days > 8 ? 18 : lab - 2, weight: 600, fill: p.muted, anchor: 'middle', ls: 1, shadow: !!p.shadow });
      }
    }
  }
  if (lane) s += eventsSvg(lane, { x, y: o.y, w, plotTop: y, p });
  return { svg: s, axisH, events: lane ? lane.counts : { meal: 0, activity: 0, note: 0 } };
}

// ---------- distribution bar (below / in range / above), labelled so colour is never the only signal ----------
export function distributionBar(x: number, y: number, w: number, pct: [number, number, number], p: Palette, labelSize: number): { svg: string; h: number } {
  const [below, inr, above] = pct;
  const barH = 22, gap = 4;
  const total = Math.max(1, below + inr + above);
  const usable = w - gap * 2;
  const widths = [below, inr, above].map((v) => (v / total) * usable);
  const colors = [p.below, p.accent, p.above];
  let cx = x, s = '';
  widths.forEach((ww, i) => {
    if (ww > 0.5) s += `<rect x="${n1(cx)}" y="${y}" width="${n1(ww)}" height="${barH}" rx="${barH / 2}" fill="${colors[i]}"${p.shadow ? ' filter="url(#sh)"' : ''}/>`;
    cx += ww + gap;
  });
  const names = ['Below', 'In range', 'Above'];
  const vals = [below, inr, above];
  const colW = w / 3;
  names.forEach((nm, i) => {
    const lx = x + i * colW;
    s += `<circle cx="${lx + 9}" cy="${y + barH + 34}" r="9" fill="${colors[i]}"${p.shadow ? ' filter="url(#sh)"' : ''}/>`;
    s += text(lx + 28, y + barH + 34 + labelSize * 0.36, `${nm} ${vals[i]}%`, { size: labelSize, weight: 700, fill: p.text, shadow: !!p.shadow });
  });
  return { svg: s, h: barH + 56 };
}

// ---------- brand mark ----------
export const DROP_PATH = 'M18 2 C28 16 34 24 34 32 a16 16 0 0 1 -32 0 C2 24 8 16 18 2 Z';
/** The single-peak line across the lower half of the drop, on the same 36x36 grid. Stroke it ~2.6 wide with round caps and joins. */
export const PEAK_PATH = 'M6.5 25.5 H12 L15.6 17.6 Q18 12.6 20.4 17.6 L24 25.5 H29.5';
export const PEAK_STROKE = 2.6;
/** Peak colour that contrasts with the drop fill: the artwork background when opaque, near-black when transparent (white if the fill is itself near-black). */
export function peakColor(p: Palette): string {
  const c = p.transparent ? NEAR_BLACK : p.bg0;
  return contrast(c, p.accent) >= 3 ? c : contrast(NEAR_BLACK, p.accent) >= contrast('#FFFFFF', p.accent) ? NEAR_BLACK : '#FFFFFF';
}
export function brandMark(x: number, y: number, name: string, size: number, p: Palette, anchor: 'start' | 'middle' = 'start'): { svg: string; w: number } {
  const s = size / 44;
  const textW = name.length * size * 0.56;
  const w = 46 * s + textW;
  const ox = anchor === 'middle' ? x - w / 2 : x;
  const sh = p.shadow ? ' filter="url(#sh)"' : '';
  return {
    w,
    svg: `<g transform="translate(${n1(ox)},${n1(y)}) scale(${s.toFixed(3)})"${sh}><path d="${DROP_PATH}" fill="${p.accent}"/>` +
      `<path d="${PEAK_PATH}" fill="none" stroke="${peakColor(p)}" stroke-width="${PEAK_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<text x="46" y="38" font-size="44" font-weight="800" letter-spacing="-1" fill="${p.text}">${esc(name)}</text></g>`,
  };
}
