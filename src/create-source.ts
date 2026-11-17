// Shared, pure source/period contract for Create and explicit sandbox verification.
import {
  DAY_MS,
  parseProviderTime,
  type AvailableGlucoseRange,
} from "./glucose-window";
import { summarize, segments } from "./analytics";
import { storyArtwork, defaultOptions, type StoryOptions } from "./story";
import type { Reading } from "./types";
import type { GlucoseProvider } from "./providers";
export type CreateSource = "demo" | "csv" | "dexcom";
export function utcDayWindow(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error("Choose a valid historical UTC date.");
  const start = parseProviderTime(day + "T00:00:00Z");
  if (start === null) throw new Error("Choose a valid historical UTC date.");
  return { start, end: start + DAY_MS };
}
export function latestHistoricalDay(range: AvailableGlucoseRange) {
  const candidate = Math.floor(range.end / DAY_MS) * DAY_MS - DAY_MS;
  return new Date(
    Math.max(Math.floor(range.start / DAY_MS) * DAY_MS, candidate),
  )
    .toISOString()
    .slice(0, 10);
}
export async function providerDay(provider: GlucoseProvider, day: string) {
  const window = utcDayWindow(day);
  return {
    window,
    readings: await provider.getReadings(window.start, window.end),
  };
}
export function sandboxStory(
  rows: Reading[],
  day: string,
  options: StoryOptions = defaultOptions("daily_recap"),
) {
  if (
    !rows.length ||
    rows.some(
      (r) =>
        r.source !== "dexcom" ||
        !("environment" in r) ||
        r.environment !== "sandbox",
    )
  )
    throw new Error("No validated Dexcom sandbox data for this day.");
  const window = utcDayWindow(day),
    o = {
      ...options,
      period: "day" as const,
      provenance: "dexcom-sandbox" as const,
    };
  const stats = summarize(
    rows,
    window.start,
    window.end,
    o.range.low,
    o.range.high,
    "utc",
  );
  const paths = segments(rows, window.start, window.end, 900, 300, "utc");
  const artwork = storyArtwork(rows, window.start + DAY_MS / 2, o);
  if (
    !stats.count ||
    !paths.length ||
    !artwork.hasData ||
    artwork.overflow ||
    !artwork.svg.includes("DEXCOM SANDBOX")
  )
    throw new Error("Sandbox story verification failed.");
  return { window, stats, paths, artwork };
}
