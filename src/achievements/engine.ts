// Achievement engine: decides which awards are new, and manages pinning, visibility and withdrawal.
// Pure TypeScript. Rules only say what the person currently qualifies for; the engine never removes or edits
// an existing award because a rule stopped matching (an earned award is never taken away).
import type { FlagState } from "../flags";
import type { State } from "../types";
import type { PrivacySettings } from "../domain/profile";
import {
  awardId,
  LOCAL_USER,
  MAX_PINNED,
  type AchievementCategory,
  type AchievementDef,
  type Award,
  type AwardVisibility,
  type MedalIcon,
} from "../domain/achievements";

export type RuleContext = { state: State; now: number; flags: FlagState };
export type RuleResult = {
  periodKey: string;
  snapshot?: Record<string, string | number>;
};
export type Rule = {
  def: AchievementDef;
  evaluate(ctx: RuleContext): RuleResult[];
};

/**
 * A def exists for the person only when ALL hold:
 *  1. its flag is on;
 *  2. it is not `disabled`;
 *  3. if it `needsHealthOptIn` (a health achievement): the person turned on `privacy.healthAchievements`
 *     (always required, with no exception), AND either `safetyReview === "approved"` or the
 *     `healthAchievements` flag is on (prototype mode, never for a public build before a clinical review).
 * Without the person's own opt-in a health achievement is not evaluated and is not listed as something to earn.
 */
export function availableDefs(
  rules: Rule[],
  flags: FlagState,
  privacy: PrivacySettings,
): AchievementDef[] {
  return availableRules(rules, flags, privacy).map((r) => r.def);
}

export function availableRules(
  rules: Rule[],
  flags: FlagState,
  privacy: PrivacySettings,
): Rule[] {
  return rules.filter(({ def }) => {
    if (!flags[def.flag] || def.disabled) return false;
    if (!def.needsHealthOptIn) return true;
    return (
      privacy.healthAchievements &&
      (def.safetyReview === "approved" || flags.healthAchievements)
    );
  });
}

/** Idempotent: awards already present (including withdrawn ones) are kept untouched and never re-created. */
export function evaluateAwards(
  rules: Rule[],
  ctx: RuleContext,
): { awards: Award[]; added: Award[] } {
  const awards = [...ctx.state.awards];
  const seen = new Set(awards.map((a) => a.id));
  const added: Award[] = [];
  for (const { def, evaluate } of availableRules(
    rules,
    ctx.flags,
    ctx.state.privacy,
  )) {
    for (const hit of evaluate(ctx)) {
      const periodKey = def.repeatable === "once" ? "" : hit.periodKey;
      const id = awardId(LOCAL_USER, def.id, periodKey);
      if (seen.has(id)) continue;
      seen.add(id);
      const award: Award = {
        id,
        userId: LOCAL_USER,
        achievementId: def.id,
        awardedAt: ctx.now,
        periodKey,
        ruleVersion: def.ruleVersion,
        visibility: def.defaultVisibility,
        pinned: false,
      };
      if (hit.snapshot) award.snapshot = { ...hit.snapshot };
      awards.push(award);
      added.push(award);
    }
  }
  return { awards, added };
}

export type PinResult = { awards: Award[]; reason?: string };

export function pinAward(awards: Award[], id: string): PinResult {
  const a = awards.find((x) => x.id === id);
  if (!a) return { awards, reason: "Award not found." };
  if (a.withdrawn)
    return { awards, reason: "A withdrawn award cannot be pinned." };
  if (a.pinned) return { awards };
  if (awards.filter((x) => x.pinned && !x.withdrawn).length >= MAX_PINNED) {
    return {
      awards,
      reason: `You can pin up to ${MAX_PINNED} awards. Unpin one first.`,
    };
  }
  return {
    awards: awards.map((x) => (x.id === id ? { ...x, pinned: true } : x)),
  };
}

export function unpinAward(awards: Award[], id: string): Award[] {
  return awards.map((x) =>
    x.id === id && x.pinned ? { ...x, pinned: false } : x,
  );
}

export function setAwardVisibility(
  awards: Award[],
  id: string,
  visibility: AwardVisibility,
): Award[] {
  return awards.map((x) =>
    x.id === id && !x.withdrawn ? { ...x, visibility } : x,
  );
}

/** For awards found to be erroneous. Hidden everywhere afterwards, kept so it is not re-awarded. */
export function withdrawAward(
  awards: Award[],
  id: string,
  reason: string,
  now: number,
): Award[] {
  return awards.map((x) =>
    x.id === id && !x.withdrawn
      ? { ...x, pinned: false, withdrawn: { at: now, reason } }
      : x,
  );
}

export const visibleAwards = (awards: Award[]): Award[] =>
  awards.filter((a) => !a.withdrawn);
export const publicAwards = (awards: Award[]): Award[] =>
  awards.filter((a) => !a.withdrawn && a.visibility === "public");

export type PublicMedal = {
  name: string;
  icon: MedalIcon;
  category: AchievementCategory;
  year: number;
};

/** What another person may see: name, icon, category and the year earned. Never the snapshot or the exact time. */
export function publicMedal(award: Award, def: AchievementDef): PublicMedal {
  return {
    name: def.name,
    icon: def.icon,
    category: def.category,
    year: new Date(award.awardedAt).getFullYear(),
  };
}
