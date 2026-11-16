// Builds the route that opens Create's milestone template for an earned medal. Pure TypeScript.
// The text comes from the achievement NAME only. Snapshot fields, glucose values and dates are never used.
import type { AchievementDef } from "./domain/achievements";

export const SHARE_HEADLINE_MAX = 90;
export const SHARE_BIG_MAX = 24;

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max / 2 ? cut.slice(0, at) : cut).trim();
};

export function shareText(def: Pick<AchievementDef, "name">) {
  return {
    headline: clip(`Medal earned: ${def.name}`, SHARE_HEADLINE_MAX),
    big: clip(def.name, SHARE_BIG_MAX),
  };
}

/** Route into Create. Create still shows "What's on this image" and nothing is posted automatically. */
export function shareRoute(def: Pick<AchievementDef, "name">): string {
  const { headline, big } = shareText(def);
  return `/create?template=milestone&headline=${encodeURIComponent(headline)}&big=${encodeURIComponent(big)}`;
}

/** Create reads the optional parameters; this clamps them to the same limits as the text fields. */
export function readShareParams(p: {
  headline?: string | string[];
  big?: string | string[];
}) {
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const h = one(p.headline)?.trim();
  const b = one(p.big)?.trim();
  return {
    headline: h ? h.slice(0, SHARE_HEADLINE_MAX) : undefined,
    big: b ? b.slice(0, SHARE_BIG_MAX) : undefined,
  };
}
