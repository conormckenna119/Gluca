import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useDemo } from "../store";
import { getFlags, isEnabled } from "../flags";
import {
  MAX_PINNED,
  type AchievementDef,
  type Award,
  type AwardVisibility,
} from "../domain/achievements";
import {
  availableRules,
  evaluateAwards,
  pinAward,
  setAwardVisibility,
  unpinAward,
  visibleAwards,
} from "../achievements/engine";
import { ALL_RULES } from "../achievements/life";
import { getDef } from "../achievements/registry";
import { CHALLENGES, completeChallenge } from "../achievements/challenges";

// Newly earned awards waiting for the unlock toast. Module-level so one host in the root layout can show them.
let queue: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => queue;
export const enqueueUnlocks = (ids: string[]) => {
  const fresh = ids.filter((id) => !queue.includes(id));
  if (!fresh.length) return;
  queue = [...queue, ...fresh];
  emit();
};
export const dismissUnlock = (id: string) => {
  queue = queue.filter((x) => x !== id);
  emit();
};
export const useUnlockQueue = () =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

export type PinOutcome = { ok: boolean; reason?: string };

/**
 * Read and act on medals. Pass `{ evaluate: true }` from exactly one place (the root layout): it checks for newly
 * earned medals when the relevant state changes. It only ever adds awards.
 */
export function useAchievements(opts: { evaluate?: boolean } = {}) {
  const { state, set, ready } = useDemo();
  const on = isEnabled("achievements");
  const {
    posts,
    events,
    counters,
    challenges,
    clubs,
    profile,
    privacy,
    awards,
  } = state;

  useEffect(() => {
    if (!opts.evaluate || !on || !ready) return;
    const { added } = evaluateAwards(ALL_RULES, {
      state,
      now: Date.now(),
      flags: getFlags(),
    });
    if (!added.length) return;
    set((s) => {
      const have = new Set(s.awards.map((a) => a.id));
      const fresh = added.filter((a) => !have.has(a.id));
      return fresh.length ? { ...s, awards: [...s.awards, ...fresh] } : s;
    });
    enqueueUnlocks(added.map((a) => a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts.evaluate,
    on,
    ready,
    posts,
    events,
    counters,
    challenges,
    clubs,
    profile,
    privacy.healthAchievements,
  ]);

  const earned = useMemo(() => (on ? visibleAwards(awards) : []), [on, awards]);
  const defs = useMemo(
    () => availableRules(ALL_RULES, getFlags(), privacy).map((r) => r.def),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [privacy, on],
  );

  const pin = useCallback(
    (id: string): PinOutcome => {
      const r = pinAward(state.awards, id);
      if (r.reason) {
        const names = visibleAwards(state.awards)
          .filter((a) => a.pinned)
          .map((a) => getDef(a.achievementId)?.name ?? "A medal");
        return {
          ok: false,
          reason: `Your profile already shows ${MAX_PINNED} medals: ${names.join(", ")}. Unpin one first.`,
        };
      }
      set((s) => ({ ...s, awards: pinAward(s.awards, id).awards }));
      return { ok: true };
    },
    [state.awards, set],
  );
  const unpin = useCallback(
    (id: string) => set((s) => ({ ...s, awards: unpinAward(s.awards, id) })),
    [set],
  );
  const setVisibility = useCallback(
    (id: string, v: AwardVisibility) =>
      set((s) => ({ ...s, awards: setAwardVisibility(s.awards, id, v) })),
    [set],
  );
  const complete = useCallback(
    (id: string) =>
      set((s) => ({ ...s, ...completeChallenge(s, id, Date.now()) })),
    [set],
  );

  return {
    enabled: on,
    awards: earned as Award[],
    defs: defs as AchievementDef[],
    challenges: CHALLENGES,
    completed: state.challenges,
    pin,
    unpin,
    setVisibility,
    completeChallenge: complete,
  };
}
