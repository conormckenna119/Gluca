import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { getFlags } from "../flags";
import { captureAchievementScope } from "../achievements/events";
import type { Participation } from "../achievements/challenges";
import {
  challengeRequest,
  onChallengeChanged,
  type ChallengeCommand,
} from "../services/community-challenges";
import { onSessionEvent } from "../services/session-events";
import { onFeedPublished } from "../services/feed-posts";
import { refreshChallengeAwards } from "./use-achievements";
export function useCommunityChallenges() {
  const [items, itemsSet] = useState<Participation[]>([]),
    [status, statusSet] = useState<"checking" | "guest" | "ready" | "error">(
      "checking",
    ),
    [error, errorSet] = useState(""),
    [busy, busySet] = useState(false);
  const epoch = useRef(0),
    alive = useRef(true),
    lock = useRef(false),
    reads = useRef(0);
  const reload = async () => {
    if (!getFlags().communityChallenges || Platform.OS !== "web") {
      statusSet("guest");
      return;
    }
    const generation = epoch.current,
      read = ++reads.current,
      scope = captureAchievementScope();
    try {
      const result = await challengeRequest();
      if (
        !alive.current ||
        generation !== epoch.current ||
        read !== reads.current ||
        scope !== captureAchievementScope()
      )
        return;
      itemsSet(result?.participations ?? []);
      statusSet(result ? "ready" : "guest");
      errorSet("");
      if (result) void refreshChallengeAwards(scope, []);
    } catch (e) {
      if (alive.current && generation === epoch.current) {
        statusSet("error");
        errorSet((e as Error).message);
      }
    }
  };
  useEffect(() => {
    alive.current = true;
    void reload();
    const session = onSessionEvent((e, _remote, reason) => {
      if (reason !== "account") return;
      epoch.current++;
      reads.current++;
      itemsSet([]);
      errorSet("");
      lock.current = false;
      busySet(false);
      statusSet("checking");
      if (e === "check") void reload();
    });
    const changes = onChallengeChanged((scope) => {
      if (scope === captureAchievementScope()) void reload();
    });
    const posts = onFeedPublished(() => void reload());
    return () => {
      alive.current = false;
      epoch.current++;
      session();
      changes();
      posts();
    };
  }, []);
  const mutate = async (command: ChallengeCommand) => {
    if (lock.current) return false;
    lock.current = true;
    busySet(true);
    errorSet("");
    const generation = epoch.current,
      scope = captureAchievementScope();
    try {
      const result = await challengeRequest(command);
      if (
        !alive.current ||
        generation !== epoch.current ||
        scope !== captureAchievementScope()
      )
        return false;
      if (result) itemsSet(result.participations);
      statusSet("ready");
      return true;
    } catch (e) {
      if (alive.current && generation === epoch.current)
        errorSet((e as Error).message);
      return false;
    } finally {
      if (alive.current && generation === epoch.current) {
        lock.current = false;
        busySet(false);
      }
    }
  };
  return { items, status, error, busy, reload, mutate };
}
