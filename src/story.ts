// Story artwork for Gluca. The layout engine lives in src/art (pure TypeScript, no React Native dependency).
// This file adapts the app's Reading type and unit names to it, and makes the SVG safe for react-native-svg.
import type { GlucaEvent, Reading } from "./types";
import { buildArtwork, defaultShow, supportsEvents, TEMPLATE_INFO, TEMPLATE_ORDER, type Artwork, type ShowOptions } from "./art/templates";
import { defaultSettings, makeArtModel, withTemplate, type Settings } from "./art/model";
import { toEngine, wall } from "./analytics";
import { captionFor, headlineFor, TONES, TONE_LABEL, type Tone } from "./art/copy";
import { FORMATS as ART_FORMATS, type FormatId } from "./art/formats";
import { SWATCHES, type Measure } from "./art/svg";
import type { TemplateId } from "./art/telemetry";

export const formats = {
  Story: [1080, 1920],
  Portrait: [1080, 1350],
  Square: [1080, 1080],
} as const;
export type FormatName = keyof typeof formats;
const FORMAT_ID: Record<FormatName, FormatId> = { Story: "story", Portrait: "portrait", Square: "square" };

export const templateIds: TemplateId[] = TEMPLATE_ORDER;
export const templateInfo = TEMPLATE_INFO;
export { supportsEvents };
export { TONES, TONE_LABEL, SWATCHES };
export type { Tone, TemplateId, ShowOptions };
export const SAFE_MARGINS = { Story: 250, Portrait: 110, Square: 90 } as const;

export type StoryOptions = {
  template: TemplateId;
  format: FormatName;
  transparent: boolean;
  theme: "dark" | "light";
  accent: string;
  tone: Tone;
  headline: string;
  caption: string;
  milestoneBig: string;
  show: ShowOptions;
  unit: "mg/dL" | "mmol/L";
  range: { low: number; high: number }; // always mg/dL
  period: "day" | "week";
};

const toSettings = (o: StoryOptions): Settings => ({
  template: o.template, format: FORMAT_ID[o.format], transparent: o.transparent, theme: o.theme, accent: o.accent,
  unit: o.unit === "mmol/L" ? "mmol" : "mgdl", range: o.range, tone: o.tone, headline: o.headline, caption: o.caption,
  milestoneBig: o.milestoneBig, show: o.show, period: o.period,
});

export function defaultOptions(template: TemplateId, unit: "mg/dL" | "mmol/L" = "mg/dL", format: FormatName = "Story"): StoryOptions {
  const d = defaultSettings(template);
  return {
    template, format, transparent: d.transparent, theme: d.theme, accent: d.accent, tone: d.tone, headline: d.headline,
    caption: d.caption, milestoneBig: d.milestoneBig, show: d.show, unit, range: { ...d.range }, period: "day",
  };
}

/** Switching template keeps look-and-feel (theme, accent, unit, range, format) and resets words and toggles. */
export function switchTemplate(o: StoryOptions, template: TemplateId): StoryOptions {
  const next = withTemplate(toSettings(o), template);
  return { ...defaultOptions(template, o.unit, o.format), theme: next.theme, accent: next.accent, range: next.range, period: next.period, transparent: next.transparent };
}
export const pickTone = (o: StoryOptions, tone: Tone, index = 0): StoryOptions =>
  tone === "custom" ? { ...o, tone } : { ...o, tone, headline: headlineFor(tone, index), caption: captionFor(tone, index) };

let nativeFonts: Record<number, string> | null = null;
/** Per-weight font families for native text (weight -> family name). null (the default) strips font-family, as before. */
export function configureNativeFonts(map: Record<number, string> | null): void {
  nativeFonts = map && Object.keys(map).length ? { ...map } : null;
}
const nearestFamily = (map: Record<number, string>, weight: number): string => {
  const ws = Object.keys(map).map(Number);
  const best = ws.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) || (Math.abs(b - weight) === Math.abs(a - weight) && b > a) ? b : a));
  return map[best];
};
const weightOf = (attrs: string): number | null => {
  const m = /font-weight="(\d+)"/.exec(attrs);
  return m ? Number(m[1]) : null;
};
/** Give every <text>/<tspan> its own per-weight family (a tspan without a weight inherits its parent's). */
function applyFonts(svg: string, map: Record<number, string>): string {
  let out = "";
  let i = 0;
  const stack: number[] = [];
  const tag = /<(\/?)(text|tspan)\b([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(svg))) {
    out += svg.slice(i, m.index);
    i = m.index + m[0].length;
    const [whole, close, name, attrs, selfClose] = m;
    if (close) { stack.pop(); out += whole; continue; }
    const w = weightOf(attrs) ?? stack[stack.length - 1] ?? 400;
    const family = nearestFamily(map, w);
    // the numeric weight is dropped: with a per-weight family it is redundant and unreliable on Android
    const cleaned = attrs.replace(/ font-weight="\d+"/, "");
    out += `<${name}${cleaned} font-family="${family}"${selfClose}>`;
    if (!selfClose) stack.push(w);
  }
  return out + svg.slice(i);
}

/** Remove SVG features react-native-svg does not render (filters, <style>, font lists) so native matches the web preview. */
export function nativeSafe(svg: string): string {
  // The blur filter is not rendered natively: stand in for it with two wider, low-opacity round strokes under the trace.
  let out = svg.replace(/<path ([^>]*?) opacity="0\.5" filter="url\(#bl\)"\/>/g, (_all, attrs: string) => {
    const w = Number(/stroke-width="([\d.]+)"/.exec(attrs)?.[1] ?? 0);
    const layer = (k: number, op: number) =>
      `<path ${attrs.replace(/stroke-width="[\d.]+"/, `stroke-width="${Math.round(w * k * 10) / 10}"`)} opacity="${op}"/>`;
    return layer(1.9, 0.1) + layer(1.25, 0.16);
  });
  out = out
    .replace(/<filter[\s\S]*?<\/filter>/g, "")
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/ filter="url\(#[^"]*\)"/g, "")
    .replace(/ data-bg="1"/g, "")
    .replace(/ data-(?:ev|b)="[^"]*"/g, "")
    .replace(/ font-family="[^"]*"/g, "");
  return nativeFonts ? applyFonts(out, nativeFonts) : out;
}

export type StoryArtwork = Artwork & { svg: string };
/**
 * Build artwork for the local day (or 7 days ending on that day) that contains `anchorMs`.
 * `embedFont` is for web PNG export only: it embeds Inter so the file looks the same on every device.
 */
export function storyArtwork(
  rows: Reading[],
  anchorMs: number,
  o: StoryOptions,
  opts: { embedFont?: boolean; native?: boolean; measure?: Measure; events?: GlucaEvent[] } = {},
): StoryArtwork {
  const readings = toEngine(rows);
  const source = rows.length && rows[0].source === "csv" ? "csv" : "demo";
  const art = buildArtwork(makeArtModel(readings, source, wall(anchorMs), toSettings(o), { embedFont: !!opts.embedFont, measure: opts.measure,
    events: opts.events?.map((e) => ({ kind: e.kind, t: wall(e.start), durationMin: e.durationMin, label: e.label })) }));
  return opts.native ? { ...art, svg: nativeSafe(art.svg) } : art;
}
export const storySvg = (rows: Reading[], anchorMs: number, o: StoryOptions, opts?: { embedFont?: boolean; native?: boolean; events?: GlucaEvent[] }) => storyArtwork(rows, anchorMs, o, opts).svg;
export { ART_FORMATS };
