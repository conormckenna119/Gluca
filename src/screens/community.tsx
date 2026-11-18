import { getFlags } from "../flags";
import React, { useEffect, useRef, useState } from "react";
import { Platform, View, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Page } from "../components/page";
import {
  useCommunities,
  type AccountCommunity,
} from "../components/community-discovery";
import { getCommunity } from "../domain/community-discovery";
import { Button, Card, Input, Notice, Sheet, SwitchRow, T, space } from "../ui";
import { useResource, MemberActions } from "../components/social-interactions";
import { AuthorIdentity } from "../components/identity/user-identity";
import {
  socialRequest,
  refreshSocial,
  onSocialRefresh,
} from "../services/social";
import {
  feedRequest,
  feedPublished,
  onFeedPublished,
  type PublishInput,
} from "../services/feed-posts";
import { captureAchievementScope } from "../achievements/events";
import { onSessionEvent } from "../services/session-events";
import { useDemo } from "../store";
import { PostCard } from "../components/post-card";
import type { Post } from "../types";
import type { PublicProfile } from "../domain/profile";
import { PhotoBackground } from "../components/create/photo-background";
import { exportImage } from "../export";
import { ReportAction } from "../components/community-report";

export function Community() {
  return getFlags().accounts && getFlags().clubs && Platform.OS === "web" ? (
    <CommunityBody />
  ) : (
    <Page title="Communities">
      <T>
        Account communities are available in the web app when accounts and clubs
        are enabled.
      </T>
      <Button
        label="Back to Discover"
        onPress={() => router.replace("/explore")}
      />
    </Page>
  );
}
function CommunityBody() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    definition = getCommunity(id);
  const { data, error, busy, act } = useCommunities(),
    { state } = useDemo();
  const [members, M] = useState(false),
    [leave, L] = useState(false);
  const c = data?.communities.find((c) => c.id === id);
  if (!definition)
    return (
      <Page title="Community unavailable">
        <Button
          label="Back to Discover"
          onPress={() => router.replace("/explore")}
        />
      </Page>
    );
  const action = (action: string, visible?: boolean) =>
    void act(async () => {
      await socialRequest(
        "membership",
        { id, action, visible },
        "/api/communities",
      );
      L(false);
    });
  return (
    <Page title={definition.name} subtitle={definition.blurb} accountCommunity>
      <Button
        label="Back to Discover"
        onPress={() => router.replace("/explore")}
      />
      <Card>
        <T small muted>
          Shared experiences, not medical guidance. Members do not gain access
          to anyone’s Dexcom account or private glucose history.
        </T>
        {c ? (
          <T>
            {c.memberCount} public members · Private memberships are excluded.
          </T>
        ) : null}
        {error ? (
          <>
            <Notice>{error}</Notice>
            <Button label="Sign in" onPress={() => router.push("/account")} />
          </>
        ) : null}
        {c?.restricted ? (
          <Notice>
            Your membership is restricted. Contact the application operator for
            review.
          </Notice>
        ) : c ? (
          <Button
            label={c.joined ? "Leave community" : "Join community"}
            disabled={busy}
            onPress={() => (c.joined ? L(true) : action("join"))}
          />
        ) : null}
        {c?.joined ? (
          <>
            <T small bold>
              Joined ·{" "}
              {c.visible && state.privacy.showMemberships
                ? "Public membership"
                : "Private membership"}
            </T>
            <SwitchRow
              title="List this membership publicly"
              value={c.visible}
              onChange={(v) => {
                if (!busy) action("visibility", v);
              }}
              detail="Public listing can reveal an interest in this topic. It does not verify a diagnosis or device."
            />
            {!state.privacy.showMemberships ? (
              <Button
                label="Membership privacy settings"
                onPress={() => router.push("/settings")}
              />
            ) : null}
            {!state.privacy.showMemberships ? (
              <T small muted>
                Your global membership privacy setting is off. Even if this
                switch is on, your membership remains hidden until you enable
                Display community memberships in Settings.
              </T>
            ) : null}
          </>
        ) : null}
        {c ? (
          <Button label="View public members" onPress={() => M(true)} />
        ) : null}
        <ReportAction kind="community" id={id} />
      </Card>
      {c?.joined ? (
        <CommunityFeed key={id} community={c} />
      ) : (
        <T muted>
          Join explicitly to read or publish community posts. Browsing never
          joins a community.
        </T>
      )}
      <Sheet visible={members} title="Public members" onClose={() => M(false)}>
        {members ? <PublicMembers id={id} /> : null}
      </Sheet>
      <Sheet visible={leave} title="Leave community?" onClose={() => L(false)}>
        <T>
          You will lose access to other members’ community posts. Your existing
          posts and comments remain until you delete them; your own posts remain
          available from your profile.
        </T>
        <Button
          label="Confirm leave"
          disabled={busy}
          onPress={() => action("leave")}
        />
      </Sheet>
    </Page>
  );
}
function PublicMembers({ id }: { id: string }) {
  const { data, error } = useResource<{
    members: { id: string; profile: PublicProfile }[];
    memberCount: number;
  }>(`members?id=${encodeURIComponent(id)}`, "/api/communities");
  return (
    <View style={{ gap: space.md }}>
      <T small muted>
        Only explicitly public memberships are listed. Private members are never
        listed, including to community moderators.
      </T>
      {error ? <Notice>{error}</Notice> : null}
      {!data && !error ? <T>Loading public members…</T> : null}
      {data && !data.members.length ? <T>No public memberships yet.</T> : null}
      {data?.members.map((m) => (
        <Card key={m.id}>
          <AuthorIdentity name={m.profile.name} profile={m.profile} />
          <MemberActions id={m.id} profile={m.profile} compact />
        </Card>
      ))}
      {data && data.memberCount > 50 ? (
        <T>Showing the first 50 public members.</T>
      ) : null}
    </View>
  );
}
function CommunityFeed({ community }: { community: AccountCommunity }) {
  const { data, error, reload } = useResource<{ posts: Post[] }>(
      "",
      `/api/posts?communityId=${encodeURIComponent(community.id)}`,
    ),
    { state } = useDemo();
  useEffect(() => onFeedPublished(() => void reload()), [community.id]);
  // Prefer the shared live post after a Boost/comment, so feed/detail use one reaction state.
  const posts =
    data?.posts.map((p) => state.posts.find((x) => x.id === p.id) ?? p) ?? [];
  return (
    <View style={{ gap: space.lg }}>
      <T heading>Community feed</T>
      <CommunityComposer community={community} />
      <Button label="Refresh community feed" onPress={refreshSocial} />
      {error ? <Notice>{error}</Notice> : null}
      {!data && !error ? <T>Loading posts…</T> : null}
      {data && !posts.length ? (
        <T>No posts yet. Share a moment when you choose.</T>
      ) : null}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </View>
  );
}
function CommunityComposer({ community }: { community: AccountCommunity }) {
  const [text, TEXT] = useState(""),
    [photo, PHOTO] = useState<string | null>(null),
    [alt, ALT] = useState(""),
    [busy, B] = useState(false),
    [error, E] = useState(""),
    [posted, P] = useState<string | null>(null);
  const lock = useRef(false),
    pending = useRef<PublishInput | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const stop = onSessionEvent(() => {
      pending.current = null;
      TEXT("");
      PHOTO(null);
      ALT("");
      P(null);
    });
    return () => {
      alive.current = false;
      stop();
    };
  }, []);
  const send = async () => {
    if (lock.current) return;
    lock.current = true;
    B(true);
    E("");
    const scope = captureAchievementScope();
    try {
      if (!pending.current) {
        let image: string | undefined;
        if (photo) {
          const result = await exportImage(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"></svg>',
            "Portrait",
            async () => {
              throw new Error("Web photo posting only.");
            },
            false,
            "community-photo.png",
            photo,
            true,
            () => scope === captureAchievementScope(),
            false,
          );
          image = result.dataUri ?? undefined;
        }
        if (scope !== captureAchievementScope() || !alive.current) return;
        pending.current = {
          requestId: globalThis.crypto.randomUUID(),
          communityId: community.id,
          visibility: "public",
          title: photo ? "Photo" : "Community update",
          caption: text.trim(),
          alt: alt.trim() || "User-selected photograph",
          ...(image ? { image } : {}),
        };
      }
      const posts = await feedRequest(pending.current);
      if (!alive.current || scope !== captureAchievementScope()) return;
      feedPublished(posts[0]);
      P(posts[0].id);
      TEXT("");
      PHOTO(null);
      ALT("");
      pending.current = null;
      refreshSocial();
    } catch {
      if (alive.current && scope === captureAchievementScope())
        E(
          "Posting was not confirmed. Retry safely with the same content, or discard the pending post.",
        );
    } finally {
      lock.current = false;
      if (alive.current) B(false);
    }
  };
  return (
    <Card>
      <T bold>Share with {community.name}</T>
      <T small muted>
        Only community members can view this post. Posting identifies you as a
        participant, even if your membership is private. Nothing is published
        until you tap Post to community.
      </T>
      {Platform.OS === "web" ? (
        <>
          <Input
            label="Community post"
            value={text}
            onChange={(v) => {
              if (!pending.current && !busy) TEXT(v.slice(0, 1000));
            }}
            multiline
          />
          <PhotoBackground
            photoUri={photo}
            onChange={(v) => {
              if (!pending.current && !busy) PHOTO(v);
            }}
          />
          {photo ? (
            <Image
              source={{ uri: photo }}
              accessibilityLabel={alt || "Community photograph preview"}
              resizeMode="cover"
              style={{ width: "100%", aspectRatio: 1080 / 1350 }}
            />
          ) : null}
          {photo ? (
            <Input
              label="Photo description (optional)"
              value={alt}
              onChange={(v) => {
                if (!pending.current && !busy) ALT(v.slice(0, 2000));
              }}
            />
          ) : null}
          <Button
            label={
              busy
                ? "Posting…"
                : pending.current
                  ? "Retry community post"
                  : "Post to community"
            }
            kind="primary"
            disabled={busy || (!text.trim() && !photo && !pending.current)}
            onPress={() => void send()}
          />
          {pending.current ? (
            <Button
              label="Discard pending post"
              disabled={busy}
              onPress={() => {
                pending.current = null;
                E("");
              }}
            />
          ) : null}
          <Button
            label="Create a glucose story for this community"
            onPress={() =>
              router.push({
                pathname: "/create",
                params: { communityId: community.id },
              })
            }
          />
        </>
      ) : (
        <T>Account publishing is currently available on the web app.</T>
      )}
      {error ? <Notice>{error}</Notice> : null}
      {posted ? (
        <>
          <Notice>Posted to community.</Notice>
          <Button
            label="Open community post"
            onPress={() => router.push(`/post/${posted}`)}
          />
        </>
      ) : null}
    </Card>
  );
}
