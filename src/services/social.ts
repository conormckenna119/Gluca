import { captureAchievementScope } from "../achievements/events";
import type { Post } from "../types";
import type { PublicProfile } from "../domain/profile";
import { onSessionEvent } from "./session-events";
export type SocialComment = {
  id: string;
  authorId: string;
  authorProfile: PublicProfile;
  owned: boolean;
  text: string;
  createdAt: number;
};
export type Relationship = {
  id: string;
  owned: boolean;
  following: boolean;
  followers: number;
  followingCount: number;
};
export type SocialNotification = {
  actorId: string;
  actor: Pick<PublicProfile, "name" | "username">;
  kind: "boost" | "comment" | "follow";
  postId?: string;
  createdAt: number;
  seen: boolean;
};
export type SocialResult = {
  post: Post;
  comments?: SocialComment[];
  unlockedIds?: string[];
};
export class SocialError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function socialRequest<T>(
  path: string,
  body?: unknown,
  prefix = "/api/social",
): Promise<T> {
  const scope = captureAchievementScope();
  const r = await fetch(`${prefix}${path ? `/${path}` : ""}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (scope !== captureAchievementScope())
    throw new SocialError("Account changed. Reload before trying again.", 409);
  if (!r.ok)
    throw new SocialError(
      r.status === 401
        ? "Sign in to use community interactions."
        : r.status === 404
          ? "This post or member is unavailable."
          : r.status === 429
            ? "Too many requests. Wait a minute before retrying."
            : "The change could not be confirmed. Refresh to check before retrying.",
      r.status,
    );
  const result = await r.json();
  if (scope !== captureAchievementScope())
    throw new SocialError("Account changed. Reload before trying again.", 409);
  return result;
}
const refreshers = new Set<() => void>();
export function refreshSocial() {
  refreshers.forEach((f) => f());
}
export function onSocialRefresh(f: () => void) {
  refreshers.add(f);
  return () => {
    refreshers.delete(f);
  };
}
// Shared across feed/detail mounts. Explicit desired state makes network retries idempotent.
const pendingBoosts = new Set<string>();
export function acquireBoost(id: string) {
  const key = `${captureAchievementScope()}:${id}`;
  if (pendingBoosts.has(key)) return false;
  pendingBoosts.add(key);
  return true;
}
export function releaseBoost(id: string, scope = captureAchievementScope()) {
  pendingBoosts.delete(`${scope}:${id}`);
}
onSessionEvent((_e, _r, reason) => {
  if (reason === "account") pendingBoosts.clear();
});
