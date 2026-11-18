import { REACTION_WORDS } from "../reaction-copy";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { captureAchievementScope } from "../achievements/events";
import { onSessionEvent } from "../services/session-events";
import { feedPublished } from "../services/feed-posts";
import {
  onSocialRefresh,
  refreshSocial,
  socialRequest,
  type Relationship,
  type SocialComment,
  type SocialNotification,
  type SocialResult,
} from "../services/social";
import type { PublicProfile } from "../domain/profile";
import type { Post } from "../types";
import { AuthorIdentity } from "./identity/user-identity";
import { Button, Card, Input, Notice, Sheet, T, space } from "../ui";

function useResource<T>(path: string) {
  const [data, D] = useState<T | null>(null),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  const epoch = useRef(0),
    mounted = useRef(true),
    lock = useRef(false);
  const reload = async () => {
    const scope = captureAchievementScope(),
      read = ++epoch.current;
    try {
      const result = await socialRequest<T>(path);
      if (
        mounted.current &&
        scope === captureAchievementScope() &&
        read === epoch.current
      ) {
        D(result);
        E("");
      }
    } catch (e) {
      if (
        mounted.current &&
        scope === captureAchievementScope() &&
        read === epoch.current
      ) {
        D(null);
        E((e as Error).message);
      }
    }
  };
  useEffect(() => {
    mounted.current = true;
    D(null);
    E("");
    void reload();
    const session = onSessionEvent((event, _r, reason) => {
      if (reason !== "account") return;
      epoch.current++;
      D(null);
      E("");
      if (event === "check") void reload();
    });
    const refresh = onSocialRefresh(() => void reload());
    return () => {
      mounted.current = false;
      epoch.current++;
      session();
      refresh();
    };
  }, [path]);
  const act = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    B(true);
    E("");
    const scope = captureAchievementScope();
    try {
      await fn();
      if (scope === captureAchievementScope()) refreshSocial();
    } catch (e) {
      if (mounted.current && scope === captureAchievementScope())
        E((e as Error).message);
    } finally {
      lock.current = false;
      if (mounted.current) B(false);
    }
  };
  return { data, error, busy, reload, act };
}
export function MemberActions({
  id,
  profile,
  compact = false,
}: {
  id?: string;
  profile?: PublicProfile;
  compact?: boolean;
}) {
  const { data, error, busy, act } = useResource<Relationship>(
    `member${id ? `?id=${encodeURIComponent(id)}` : ""}`,
  );
  const [confirm, C] = useState(false),
    [detail, S] = useState(false);
  const [blocks, K] = useState<{ id: string; profile: PublicProfile }[]>([]);
  const openProfile = () => {
    if (profile?.username)
      router.push({
        pathname: "/profile",
        params: { username: profile.username },
      });
    else S(true);
  };
  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space.sm,
          alignItems: "center",
        }}
      >
        {compact ? (
          <Button
            label={`View ${profile?.username ? `@${profile.username}` : (profile?.name ?? "member")}`}
            onPress={openProfile}
          />
        ) : null}
        {data && !compact ? (
          <T small muted>
            {data.followers} followers · {data.followingCount} following
          </T>
        ) : null}
        {data && !data.owned ? (
          <Button
            disabled={busy}
            label={data.following ? "Unfollow" : "Follow"}
            onPress={() =>
              void act(async () => {
                await socialRequest("follow", {
                  id: data.id,
                  active: !data.following,
                });
              })
            }
          />
        ) : null}
        {data && !data.owned && !compact ? (
          <Button label="Block member" onPress={() => C(true)} />
        ) : null}
        {data?.owned && !compact ? (
          <Button
            label="Blocked members"
            onPress={() =>
              void act(async () => {
                const r = await socialRequest<{ blocks: typeof blocks }>(
                  "blocks",
                );
                K(r.blocks);
                S(true);
              })
            }
          />
        ) : null}
        {!data && error ? (
          <T small muted>
            {error}
          </T>
        ) : null}
      </View>
      {error && data ? <Notice>{error}</Notice> : null}
      <Sheet
        visible={confirm}
        title="Block this member?"
        onClose={() => C(false)}
      >
        <T>
          Your posts and interactions will be hidden from each other. Follows
          and mutual Boosts will be removed. Unblock from your profile.
        </T>
        <Button
          label="Confirm block"
          disabled={busy}
          onPress={() =>
            void act(async () => {
              await socialRequest("block", { id, active: true });
              C(false);
              router.replace("/");
            })
          }
        />
      </Sheet>
      <Sheet
        visible={detail}
        title={data?.owned ? "Blocked members" : "Member"}
        onClose={() => S(false)}
      >
        {data?.owned ? (
          <>
            {!blocks.length ? (
              <T>No blocked members.</T>
            ) : (
              blocks.map((b) => (
                <View key={b.id} style={{ gap: space.sm }}>
                  <T>{b.profile.name}</T>
                  <Button
                    label={`Unblock ${b.profile.name}`}
                    disabled={busy}
                    onPress={() =>
                      void act(async () => {
                        await socialRequest("block", {
                          id: b.id,
                          active: false,
                        });
                        K((x) => x.filter((y) => y.id !== b.id));
                      })
                    }
                  />
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <AuthorIdentity
              name={profile?.name ?? "Member"}
              profile={profile}
            />
            {data ? (
              <T>
                {data.followers} followers · {data.followingCount} following
              </T>
            ) : null}
            <Button
              label="Block member"
              onPress={() => {
                S(false);
                C(true);
              }}
            />
          </>
        )}
      </Sheet>
    </View>
  );
}
export function AccountConversation({ post }: { post: Post }) {
  const { data, error, busy, act, reload } = useResource<{
    comments: SocialComment[];
  }>(`comments?id=${encodeURIComponent(post.id)}`);
  const [text, TEXT] = useState("");
  useEffect(
    () =>
      onSessionEvent((_e, _r, reason) => {
        if (reason === "account") {
          TEXT("");
          receipt.current = { text: "", id: "" };
        }
      }),
    [],
  );
  // Keep the receipt stable when retrying an uncertain network outcome.
  const receipt = useRef({ text: "", id: "" });
  const send = () =>
    void act(async () => {
      const value = text.trim();
      if (!value) return;
      if (receipt.current.text !== value)
        receipt.current = { text: value, id: globalThis.crypto.randomUUID() };
      const scope = captureAchievementScope();
      const r = await socialRequest<SocialResult>("comments", {
        id: post.id,
        text: value,
        requestId: receipt.current.id,
      });
      if (scope !== captureAchievementScope()) return;
      feedPublished(r.post);
      TEXT("");
      receipt.current = { text: "", id: "" };
    });
  return (
    <View style={{ gap: space.md }}>
      <T heading>Comments · {post.commentCount ?? 0}</T>
      {error ? <Notice>{error}</Notice> : null}
      {!data && !error ? <T muted>Loading comments…</T> : null}
      {data && !data.comments.length ? <T muted>No comments yet.</T> : null}
      {data?.comments.map((c) => (
        <Card key={c.id}>
          <Pressable
            accessibilityRole={c.authorProfile.username ? "button" : undefined}
            disabled={!c.authorProfile.username}
            accessibilityLabel={
              c.authorProfile.username
                ? `Open profile for ${c.authorProfile.name}`
                : undefined
            }
            onPress={() => {
              if (c.authorProfile.username)
                router.push({
                  pathname: "/profile",
                  params: { username: c.authorProfile.username },
                });
            }}
          >
            <AuthorIdentity
              name={c.authorProfile.name}
              profile={c.authorProfile}
            />
          </Pressable>
          {!c.authorProfile.username ? (
            <MemberActions id={c.authorId} profile={c.authorProfile} compact />
          ) : null}
          <T>{c.text}</T>
          {c.owned ? (
            <Button
              label="Delete my comment"
              disabled={busy}
              onPress={() =>
                void act(async () => {
                  await socialRequest("comments/delete", { id: c.id });
                })
              }
            />
          ) : null}
        </Card>
      ))}
      <Card>
        <Input
          label="Your comment"
          multiline
          value={text}
          onChange={(v) => TEXT(v.slice(0, 1000))}
        />
        <T small muted>
          Comments share the post’s audience. Avoid sharing private health
          details.
        </T>
        <Button
          kind="primary"
          label={busy ? "Saving…" : "Post comment"}
          disabled={busy || !text.trim() || !data}
          onPress={send}
        />
      </Card>
      <Button label="Refresh comments" onPress={() => void reload()} />
      {(post.commentCount ?? 0) > 100 ? (
        <T small muted>
          Showing the latest 100 comments.
        </T>
      ) : null}
    </View>
  );
}
export function SocialInbox() {
  const { data, error, busy, act, reload } = useResource<{
    notifications: SocialNotification[];
  }>("notifications");
  const [open, O] = useState(false),
    [settings, S] = useState(false);
  const unread = data?.notifications.filter((n) => !n.seen).length ?? 0;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button
          label={`Notifications${unread ? ` (${unread})` : ""}`}
          onPress={() => {
            void reload();
            O(true);
          }}
        />
        <Button label="Refresh feed" onPress={refreshSocial} />
      </View>
      <Sheet visible={open} title="Notifications" onClose={() => O(false)}>
        <T small muted>
          Community updates stay inside Gluca. Repeated interactions on the same
          post are grouped by person.
        </T>
        {error ? <Notice>{error}</Notice> : null}
        {!data && !error ? <T>Loading notifications…</T> : null}
        {data && !data.notifications.length ? (
          <T>No notifications yet.</T>
        ) : null}
        {data?.notifications.map((n) => (
          <Button
            key={`${n.actorId}:${n.kind}:${n.postId ?? "follow"}`}
            label={`${n.actor.name} ${n.kind === "boost" ? `gave your post ${REACTION_WORDS.boost.gaveObject}` : n.kind === "comment" ? "commented on your post" : "followed you"}${n.seen ? "" : " · New"}`}
            onPress={() => {
              O(false);
              if (n.postId) router.push(`/post/${n.postId}`);
              else if (n.actor.username)
                router.push({
                  pathname: "/profile",
                  params: { username: n.actor.username },
                });
              else S(true);
            }}
          />
        ))}
        <Button
          label="Mark all as read"
          disabled={busy || !unread}
          onPress={() =>
            void act(async () => {
              await socialRequest("notifications/read", {});
            })
          }
        />
      </Sheet>
      <Sheet visible={settings} title="New follower" onClose={() => S(false)}>
        <T>This member has not chosen a public username.</T>
      </Sheet>
    </View>
  );
}
