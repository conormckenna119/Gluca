// The six share templates. Each builds an SVG string at an exact pixel size.
// The same SVG feeds the on-screen preview and the PNG export, so what you preview is what you export.
//
// Rules baked in here:
//  - Only data the person selected is drawn. Every drawn element is also listed in `contents` ("what's on this image").
//  - Gaps in data stay gaps. Incomplete periods carry an automatic "based on X%" note unless the person removes it.
//  - Demo data always carries a "DEMO DATA" label. It cannot be switched off.
//  - Essential content stays inside the format's safe area (250 px top/bottom for Stories).
//  - No colour (red/green) is used to signal "good" or "bad" results; below/in/above are also labelled in words.

import { DAY_MS, formatGlucose, percents3, periodLabel, unitLabel, type Pt, type Stats, type TargetRange, type Unit } from './analytics';
import { BRAND } from './brand';
import { FONT_FACES } from './font-data';
import { FORMATS, type FormatId } from './formats';
import {
  FONT_FAMILY, NEAR_BLACK, SWATCHES, approxMeasure, block, brandMark, buildPalette, chartSvg, distributionBar, ensureContrast, esc,
  eventsContentLine, fitText, luminance, n1, text, type ArtEvent, type Measure, type Palette,
} from './svg';
import type { TemplateId } from './telemetry';

export const TEMPLATE_ORDER: TemplateId[] = ['minimal_trace', 'daily_recap', 'transparent_overlay', 'real_side', 'humorous', 'milestone'];
export const TEMPLATE_INFO: Record<TemplateId, { label: string; blurb: string; needsData: boolean; transparentByDefault: boolean }> = {
  minimal_trace: { label: 'Minimal trace', blurb: 'Just the line.', needsData: true, transparentByDefault: false },
  daily_recap: { label: 'Daily recap', blurb: 'The full day at a glance.', needsData: true, transparentByDefault: false },
  transparent_overlay: { label: 'Transparent overlay', blurb: 'Layer it over a photo.', needsData: true, transparentByDefault: true },
  real_side: { label: 'The real side', blurb: 'For the unpredictable days.', needsData: true, transparentByDefault: false },
  humorous: { label: 'Shift report', blurb: 'Diabetes humour, your words.', needsData: true, transparentByDefault: false },
  milestone: { label: 'Milestone', blurb: 'Anniversaries and wins.', needsData: false, transparentByDefault: false },
};

export interface ShowOptions {
  date: boolean; tir: boolean; avg: boolean; readings: boolean; coverage: boolean;
  chart: boolean; band: boolean; axis: boolean; brand: boolean; partialNote: boolean;
  /** Draw logged events as icons on the trace. No effect when there are no events. */
  events: boolean;
}
/** Templates whose trace can carry event icons. */
export const supportsEvents = (t: TemplateId): boolean => t !== 'milestone';
export function defaultShow(t: TemplateId): ShowOptions {
  const base: ShowOptions = { date: true, tir: false, avg: false, readings: false, coverage: false, chart: true, band: true, axis: true, brand: true, partialNote: true, events: true };
  switch (t) {
    case 'minimal_trace': return { ...base, tir: true, avg: true };
    case 'daily_recap': return { ...base, tir: true, avg: true, readings: true, coverage: true };
    case 'transparent_overlay': return { ...base, tir: true, avg: true, coverage: true };
    case 'real_side': return { ...base, avg: true, readings: true };
    case 'humorous': return { ...base, avg: true, readings: true, coverage: true };
    case 'milestone': return { ...base, date: false, chart: false, axis: false, band: false };
  }
}

export interface ArtModel {
  template: TemplateId;
  format: FormatId;
  transparent: boolean;
  theme: 'dark' | 'light';
  accent: string;
  unit: Unit;
  range: TargetRange;
  source: 'demo' | 'csv';
  start: number;
  end: number;
  stats: Stats;
  segs: Pt[][];
  headline: string;
  caption: string;
  milestoneBig: string;
  show: ShowOptions;
  /** Logged events in wall-clock time (same clock as `start`/`end`). Optional; absent or empty behaves exactly as before. */
  events?: ArtEvent[];
  embedFont: boolean;
  measure?: Measure;
}
export interface Artwork {
  svg: string; width: number; height: number; contents: string[]; hasData: boolean;
  /** Pixels by which stacked content runs past the footer. Must be 0; tests enforce it for every template and format. */
  overflow: number;
}

const fontStyle = (): string =>
  '<style>' + Object.entries(FONT_FACES).map(([w, b64]) => `@font-face{font-family:'GlucaInter';font-weight:${w};font-style:normal;src:url(data:font/woff;base64,${b64}) format('woff');}`).join('') + '</style>';

type StatKey = 'tir' | 'avg' | 'readings' | 'coverage';
interface StatItem { value: string; unit?: string; label: string; plain: string }

export function buildArtwork(m: ArtModel): Artwork {
  const f = FORMATS[m.format];
  const W = f.w, H = f.h;
  const compact = H < 1500;
  const tight = H <= 1100; // square
  const pick = <T,>(story: T, portrait: T, square: T): T => (tight ? square : compact ? portrait : story);
  let usedY = 0;
  const measure = m.measure ?? approxMeasure;
  const p: Palette = buildPalette(m.theme, m.accent, m.transparent);
  const X = f.margin, Wd = W - 2 * f.margin, Y0 = f.safeTop, Y1 = H - f.safeBottom - 8; // 8px inner buffer: glyph and mark overshoot must not enter the safe margin
  const shadow = !!p.shadow;
  const contents: string[] = [];
  const body: string[] = [];
  const hasData = m.stats.observedMs > 0;
  const days = Math.round((m.end - m.start) / DAY_MS);
  const dateLabel = periodLabel(m.start, m.end);
  const usesData = m.template !== 'milestone' || (m.show.chart && hasData);
  const showChart = m.show.chart && hasData && usesData;
  const U = unitLabel(m.unit);

  contents.push(m.transparent ? 'Background: transparent (no photo, no colour)' : `Background: ${m.theme} colour`);

  // ----- stats -----
  const pc = hasData && m.stats.tir !== null ? percents3(m.stats.tbr ?? 0, m.stats.tir, m.stats.tar ?? 0) : null;
  function statItem(k: StatKey): StatItem | null {
    if (!hasData) return null;
    switch (k) {
      case 'tir': return pc ? { value: `${pc[1]}%`, label: 'Time in range', plain: `Time in range: ${pc[1]}% (${formatGlucose(m.range.low, m.unit)}–${formatGlucose(m.range.high, m.unit)} ${U})` } : null;
      case 'avg': return m.stats.avg === null ? null : { value: formatGlucose(m.stats.avg, m.unit), unit: U, label: 'Average', plain: `Average glucose: ${formatGlucose(m.stats.avg, m.unit)} ${U}` };
      case 'readings': return { value: m.stats.readings.toLocaleString('en-US'), label: 'Readings', plain: `Number of readings: ${m.stats.readings}` };
      case 'coverage': { const c = Math.floor(m.stats.coverage * 100); return { value: `${c}%`, label: 'Data coverage', plain: `Data coverage: ${c}% of the period` }; }
    }
  }
  const keys = (list: StatKey[]): StatItem[] => list.filter((k) => m.show[k]).map(statItem).filter((x): x is StatItem => !!x);
  const statRow = (items: StatItem[], x: number, y: number, w: number, vs: number, ls: number, anchor: 'start' | 'middle' = 'start') => {
    const colW = w / items.length;
    let svg = '';
    items.forEach((it, i) => {
      let size = vs;
      const fits = (s: number) => measure(it.value, s, 800) + (it.unit ? measure(' ' + it.unit, s * 0.36, 600) : 0) <= colW - 20;
      while (size > 36 && !fits(size)) size -= 2;
      const cx = anchor === 'middle' ? x + colW * i + colW / 2 : x + colW * i;
      const by = y + size * 0.82;
      svg += `<text x="${n1(cx)}" y="${n1(by)}" font-size="${size}" font-weight="800" letter-spacing="-2" fill="${p.text}"${anchor === 'middle' ? ' text-anchor="middle"' : ''}${shadow ? ' filter="url(#sh)"' : ''}>${esc(it.value)}${it.unit ? `<tspan font-size="${Math.round(size * 0.36)}" font-weight="600" fill="${p.muted}" letter-spacing="0" dx="8">${esc(it.unit)}</tspan>` : ''}</text>`;
      svg += text(cx, by + ls * 1.75, it.label.toUpperCase(), { size: ls, weight: 600, fill: p.muted, ls: 3, anchor, shadow });
      contents.push(it.plain);
    });
    return { svg, h: vs * 0.82 + ls * 2.0 };
  };

  // ----- footer (notes + brand) -----
  const notes: string[] = [];
  if (m.source === 'demo' && usesData) notes.push('DEMO DATA · SYNTHETIC');
  if (hasData && usesData && m.stats.coverage < 0.9 && m.show.partialNote) notes.push(`BASED ON ${Math.floor(m.stats.coverage * 100)}% OF THIS ${days <= 1 ? 'DAY' : 'PERIOD'} · GAPS LEFT EMPTY`);
  const brandSize = compact ? 34 : 40;
  const brandH = m.show.brand ? brandSize + 6 : 0;
  const notesH = notes.length * 34;
  const footH = brandH + notesH + (brandH && notesH ? 14 : 0);
  const bodyEnd = Y1 - footH - (footH ? 28 : 0);
  const centerFooter = m.template === 'milestone';
  {
    let ny = Y1 - brandH - notesH - (brandH && notesH ? 14 : 0);
    notes.forEach((nt, i) => { body.push(text(centerFooter ? W / 2 : X, ny + 24 + i * 34, nt, { size: 21, weight: 600, fill: p.muted, ls: 3, anchor: centerFooter ? 'middle' : 'start', shadow })); });
    if (notes.length) contents.push(...notes.map((x) => `Note: ${x.toLowerCase().replace(/^./, (c) => c.toUpperCase())}`));
    if (m.show.brand) { body.push(brandMark(centerFooter ? W / 2 : X, Y1 - brandSize, BRAND.name, brandSize, p, centerFooter ? 'middle' : 'start').svg); contents.push(`${BRAND.name} wordmark`); }
  }

  // ----- shared pieces -----
  const eyebrow = (label: string, y: number, anchor: 'start' | 'middle' = 'start') =>
    text(anchor === 'middle' ? W / 2 : X, y + 26, label, { size: 28, weight: 700, fill: p.accentText, ls: 6, anchor, shadow });
  const head = (s: string, y: number, o: { size: number; min: number; lines: number; fill?: string; anchor?: 'start' | 'middle'; weight?: number }) => {
    const ft = fitText(s, { maxW: Wd, maxLines: o.lines, size: o.size, min: o.min, weight: o.weight ?? 800, measure });
    const b = block(ft.lines, o.anchor === 'middle' ? W / 2 : X, y, { size: ft.size, weight: o.weight ?? 800, fill: o.fill ?? p.text, lh: 1.06, ls: -2, anchor: o.anchor, shadow });
    return { svg: b.svg, h: b.h };
  };
  const para = (s: string, y: number, o: { size: number; min: number; lines: number; anchor?: 'start' | 'middle'; fill?: string }) => {
    const ft = fitText(s, { maxW: Wd, maxLines: o.lines, size: o.size, min: o.min, weight: 600, measure });
    const b = block(ft.lines, o.anchor === 'middle' ? W / 2 : X, y, { size: ft.size, weight: 600, fill: o.fill ?? p.text, lh: 1.3, anchor: o.anchor, opacity: 0.92, shadow });
    return { svg: b.svg, h: b.h };
  };
  const dateEyebrow = (prefix = '') => {
    const label = prefix ? (m.show.date ? `${prefix} · ${dateLabel}` : prefix) : dateLabel;
    if (!prefix && !m.show.date) return null;
    return label;
  };
  const chart = (y: number, h: number, opts: { glow: boolean; gradient?: boolean; sw?: number }) => {
    const grad = opts.gradient ? [ensureContrast('#76B8FF', p.transparent ? '#000' : p.bg0, 3), ensureContrast('#C5B3FF', p.transparent ? '#000' : p.bg0, 3), ensureContrast('#FFBD82', p.transparent ? '#000' : p.bg0, 3)] : undefined;
    const c = chartSvg({
      x: X, y, w: Wd, h, start: m.start, end: m.end, segs: m.segs, stats: m.stats, range: m.range, unit: m.unit, p,
      stroke: grad ? 'url(#lg)' : p.accent, strokeW: opts.sw ?? (compact ? 7 : 8), glow: opts.glow, showBand: m.show.band, showAxis: m.show.axis, gradientStops: grad,
      events: m.show.events && supportsEvents(m.template) ? m.events : undefined,
    });
    contents.push(`Glucose trace${days <= 1 ? '' : ` for ${days} days`}${m.show.band ? ` with the ${formatGlucose(m.range.low, m.unit)}–${formatGlucose(m.range.high, m.unit)} ${U} target band` : ''}${gapsPresent() ? '; gaps in data are left empty' : ''}`);
    const evLine = eventsContentLine(c.events);
    if (evLine) contents.push(evLine);
    return c;
  };
  const gapsPresent = () => m.segs.length > 1;
  const note = (s: string) => contents.push(s);
  const vs = pick(84, 68, 52), lbl = pick(22, 22, 20), gapY = pick(44, 44, 28), topGap = pick(70, 70, 58), chartMin = pick(180, 170, 110);

  // ================= templates =================
  switch (m.template) {
    case 'minimal_trace': {
      let y = Y0;
      const eb = dateEyebrow();
      if (eb) { body.push(eyebrow(eb, y)); note(`Date: ${eb}`); y += topGap; }
      if (m.headline.trim()) { const h = head(m.headline, y, { size: pick(96, 76, 60), min: 44, lines: 2 }); body.push(h.svg); note(`Headline: “${m.headline.trim()}”`); y += h.h + 28; }
      const items = keys(['tir', 'avg', 'readings', 'coverage']).slice(0, 3);
      const statH = items.length ? vs * 0.82 + lbl * 2.0 : 0;
      const cap = m.caption.trim() ? para(m.caption.trim(), 0, { size: pick(38, 38, 32), min: 26, lines: pick(3, 3, 2) }) : null;
      const capH = cap ? cap.h : 0;
      if (showChart) {
        const axisH = m.show.axis ? 52 : 0;
        const ch = Math.max(chartMin, bodyEnd - y - axisH - statH - capH - (items.length ? gapY : 0) - (cap ? 28 : 0));
        const c = chart(y, ch, { glow: true });
        body.push(c.svg); y += ch + c.axisH + (items.length ? gapY : 0);
      }
      if (items.length) { const r = statRow(items, X, y, Wd, vs, lbl); body.push(r.svg); y += r.h + 28; }
      if (cap) { const c2 = para(m.caption.trim(), y, { size: pick(38, 38, 32), min: 26, lines: pick(3, 3, 2) }); body.push(c2.svg); note(`Caption: “${m.caption.trim()}”`); }
      usedY = cap ? y + cap.h : y - (items.length ? 28 : 0);
      break;
    }

    case 'daily_recap': {
      let y = Y0;
      const kind = days <= 1 ? 'DAILY RECAP' : 'WEEKLY RECAP';
      const eb = dateEyebrow(kind) as string;
      body.push(eyebrow(eb, y)); note(`Title: ${eb}`); y += topGap;
      if (m.headline.trim()) { const h = head(m.headline, y, { size: pick(76, 62, 48), min: 40, lines: pick(2, 2, 1) }); body.push(h.svg); note(`Headline: “${m.headline.trim()}”`); y += h.h + 22; }
      // hero number: time in range if selected, otherwise average
      const heroKey: StatKey | null = m.show.tir && pc ? 'tir' : m.show.avg && m.stats.avg !== null ? 'avg' : null;
      if (heroKey && hasData) {
        const it = statItem(heroKey)!;
        const hs = pick(260, 190, 116);
        const valSize = (() => { let s = hs; while (s > 80 && measure(it.value, s, 800) > Wd * 0.8) s -= 4; return s; })();
        body.push(`<text x="${X - 6}" y="${n1(y + valSize * 0.82)}" font-size="${valSize}" font-weight="800" letter-spacing="${Math.round(-valSize * 0.045)}" fill="${p.accentText}"${shadow ? ' filter="url(#sh)"' : ''}>${esc(it.value.replace('%', ''))}${it.value.endsWith('%') ? `<tspan font-size="${Math.round(valSize * 0.42)}" letter-spacing="0">%</tspan>` : ''}${it.unit ? `<tspan font-size="${Math.round(valSize * 0.2)}" font-weight="600" fill="${p.muted}" letter-spacing="0" dx="12">${esc(it.unit)}</tspan>` : ''}</text>`);
        y += valSize * 0.82 + 20;
        const sub = heroKey === 'tir' ? `TIME IN RANGE · ${formatGlucose(m.range.low, m.unit)}–${formatGlucose(m.range.high, m.unit)} ${U}` : 'AVERAGE GLUCOSE';
        body.push(text(X, y + 22, sub, { size: 26, weight: 600, fill: p.muted, ls: 3, shadow })); note(it.plain); y += 62;
      }
      if (pc && m.show.tir) { const d = distributionBar(X, y, Wd, pc, p, 26); body.push(d.svg); note(`Share of time below / in / above range: ${pc[0]}% / ${pc[1]}% / ${pc[2]}%`); y += d.h + 22; }
      const tiles = keys(['avg', 'readings', 'coverage']).filter((it) => !(heroKey === 'avg' && it.label === 'Average'));
      const tileH = tiles.length ? Math.min(vs, 60) * 0.82 + 20 * 2.0 + 44 : 0;
      if (showChart) {
        const axisH = m.show.axis ? 52 : 0;
        const ch = Math.max(chartMin, bodyEnd - y - axisH - tileH - (tiles.length ? 40 : 0));
        const c = chart(y, ch, { glow: true });
        body.push(c.svg); y += ch + c.axisH + (tiles.length ? 40 : 0);
      }
      if (tiles.length) {
        const gap = 18, tw = (Wd - gap * (tiles.length - 1)) / tiles.length;
        tiles.forEach((it, i) => {
          const tx = X + i * (tw + gap);
          body.push(`<rect x="${n1(tx)}" y="${n1(y)}" width="${n1(tw)}" height="${n1(tileH)}" rx="26" fill="${p.transparent ? 'none' : p.surface}" stroke="${p.surfaceStroke}" stroke-opacity="${p.transparent ? 0.7 : 0.12}" stroke-width="2"/>`);
          const r = statRow([it], tx + 24, y + 22, tw - 40, Math.min(vs, 60), 20);
          body.push(r.svg);
        });
      }
      usedY = tiles.length ? y + tileH : y;
      break;
    }

    case 'transparent_overlay': {
      let y = Y0;
      const eb = dateEyebrow();
      if (eb) { body.push(eyebrow(eb, y)); note(`Date: ${eb}`); y += topGap; }
      const hs = pick(230, 176, 130);
      if (m.show.tir && pc) {
        body.push(`<text x="${X - 6}" y="${n1(y + hs * 0.82)}" font-size="${hs}" font-weight="800" letter-spacing="${Math.round(-hs * 0.045)}" fill="${p.text}" filter="url(#sh)">${pc[1]}<tspan font-size="${Math.round(hs * 0.42)}" letter-spacing="0">%</tspan></text>`);
        y += hs * 0.82 + 18;
        body.push(text(X, y + 22, `TIME IN RANGE · ${formatGlucose(m.range.low, m.unit)}–${formatGlucose(m.range.high, m.unit)} ${U}`, { size: 26, weight: 600, fill: p.muted, ls: 3, shadow }));
        note(statItem('tir')!.plain); y += 64;
      }
      if (m.headline.trim()) { const h = head(m.headline, y, { size: pick(68, 56, 46), min: 36, lines: 2 }); body.push(h.svg); note(`Headline: “${m.headline.trim()}”`); y += h.h + 22; }
      const items = keys(['avg', 'readings', 'coverage']).slice(0, 3);
      const statH = items.length ? vs * 0.82 + lbl * 2.0 : 0;
      const cap = m.caption.trim() ? para(m.caption.trim(), 0, { size: pick(36, 36, 30), min: 24, lines: 2 }) : null;
      if (showChart) {
        const axisH = m.show.axis ? 52 : 0;
        const ch = Math.max(chartMin, bodyEnd - y - axisH - statH - (cap ? cap.h + 24 : 0) - (items.length ? gapY : 0));
        const c = chart(y, ch, { glow: false, sw: compact ? 8 : 9 });
        body.push(c.svg); y += ch + c.axisH + (items.length ? gapY : 0);
      }
      if (items.length) { const r = statRow(items, X, y, Wd, vs, lbl); body.push(r.svg); y += r.h + 24; }
      if (cap) { body.push(para(m.caption.trim(), y, { size: pick(36, 36, 30), min: 24, lines: 2 }).svg); note(`Caption: “${m.caption.trim()}”`); }
      usedY = cap ? y + cap.h : y - (items.length ? 24 : 0);
      break;
    }

    case 'real_side': {
      let y = Y0;
      const eb = dateEyebrow();
      if (eb) { body.push(eyebrow(eb, y)); note(`Date: ${eb}`); y += topGap; }
      const hd = m.headline.trim() || 'Some days are just like this.';
      const h = head(hd, y, { size: pick(112, 92, 76), min: 52, lines: pick(3, 3, 2) });
      body.push(h.svg); note(`Headline: “${hd}”`); y += h.h + 34;
      const items = keys(['tir', 'avg', 'readings', 'coverage']).slice(0, 3);
      const statH = items.length ? vs * 0.82 + lbl * 2.0 : 0;
      const cap = m.caption.trim() ? para(m.caption.trim(), 0, { size: pick(40, 40, 32), min: 26, lines: pick(3, 3, 2) }) : null;
      if (showChart) {
        const axisH = m.show.axis ? 52 : 0;
        const ch = Math.max(chartMin, bodyEnd - y - axisH - statH - (cap ? cap.h + 28 : 0) - (items.length ? gapY : 0));
        const c = chart(y, ch, { glow: true, gradient: true, sw: compact ? 8 : 10 });
        body.push(c.svg); y += ch + c.axisH + (items.length ? gapY : 0);
      }
      if (items.length) { const r = statRow(items, X, y, Wd, vs, lbl); body.push(r.svg); y += r.h + 28; }
      if (cap) { body.push(para(m.caption.trim(), y, { size: pick(40, 40, 32), min: 26, lines: pick(3, 3, 2) }).svg); note(`Caption: “${m.caption.trim()}”`); }
      usedY = cap ? y + cap.h : y - (items.length ? 28 : 0);
      break;
    }

    case 'humorous': {
      let y = Y0;
      const badge = m.show.date ? `SHIFT REPORT · ${dateLabel}` : 'SHIFT REPORT';
      const bw = Math.min(Wd, measure(badge, 24, 700) + 3 * badge.length + 56);
      const ink = luminance(p.accent) > 0.4 ? NEAR_BLACK : '#FFFFFF';
      body.push(`<rect x="${X}" y="${y}" width="${n1(bw)}" height="56" rx="28" fill="${p.accent}"${shadow ? ' filter="url(#sh)"' : ''}/>`);
      body.push(text(X + 28, y + 37, badge, { size: 24, weight: 700, fill: ink, ls: 3 })); note(`Badge: ${badge}`); y += pick(100, 100, 82);
      const hd = m.headline.trim() || 'Pancreas replacement shift.';
      const h = head(hd, y, { size: pick(136, 112, 84), min: 56, lines: pick(4, 4, 3), fill: p.accentText });
      body.push(h.svg); note(`Headline: “${hd}”`); y += h.h + 30;
      const items = keys(['tir', 'avg', 'readings', 'coverage']).slice(0, 3);
      const vsH = pick(68, 56, 48);
      const statH = items.length ? vsH * 0.82 + lbl * 2.0 : 0;
      const cap = m.caption.trim() ? para(m.caption.trim(), 0, { size: pick(44, 40, 32), min: 26, lines: pick(3, 3, 2) }) : null;
      if (cap) { body.push(para(m.caption.trim(), y, { size: pick(44, 40, 32), min: 26, lines: pick(3, 3, 2) }).svg); note(`Caption: “${m.caption.trim()}”`); y += cap.h + 34; }
      if (showChart) {
        const axisH = m.show.axis ? 52 : 0;
        const ch = Math.max(chartMin - 40, Math.min(bodyEnd - y - axisH - statH - (items.length ? 40 : 0), pick(460, 300, 260)));
        const c = chart(y, ch, { glow: false, sw: 7 });
        body.push(c.svg); y += ch + c.axisH + (items.length ? 40 : 0);
      }
      if (items.length) body.push(statRow(items, X, y, Wd, vsH, lbl).svg);
      usedY = items.length ? y + statH : showChart ? y : y - (cap ? 34 : 0);
      break;
    }

    case 'milestone': {
      const cx = W / 2;
      let y = Y0;
      const mark = body.length; // everything drawn from here is centred vertically as one block at the end
      body.push(eyebrow('MILESTONE', y, 'middle')); note('Label: MILESTONE'); y += topGap;
      const avail = bodyEnd - y;
      const r = Math.max(150, Math.min(Wd * 0.4, avail * 0.3));
      const cy = y + r + 20;
      body.push(`<circle cx="${cx}" cy="${n1(cy)}" r="${n1(r)}" fill="none" stroke="${p.accent}" stroke-width="8"${shadow ? ' filter="url(#sh)"' : ''}/>`);
      body.push(`<circle cx="${cx}" cy="${n1(cy)}" r="${n1(r - 30)}" fill="none" stroke="${p.accent}" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="2 16" stroke-linecap="round"/>`);
      const big = m.milestoneBig.trim();
      if (big) {
        const ft = fitText(big, { maxW: r * 1.45, maxLines: 2, size: Math.round(r * 0.78), min: 40, weight: 800, measure });
        const total = ft.lines.length * ft.size * 1.0;
        body.push(block(ft.lines, cx, cy - total / 2 + ft.size * 0.04, { size: ft.size, weight: 800, fill: p.text, lh: 1.0, ls: -3, anchor: 'middle', shadow }).svg);
        note(`Milestone: “${big}”`);
      }
      y = cy + r + 56;
      if (m.headline.trim()) { const h = head(m.headline, y, { size: pick(84, 70, 56), min: 40, lines: 2, anchor: 'middle' }); body.push(h.svg); note(`Headline: “${m.headline.trim()}”`); y += h.h + 22; }
      if (m.caption.trim()) { const c = para(m.caption.trim(), y, { size: 40, min: 28, lines: 3, anchor: 'middle' }); body.push(c.svg); note(`Caption: “${m.caption.trim()}”`); y += c.h + 24; }
      if (showChart) {
        const axisH = m.show.axis ? 52 : 0;
        const ch = Math.max(0, Math.min(bodyEnd - y - axisH, 260));
        if (ch >= 120) { const c = chart(y, ch, { glow: false, sw: 6 }); body.push(c.svg); y += ch + c.axisH; }
      }
      // centre the block between the safe top and the footer (slightly above true centre reads better)
      const dy = Math.max(0, Math.round((bodyEnd - y) * 0.45));
      if (dy > 0) { const parts = body.splice(mark); body.push(`<g transform="translate(0,${dy})">${parts.join('')}</g>`); }
      usedY = y + dy - 22;
      break;
    }
  }

  // ----- assemble -----
  const defs: string[] = [];
  if (m.embedFont) defs.push(fontStyle());
  defs.push(`<filter id="bl" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${W + 200}" height="${H + 200}"><feGaussianBlur stdDeviation="14"/></filter>`);
  if (p.shadow) defs.push(`<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="${p.shadow.color}" flood-opacity="${p.shadow.opacity}"/></filter>`);
  let bg = '';
  if (!p.transparent) {
    const glowA = m.theme === 'dark' ? 0.26 : 0.22, glowB = m.theme === 'dark' ? 0.16 : 0.14;
    defs.push(`<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg0}"/><stop offset="1" stop-color="${p.bg1}"/></linearGradient>`);
    defs.push(`<radialGradient id="g1" cx="0.92" cy="0.06" r="0.8"><stop offset="0" stop-color="${m.accent}" stop-opacity="${glowA}"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>`);
    defs.push(`<radialGradient id="g2" cx="0.04" cy="0.97" r="0.7"><stop offset="0" stop-color="${SWATCHES.lavender}" stop-opacity="${glowB}"/><stop offset="1" stop-color="${SWATCHES.lavender}" stop-opacity="0"/></radialGradient>`);
    bg = `<rect data-bg="1" width="${W}" height="${H}" fill="url(#bg)"/><rect data-bg="1" width="${W}" height="${H}" fill="url(#g1)"/><rect data-bg="1" width="${W}" height="${H}" fill="url(#g2)"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_FAMILY}"><defs>${defs.join('')}</defs>${bg}${body.join('')}</svg>`;
  return { svg, width: W, height: H, contents, hasData, overflow: Math.max(0, Math.round(usedY - bodyEnd)) };
}
