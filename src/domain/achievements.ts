// Achievement model: what a registry entry and an award look like. Rules and the engine live in later files
// (src/achievements/). Pure TypeScript.
//
// Safety rules that the types are built around (see docs/ACHIEVEMENT_SAFETY.md once written):
// - Health achievements are optional, private by default, retrospective, and off behind `healthAchievements`.
// - An award never stores glucose values unless the rule explicitly puts them in `snapshot`, and a public medal
//   never shows the snapshot.
// - An earned award is never taken away because later results change; it can only be withdrawn as erroneous.
import type { FlagName } from "../flags";

export type AchievementCategory = "health" | "life" | "community";
export type MedalIcon =
  | "post" | "activity" | "story" | "anniversary" | "milestone" | "awareness" | "community" | "support"
  | "pulse" | "balance" | "goal";
export type RequiredData = "posts" | "exports" | "profile" | "reactions" | "communities" | "challenges" | "events" | "glucose" | "a1c";
/** How often the same achievement may be earned. The engine turns this into a period key. */
export type Repeatability = "once" | "yearly" | "per_period";
export type EvaluationPeriod = "none" | "week" | "month" | "quarter" | "year";
export type SafetyReview = "not_required" | "pending" | "approved";
export type AwardVisibility = "private" | "public";

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: MedalIcon;
  requiredData: RequiredData[];
  period: EvaluationPeriod;
  /** Only for glucose-based rules: the least CGM coverage of the whole period, in percent. */
  minCoveragePct?: number;
  defaultVisibility: AwardVisibility;
  repeatable: Repeatability;
  /** Bump when the rule changes, so old awards can be told from new ones. */
  ruleVersion: number;
  safetyReview: SafetyReview;
  /** The achievement does not exist for the person while this flag is off. */
  flag: FlagName;
  /** Health achievements also need the person's own opt-in (`privacy.healthAchievements`). */
  needsHealthOptIn: boolean;
  /** Set to switch one achievement off without a release, e.g. after research finds harm. */
  disabled?: boolean;
};

export const LOCAL_USER = "me";

export type Award = {
  /** `${userId}:${achievementId}:${periodKey}`; the engine uses it to make awarding idempotent. */
  id: string;
  userId: string;
  achievementId: string;
  awardedAt: number;
  /** "" for once-only awards, otherwise e.g. "2026", "2026-W46", "2026-11". */
  periodKey: string;
  ruleVersion: number;
  /** Optional supporting numbers, private to the owner. Never shown on a public medal. */
  snapshot?: Record<string, string | number>;
  visibility: AwardVisibility;
  pinned: boolean;
  /** Opaque local action identifier; never included in public medals. */
  relatedEvent?: string;
  /** Present when the award was withdrawn because its data was wrong. Withdrawn awards are hidden everywhere. */
  withdrawn?: { at: number; reason: string };
};

export const MAX_PINNED = 3;
export const awardId = (userId: string, achievementId: string, periodKey: string) => `${userId}:${achievementId}:${periodKey}`;

export function isValidAward(a: unknown): a is Award {
  if (!a || typeof a !== "object") return false;
  const r = a as Record<string, unknown>;
  const str = (v: unknown) => typeof v === "string";
  if (!str(r.userId) || !str(r.achievementId) || !r.achievementId || !str(r.periodKey)) return false;
  if (r.id !== awardId(r.userId as string, r.achievementId as string, r.periodKey as string)) return false;
  if (typeof r.awardedAt !== "number" || !Number.isFinite(r.awardedAt)) return false;
  if (typeof r.ruleVersion !== "number" || !Number.isInteger(r.ruleVersion)) return false;
  if (r.visibility !== "private" && r.visibility !== "public") return false;
  if (typeof r.pinned !== "boolean") return false;
  if (r.snapshot !== undefined) {
    if (!r.snapshot || typeof r.snapshot !== "object" || Array.isArray(r.snapshot)) return false;
    for (const v of Object.values(r.snapshot)) if (typeof v !== "string" && typeof v !== "number") return false;
  }
  if (r.withdrawn !== undefined) {
    const w = r.withdrawn as Record<string, unknown> | null;
    if (!w || typeof w.at !== "number" || typeof w.reason !== "string") return false;
  }
  return true;
}

/** Drop malformed and duplicate awards from saved data, and never let more than three stay pinned. */
export function sanitizeAwards(raw: unknown): Award[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Award[] = [];
  let pinned = 0;
  for (const a of raw) {
    if (!isValidAward(a) || seen.has(a.id)) continue;
    seen.add(a.id);
    const keepPin = a.pinned && !a.withdrawn && pinned < MAX_PINNED;
    if (keepPin) pinned++;
    out.push(a.pinned === keepPin ? a : { ...a, pinned: keepPin });
  }
  return out;
}

/** Things the person has done on this device, counted so participation medals can be earned. Never health data. */
export const COUNTERS = ["exports", "boostsGiven", "commentsMade", "communitiesJoined", "challengesCompleted"] as const;
export type CounterName = (typeof COUNTERS)[number];
export type Counters = Record<CounterName, number>;
export const emptyCounters = (): Counters => ({ exports: 0, boostsGiven: 0, commentsMade: 0, communitiesJoined: 0, challengesCompleted: 0 });
export function sanitizeCounters(raw: unknown): Counters {
  const out = emptyCounters();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const k of COUNTERS) {
    const n = (raw as Record<string, unknown>)[k];
    if (typeof n === "number" && Number.isInteger(n) && n > 0) out[k] = n;
  }
  return out;
}

/** A participation challenge the person marked as done. Completing one never depends on glucose. */
export type ChallengeCompletion = { id: string; completedAt: number };
export function sanitizeChallenges(raw: unknown): ChallengeCompletion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ChallengeCompletion[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const { id, completedAt } = c as Record<string, unknown>;
    if (typeof id !== "string" || !id || seen.has(id) || typeof completedAt !== "number" || !Number.isFinite(completedAt)) continue;
    seen.add(id);
    out.push({ id, completedAt });
  }
  return out;
}
