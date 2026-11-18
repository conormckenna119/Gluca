import type { Ctx } from "./http";
import { HttpError } from "./http";
import { getCommunity } from "../src/domain/community-discovery";
import { decrypt } from "./crypto";
import { sanitizePrivacy } from "../src/domain/profile";
export function communityDefinition(id: unknown) {
  const c = getCommunity(id);
  if (!c) throw new HttpError(404, "not_found", "Community unavailable.");
  return c;
}
export function membership(ctx: Ctx, id: string, user = ctx.session!.userId) {
  return ctx.deps.db
    .prepare(
      "SELECT active,visible,restricted FROM community_memberships WHERE community_id=? AND user_id=?",
    )
    .get(id, user) as
    { active: number; visible: number; restricted: number } | undefined;
}
export function requireCommunityMember(ctx: Ctx, id: string) {
  communityDefinition(id);
  const m = membership(ctx, id);
  if (!m?.active || m.restricted)
    throw new HttpError(
      403,
      "membership_required",
      "Join this community to view its posts.",
    );
}
export function sharesMemberships(ctx: Ctx, owner: string) {
  const r = ctx.deps.db
    .prepare("SELECT payload_enc FROM user_profiles WHERE user_id=?")
    .get(owner) as { payload_enc: string } | undefined;
  if (!r || !ctx.deps.tokenKey) return false;
  return sanitizePrivacy(
    JSON.parse(decrypt(r.payload_enc, ctx.deps.tokenKey, `profile:v1:${owner}`))
      .privacy,
  ).showMemberships;
}
export function sharedCommunities(ctx: Ctx, owner: string) {
  if (!sharesMemberships(ctx, owner)) return [];
  const rows = ctx.deps.db
    .prepare(
      "SELECT community_id FROM community_memberships WHERE user_id=? AND active=1 AND visible=1 AND restricted=0",
    )
    .all(owner) as { community_id: string }[];
  return rows.flatMap((r) => {
    const c = getCommunity(r.community_id);
    return c ? [{ id: c.id, name: c.name }] : [];
  });
}
