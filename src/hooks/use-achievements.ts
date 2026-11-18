import { useEffect, useSyncExternalStore } from "react";
import { useDemo } from "../store";
import { isEnabled } from "../flags";
import type { AwardVisibility } from "../domain/achievements";
import { LIFE_RULES } from "../achievements/life";
import { Platform, AppState } from "react-native";
import { onSessionEvent } from "../services/session-events";
import {
  applyEvent,
  editCabinet,
  emptyCabinet,
  onAchievementEvent,
  recordAchievementEvent,
  type Cabinet,
  type CabinetEdit,
  type AchievementEvent,
} from "../achievements/events";
import { CHALLENGES } from "../achievements/challenges";
import { onChallengeChanged } from "../services/community-challenges";
import { captureAchievementScope } from "../achievements/events";

// Newly earned awards waiting for the unlock toast. Module-level so one host in the root layout can show them.
let queue: string[] = [];
const announced = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => queue;
export const enqueueUnlocks = (ids: string[]) => {
  const fresh = ids.filter((id) => !queue.includes(id) && !announced.has(id));
  if (!fresh.length) return;
  fresh.forEach((id) => announced.add(id));
  queue = [...queue, ...fresh];
  emit();
};
export const dismissUnlock = (id: string) => {
  queue = queue.filter((x) => x !== id);
  emit();
};
export const useUnlockQueue = () =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

type CabinetStatus = "checking" | "account" | "guest" | "unavailable";
let cabinetState: { data: Cabinet; status: CabinetStatus; error: string } = {
  data: emptyCabinet(),
  status: "checking",
  error: "",
};
const cabinetListeners = new Set<() => void>();
const subscribeCabinet = (fn: () => void) => {
  cabinetListeners.add(fn);
  return () => {
    cabinetListeners.delete(fn);
  };
};
let cabinetEpoch = 0;
let pending = Promise.resolve();
let retryCabinet = () => {};
function publishCabinet(data: Cabinet, status: CabinetStatus, error: string) {
  cabinetState = { data, status, error };
  cabinetListeners.forEach((fn) => fn());
}
type Command = { event: AchievementEvent } | { edit: CabinetEdit };
async function cabinetRequest(body?: Command): Promise<Cabinet | null> {
  const r = await fetch("/api/achievements", {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.status === 401) {
    if (body) {
      cabinetEpoch++;
      queue = [];
      emit();
      publishCabinet(
        emptyCabinet(),
        "unavailable",
        "Sign in again to access your collection.",
      );
    }
    return null;
  }
  if (!r.ok)
    throw new Error(
      "Medal update could not be saved. Check your connection or pin limit.",
    );
  return r.json();
}
function transact(command: Command) {
  const epoch = cabinetEpoch,
    status = cabinetState.status;
  if (status !== "guest" && status !== "account") return Promise.resolve();
  pending = pending.then(async () => {
    if (epoch !== cabinetEpoch) return;
    try {
      const before = cabinetState.data;
      const next =
        status === "account"
          ? await cabinetRequest(command)
          : "event" in command
            ? applyEvent(before, command.event, "guest", Date.now())
            : editCabinet(before, command.edit);
      if (epoch !== cabinetEpoch || !next) return;
      publishCabinet(next, status, "");
      enqueueUnlocks(
        next.awards
          .filter((a) => !before.awards.some((b) => b.id === a.id))
          .map((a) => a.id),
      );
    } catch (e) {
      if (epoch === cabinetEpoch)
        publishCabinet(cabinetState.data, status, (e as Error).message);
    }
  });
  return pending;
}

export type PinOutcome = { ok: boolean; reason?: string };
/** Existing medal repository/notification queue, with explicit IDs newly awarded by a challenge. */
export function refreshChallengeAwards(scope: number, unlockedIds: string[]) {
  const epoch = cabinetEpoch;
  pending = pending.then(async () => {
    if (
      epoch !== cabinetEpoch ||
      scope !== captureAchievementScope() ||
      cabinetState.status !== "account"
    )
      return;
    try {
      const next = await cabinetRequest();
      if (
        !next ||
        epoch !== cabinetEpoch ||
        scope !== captureAchievementScope()
      )
        return;
      publishCabinet(next, "account", "");
      enqueueUnlocks(
        unlockedIds.filter((id) => next.awards.some((a) => a.id === id)),
      );
    } catch {
      /* Never invent an award or announce a failed write. */
    }
  });
  return pending;
}

/**
 * Read and act on medals. Pass `{ evaluate: true }` from exactly one place (the root layout): it checks for newly
 * earned medals when the relevant state changes. It only ever adds awards.
 */
export function useAchievements(opts: { evaluate?: boolean } = {}) {
  const { set, ready, state } = useDemo();
  const on = isEnabled("achievements");
  const record = useSyncExternalStore(
    subscribeCabinet,
    () => cabinetState,
    () => cabinetState,
  );
  useEffect(() => {
    if (!opts.evaluate || !on || !ready) return;
    let alive = true;
    const reset = () => {
      cabinetEpoch++;
      queue = [];
      announced.clear();
      emit();
      publishCabinet(emptyCabinet(), "checking", "");
    };
    const load = async () => {
      reset();
      const epoch = cabinetEpoch;
      try {
        const result = Platform.OS === "web" ? await cabinetRequest() : null;
        if (!alive || epoch !== cabinetEpoch) return;
        publishCabinet(
          result ?? emptyCabinet(),
          result ? "account" : "guest",
          "",
        );
        recordAchievementEvent("anniversary_checked");
      } catch {
        if (alive && epoch === cabinetEpoch)
          publishCabinet(
            emptyCabinet(),
            "unavailable",
            "Medal service unavailable. Retry when connected.",
          );
      }
    };
    void load();
    retryCabinet = () => {
      void load();
    };
    const stop = onSessionEvent((event, _remote, reason) => {
      if (reason !== "account") return;
      if (event === "check") void load();
      else reset();
    });
    const stopEvents = onAchievementEvent((event) => {
      void transact({ event });
    });
    const stopChallenges = onChallengeChanged((scope, ids) => {
      void refreshChallengeAwards(scope, ids);
    });
    return () => {
      alive = false;
      retryCabinet = () => {};
      cabinetEpoch++;
      stop();
      stopEvents();
      stopChallenges();
    };
  }, [opts.evaluate, on, ready]);
  useEffect(() => {
    if (opts.evaluate) set((s) => ({ ...s, awards: record.data.awards }));
  }, [opts.evaluate, record.data.awards, set]);
  useEffect(() => {
    if (!opts.evaluate || !on || record.status !== "account") return;
    const check = () => recordAchievementEvent("anniversary_checked");
    check();
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => listener.remove();
  }, [opts.evaluate, on, record.status, state.profile.diagnosis]);
  const pin = (id: string): PinOutcome => {
    try {
      editCabinet(record.data, { type: "pin", id, value: true });
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
    void transact({ edit: { type: "pin", id, value: true } });
    return { ok: true };
  };
  return {
    enabled: on,
    awards: on ? record.data.awards : [],
    defs: LIFE_RULES.filter(
      (r) =>
        !r.def.disabled &&
        isEnabled(r.def.flag) &&
        r.def.id !== "activity_accomplishment",
    ).map((r) => r.def),
    status: record.status,
    error: record.error,
    retry: () => retryCabinet(),
    collectionPublic: record.data.public,
    challenges: CHALLENGES.filter(
      (c) => c.id === "awareness_event" || c.id === "personal_milestone",
    ),
    completed: record.data.events.flatMap((e) =>
      e.kind === "awareness_confirmed"
        ? [
            {
              id: "awareness_event",
              completedAt:
                record.data.awards.find(
                  (a) => a.achievementId === "awareness_contribution",
                )?.awardedAt ?? 0,
            },
          ]
        : e.kind === "milestone_confirmed"
          ? [
              {
                id: "personal_milestone",
                completedAt:
                  record.data.awards.find(
                    (a) => a.achievementId === "personal_milestone",
                  )?.awardedAt ?? 0,
              },
            ]
          : [],
    ),
    pin,
    unpin: (id: string) =>
      void transact({ edit: { type: "pin", id, value: false } }),
    setVisibility: (id: string, v: AwardVisibility) =>
      void transact({
        edit: { type: "visibility", id, value: v === "public" },
      }),
    setCollectionPublic: (value: boolean) =>
      void transact({ edit: { type: "public", value } }),
    reorder: (ids: string[]) =>
      void transact({ edit: { type: "reorder", ids } }),
    completeChallenge: (id: string) => {
      if (id === "awareness_event" || id === "personal_milestone")
        recordAchievementEvent(
          id === "awareness_event"
            ? "awareness_confirmed"
            : "milestone_confirmed",
          id,
        );
    },
  };
}
