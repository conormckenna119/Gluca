// Life and community achievements. Participation only: nothing here reads glucose values.
// Health achievements are a separate, later, flagged task; add a HEALTH_RULES list beside LIFE_RULES then.
import { HEALTH_RULES } from "./health";
import type { AchievementDef } from "../domain/achievements";
import type { Rule, RuleContext, RuleResult } from "./engine";
import { periodKey } from "./period";

const base: Pick<
  AchievementDef,
  | "period"
  | "defaultVisibility"
  | "repeatable"
  | "ruleVersion"
  | "safetyReview"
  | "flag"
  | "needsHealthOptIn"
> = {
  period: "none",
  defaultVisibility: "private",
  repeatable: "once",
  ruleVersion: 2,
  safetyReview: "not_required",
  flag: "achievements",
  needsHealthOptIn: false,
};
const mk = (
  d: Omit<AchievementDef, keyof typeof base> & Partial<typeof base>,
): AchievementDef => ({ ...base, ...d });
const once = (ok: boolean): RuleResult[] => (ok ? [{ periodKey: "" }] : []);
const challengeDone = (c: RuleContext, id: string) =>
  c.state.challenges.some((x) => x.id === id);

export const FIRST_POST = mk({
  id: "first_post",
  name: "First Post",
  description:
    "You published your first non-private post to the local demo feed.",
  category: "community",
  icon: "post",
  requiredData: ["posts"],
});
export const FIRST_ACTIVITY = mk({
  id: "first_activity",
  name: "First Activity",
  description: "You saved your first activity in Gluca.",
  category: "life",
  icon: "activity",
  requiredData: ["events"],
});
export const FIRST_STORY = mk({
  id: "first_story",
  name: "First Story",
  description: "You exported your first story image.",
  category: "life",
  icon: "story",
  requiredData: ["exports"],
});
export const DIAGNOSIS_ANNIVERSARY = mk({
  id: "diagnosis_anniversary",
  name: "Dia-versary",
  description:
    "Your anniversary, when a complete, non-approximate diagnosis date supports it.",
  category: "life",
  icon: "anniversary",
  requiredData: ["profile"],
  period: "year",
  repeatable: "yearly",
});
export const PERSONAL_MILESTONE = mk({
  id: "personal_milestone",
  name: "Personal Milestone",
  description: "You added a personal milestone.",
  category: "life",
  icon: "milestone",
  requiredData: ["challenges"],
});
export const AWARENESS_CONTRIBUTION = mk({
  id: "awareness_contribution",
  name: "Awareness",
  description: "You confirmed taking part in a diabetes awareness activity.",
  category: "community",
  icon: "awareness",
  requiredData: ["challenges"],
});
export const COMMUNITY_PARTICIPATION = mk({
  id: "community_participation",
  name: "Community Contributor",
  description:
    "You contributed three posts or comments to the local community.",
  category: "community",
  icon: "community",
  requiredData: ["posts", "reactions"],
});
export const FIRST_SUPPORT = mk({
  id: "first_support",
  name: "Community Boost",
  description: "You gave a Boost or left a comment in the local community.",
  category: "community",
  icon: "support",
  requiredData: ["reactions"],
});
export const ACTIVITY_ACCOMPLISHMENT = mk({
  id: "activity_accomplishment",
  name: "Activity of your choice",
  description: "You did an activity you chose, your way.",
  category: "life",
  icon: "goal",
  requiredData: ["challenges"],
});

/** Exact anniversary day in the backend local calendar. Never infer unknown precision. */
export function anniversaryHits(
  diagnosis:
    | { year: number; month?: number; day?: number; approximate?: boolean }
    | undefined,
  now: number,
): RuleResult[] {
  if (!diagnosis || !diagnosis.month || !diagnosis.day || diagnosis.approximate)
    return [];
  const today = new Date(now),
    y = today.getFullYear();
  if (y <= diagnosis.year) return [];
  // JS maps Feb 29 to March 1 in non-leap years, matching the shield policy.
  const anniversary = new Date(y, diagnosis.month - 1, diagnosis.day);
  return today.getMonth() === anniversary.getMonth() &&
    today.getDate() === anniversary.getDate()
    ? [{ periodKey: periodKey("year", now) }]
    : [];
}

export const LIFE_RULES: Rule[] = [
  {
    def: FIRST_POST,
    evaluate: (c) => once(c.state.posts.some((p) => p.author === "You")),
  },
  {
    def: FIRST_ACTIVITY,
    evaluate: (c) => once(c.state.events.some((e) => e.kind === "activity")),
  },
  { def: FIRST_STORY, evaluate: (c) => once(c.state.counters.exports >= 1) },
  {
    def: DIAGNOSIS_ANNIVERSARY,
    evaluate: (c) => anniversaryHits(c.state.profile.diagnosis, c.now),
  },
  {
    def: PERSONAL_MILESTONE,
    evaluate: (c) => once(challengeDone(c, "personal_milestone")),
  },
  {
    def: AWARENESS_CONTRIBUTION,
    evaluate: (c) => once(challengeDone(c, "awareness_event")),
  },
  {
    def: COMMUNITY_PARTICIPATION,
    evaluate: (c) =>
      once(
        c.state.counters.communitiesJoined >= 1 || c.state.clubs.length >= 1,
      ),
  },
  {
    def: FIRST_SUPPORT,
    evaluate: (c) =>
      once(
        c.state.counters.boostsGiven >= 1 || c.state.counters.commentsMade >= 1,
      ),
  },
  {
    def: ACTIVITY_ACCOMPLISHMENT,
    evaluate: (c) => once(challengeDone(c, "activity_of_choice")),
  },
];

/** Every rule the engine knows. Health rules join this list only after a safety review. */
// Health rules are included here but only exist for a person when the `healthAchievements` flag is on and they
// opted in (see availableRules in engine.ts and docs/ACHIEVEMENT_SAFETY.md).
export const ALL_RULES: Rule[] = [
  ...LIFE_RULES,
  ...HEALTH_RULES.map((r) => ({ ...r, def: { ...r.def, disabled: true } })),
];
