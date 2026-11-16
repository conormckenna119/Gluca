// Pure helpers for saved app state and the glucose target range. No React Native imports, so tests can load it.
import type { Post, State } from "./types";
import { defaultPrivacy, defaultProfile, sanitizePrivacy, sanitizeProfile } from "./domain/profile";
import { sanitizeReactions } from "./domain/reactions";
import { emptyCounters, sanitizeAwards, sanitizeChallenges, sanitizeCounters } from "./domain/achievements";
import { sanitizeEvents } from "./events";

export const MG_PER_MMOL = 18.0182;
export const DEFAULT_RANGE = { low: 70, high: 180 } as const; // mg/dL
export const RANGE_LIMITS = { min: 20, max: 600 } as const; // mg/dL

export type Unit = State["unit"];
export type Range = State["range"];

/** A state with nothing in it: no posts, nothing shared, default units and range. Tests and the store build on it. */
export const emptyState = (): State => ({
  posts: [], following: [], clubs: [], blocked: [], reports: [], unit: "mg/dL", range: { ...DEFAULT_RANGE }, dark: true,
  imported: [], seenWelcome: false, events: [], profile: defaultProfile(), privacy: defaultPrivacy(), awards: [],
  counters: emptyCounters(), challenges: [], clubVisibility: {},
});

export function isValidRange(r: unknown): r is Range {
  if (!r || typeof r !== "object") return false;
  const { low, high } = r as { low?: unknown; high?: unknown };
  return (
    typeof low === "number" &&
    typeof high === "number" &&
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    low >= RANGE_LIMITS.min &&
    high <= RANGE_LIMITS.max &&
    low < high
  );
}

/** Merge a saved JSON string over `defaults`. Old state without `range`, or with a corrupt one, gets the default range. */
export function loadState(
  raw: string | null | undefined,
  defaults: State,
): State {
  if (!raw) return defaults;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!saved || typeof saved !== "object" || Array.isArray(saved))
    return defaults;
  const merged = { ...defaults, ...(saved as Partial<State>) };
  merged.range = isValidRange(merged.range)
    ? { low: merged.range.low, high: merged.range.high }
    : { ...DEFAULT_RANGE };
  // Saved state from before the Welcome screen existed belongs to someone who has already used the app.
  merged.seenWelcome =
    typeof (saved as { seenWelcome?: unknown }).seenWelcome === "boolean"
      ? (saved as State).seenWelcome
      : true;
  // Saved state from before event logging has no events; anything that is not a list is dropped.
  merged.events = sanitizeEvents(merged.events);
  const s = saved as Record<string, unknown>;
  // Identity, privacy and achievements arrived later. Missing or malformed values fall back to "nothing shared".
  merged.profile = sanitizeProfile(s.profile);
  merged.privacy = sanitizePrivacy(s.privacy);
  merged.awards = sanitizeAwards(s.awards);
  merged.counters = sanitizeCounters(s.counters);
  merged.challenges = sanitizeChallenges(s.challenges);
  merged.clubVisibility = cleanVisibility(s.clubVisibility);
  merged.posts = Array.isArray(merged.posts) ? merged.posts.map(migratePost) : defaults.posts;
  return merged;
}

/** Posts saved before Boosts had `kudos` and `liked`; they become a Boost count and "my Boost". */
function migratePost(p: Post): Post {
  const { kudos, liked, ...rest } = p as Post & { kudos?: unknown; liked?: unknown };
  return { ...rest, reactions: sanitizeReactions(p.reactions, { kudos, liked }) };
}

function cleanVisibility(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (v === true) out[k] = true;
  return out;
}

/** True when CSV readings are stored and the app is not on synthetic demo data. */
export const hasImported = (s: Pick<State, "imported">): boolean =>
  s.imported.length > 0;

/** Drop imported readings at once. Everything else (posts, preferences) is kept. */
export const removeImported = <S extends Pick<State, "imported">>(s: S): S => ({
  ...s,
  imported: [],
});

export const REMOVED_IMPORT_MESSAGE =
  "Imported readings were removed from this device. The app is back on synthetic demo data.";

/** mg/dL to the text shown in the display unit. */
export const rangeToText = (mgdl: number, unit: Unit): string =>
  unit === "mmol/L"
    ? (mgdl / MG_PER_MMOL).toFixed(1)
    : String(Math.round(mgdl));

/** Display-unit text for low and high back to a validated mg/dL range, or null when invalid. */
export function parseRange(
  lowText: string,
  highText: string,
  unit: Unit,
): Range | null {
  const f = unit === "mmol/L" ? MG_PER_MMOL : 1;
  if (!lowText.trim() || !highText.trim()) return null;
  const low = Math.round(Number(lowText) * f);
  const high = Math.round(Number(highText) * f);
  const r = { low, high };
  return isValidRange(r) ? r : null;
}
