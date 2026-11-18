import { captureAchievementScope } from "../achievements/events";
import type { Participation } from "../achievements/challenges";
export type ChallengeCommand = {
  action: "join" | "leave" | "complete";
  challengeId: string;
  enrollmentId?: string;
  confirmed?: boolean;
  communityId?: string;
  joinedCommunity?: boolean;
  meaningfulInteraction?: boolean;
  source?: "activity_log";
};
export type ChallengeResponse = {
  participations: Participation[];
  unlockedIds: string[];
};
const listeners = new Set<(scope: number, unlockedIds: string[]) => void>();
export function onChallengeChanged(
  fn: (scope: number, unlockedIds: string[]) => void,
) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function challengeRequest(
  body?: ChallengeCommand,
): Promise<ChallengeResponse | null> {
  const scope = captureAchievementScope();
  const r = await fetch("/api/challenges", {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.status === 401 && !body) return null;
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? "Sign in to manage your challenges."
        : r.status === 409
          ? "Enrollment changed or the challenge is unavailable. Reload before trying again."
          : r.status === 400
            ? "Check the completion conditions. Only a new Public post can complete Share a Moment."
            : "Challenge service unavailable. Reload to check whether your action was saved before retrying.",
    );
  const result = (await r.json()) as ChallengeResponse;
  if (body && scope === captureAchievementScope())
    listeners.forEach((fn) => fn(scope, result.unlockedIds));
  return result;
}
