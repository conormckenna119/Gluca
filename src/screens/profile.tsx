import { useAccount } from "../hooks/use-account";
import { BRAND } from "../art/brand";
import { OwnCommunities } from "../components/community-discovery";
import { COMMUNITY_CATALOGUE } from "../domain/community-discovery";
import { MemberActions } from "../components/social-interactions";
import React from "react";
import { Pressable, View, ScrollView, Share, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { PublicProfile } from "../domain/profile";
import {
  IdentitySheet,
  type IdentityTarget,
} from "../components/identity/identity-sheet";
import { Shield } from "../components/identity/shield";
import { publicView } from "../domain/public-view";
import {
  formatLocalDate,
  localToday,
  nextAnniversary,
  shieldFor,
  shieldLabel,
  shieldPrecisionNote,
} from "../domain/shield";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Notice,
  EmptyState,
  Group,
  ListRow,
  Pill,
  Section,
  Sheet,
  Stat,
  T,
  space,
} from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import {
  PinnedMedals,
  ProfileMedalsLink,
} from "../components/achievements/pinned-medals";
import { PostCard } from "../components/post-card";
import { Medal } from "../components/achievements/medal";
import { useAchievements } from "../hooks/use-achievements";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";
import { AccountEntry } from "../components/account-entry";
import {
  UserIdentity,
  AuthorIdentity,
} from "../components/identity/user-identity";

/** What others see, built from the same function everything else uses, so the person sees exactly that. */
function useOwnPublicView() {
  const { state } = useDemo();
  const cabinet = useAchievements();
  const today = localToday();
  return {
    today,
    view: publicView(state.profile, state.privacy, {
      clubs: state.clubs,
      clubVisibility: state.clubVisibility,
      awards: cabinet.collectionPublic ? state.awards : [],
      today,
    }),
  };
}

function IdentityHeader() {
  const { view } = useOwnPublicView();
  const account = useAccount();
  const [message, M] = React.useState("");
  const canShare = account.status === "signedIn" && !!view.username;
  const share = async () => {
    if (!canShare) return;
    try {
      const link =
        Platform.OS === "web"
          ? `${window.location.origin}/profile?username=${encodeURIComponent(view.username!)}`
          : undefined;
      if (link && typeof navigator.share !== "function") {
        await navigator.clipboard.writeText(link);
        M("Profile link copied. Viewing requires a Gluca account.");
      } else {
        await Share.share({
          message: link ?? `${BRAND.name} profile · @${view.username}`,
        });
      }
    } catch {
      M(
        "Sharing is unavailable. Open your saved public profile to copy its link.",
      );
    }
  };
  return (
    <View style={{ gap: space.lg }}>
      <UserIdentity expanded profile={view} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Button
            label="Edit profile"
            onPress={() => router.push("/profile-edit")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Button
            label="Share profile"
            disabled={!canShare}
            onPress={() => void share()}
          />
        </View>
      </View>
      {message ? <Notice>{message}</Notice> : null}
    </View>
  );
}

function IdentityCards() {
  const [target, setTarget] = React.useState<IdentityTarget | null>(null);
  const { state } = useDemo();
  const { today } = useOwnPublicView();
  const info = shieldFor(state.profile.diagnosis, today);
  const next = nextAnniversary(state.profile.diagnosis, today);
  return (
    <View style={{ gap: space.lg }}>
      {!state.profile.onboarded ? (
        <Card tone="raised">
          <T heading>Set up your profile</T>
          <T muted>
            Only a display name is needed. Every other question is optional,
            skippable and private until you switch it on.
          </T>
          <Button
            kind="primary"
            label="Set up your profile"
            onPress={() => router.push("/onboarding")}
          />
        </Card>
      ) : null}
      {info ? (
        <Card>
          <Pill>Only you can see this</Pill>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View your shield details"
              onPress={() =>
                setTarget({
                  kind: "shield",
                  tier: info.tier.id,
                  years: info.years,
                  certain: info.certain,
                  diagnosis: state.profile.diagnosis,
                })
              }
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield
                tier={info.tier.id}
                years={info.years}
                certain={info.certain}
                size={56}
              />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <T heading>Your shield</T>
              <T
                muted
              >{`${info.certain ? "" : "At least "}${info.years} completed ${info.years === 1 ? "year" : "years"} with diabetes`}</T>
            </View>
          </View>
          <T small muted>
            {shieldPrecisionNote(state.profile.diagnosis, info.certain)}
          </T>
          {next ? (
            <T small muted>{`Next anniversary: ${formatLocalDate(next)}`}</T>
          ) : null}
          <T small muted>
            {state.privacy.showShield
              ? "You have chosen to show your shield to others. Change this in Settings."
              : "Others cannot see it unless you switch it on in Settings."}
          </T>
        </Card>
      ) : null}
      <IdentitySheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}

function OwnProfile() {
  const { state } = useDemo(),
    flags = getFlags();
  const scroller = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const anchors = React.useRef({ Overview: 0, Posts: 0, More: 0 });
  const [section, SECTION] = React.useState<"Overview" | "Posts" | "More">(
    "Overview",
  );
  const mine = state.posts.filter((p) =>
    p.remote ? p.owned === true : p.author === "You",
  );
  return (
    <Page title="Profile" scrollRef={scroller}>
      {flags.identity ? (
        <IdentityHeader />
      ) : (
        <View style={{ gap: space.md }}>
          <Avatar name="You" size={80} />
          <T heading>You</T>
          <T muted>This profile exists only on this device.</T>
        </View>
      )}
      {flags.accounts ? <MemberActions profileHeader /> : null}
      <View
        style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}
        accessibilityLabel="Profile sections"
      >
        {(["Overview", "Posts", "More"] as const).map((name) => (
          <Chip
            key={name}
            label={name}
            selected={section === name}
            onPress={() => {
              SECTION(name);
              scroller.current?.scrollTo({
                y: Math.max(0, anchors.current[name] - 16),
                animated: false,
              });
            }}
          />
        ))}
      </View>
      <View style={{ gap: space.lg }}>
        {flags.achievements ? (
          <>
            <PinnedMedals awards={state.awards} />
            <ProfileMedalsLink />
          </>
        ) : null}
        {flags.accounts ? <OwnCommunities /> : null}
      </View>
      <View
        onLayout={(e) => {
          anchors.current.Posts = e.nativeEvent.layout.y;
        }}
      >
        {flags.communityFeed ? (
          <Section title="Your posts">
            {mine.length ? (
              mine.map((p) => <PostCard key={p.id} post={p} />)
            ) : (
              <EmptyState
                icon="image"
                title="No posts yet"
                body="Make a graphic and share it when you choose. Nothing is posted automatically."
                action={
                  <Button
                    kind="primary"
                    label="Create a graphic"
                    onPress={() => router.push("/create")}
                  />
                }
              />
            )}
          </Section>
        ) : null}
      </View>
      <View
        style={{ gap: space.lg }}
        onLayout={(e) => {
          anchors.current.More = e.nativeEvent.layout.y;
        }}
      >
        {state.profile.username ? (
          <Button
            kind="ghost"
            label="View saved public profile"
            onPress={() =>
              router.push({
                pathname: "/profile",
                params: { username: state.profile.username },
              })
            }
          />
        ) : null}
        {flags.accounts ? <MemberActions managementOnly /> : null}
        {flags.identity ? <IdentityCards /> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg }}>
          <Stat value={String(mine.length)} label="Posts" />
          <Stat value={String(state.following.length)} label="Demo following" />
          <Stat value={String(state.clubs.length)} label="Demo clubs" />
        </View>
        {flags.identity && state.following.length ? (
          <Section
            title="Following"
            note="Your existing local demo connections."
          >
            {state.following.map((name) => (
              <Card key={name}>
                <AuthorIdentity name={name} />
              </Card>
            ))}
          </Section>
        ) : null}
        <AccountEntry />
        <Section title="More">
          <Group>
            <ListRow
              title="Settings & privacy"
              icon="settings"
              onPress={() => router.push("/settings")}
            />
            {linkVisible("import", flags) ? (
              <ListRow
                title="Import & export"
                icon="upload"
                onPress={() => router.push("/import")}
              />
            ) : null}
          </Group>
        </Section>
      </View>
    </Page>
  );
}

function MemberProfile({ username }: { username: string }) {
  const [medal, setMedal] = React.useState<
    NonNullable<PublicProfile["medals"]>[number] | null
  >(null);
  const [data, D] = React.useState<PublicProfile | null>(null),
    [error, E] = React.useState("");
  React.useEffect(() => {
    const abort = new AbortController();
    let alive = true;
    void fetch(
      `/api/profiles/public?username=${encodeURIComponent(username)}`,
      {
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: abort.signal,
        headers: { "X-Gluca-Request": "1" },
      },
    )
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 401
              ? "Sign in to Gluca to view this profile."
              : r.status === 404
                ? "This public profile was not found."
                : "This profile is unavailable.",
          );
        const value = (await r.json()) as PublicProfile;
        if (alive) D(value);
      })
      .catch((e) => {
        if (alive)
          E(e instanceof Error ? e.message : "This profile is unavailable.");
      });
    return () => {
      alive = false;
      abort.abort();
    };
  }, [username]);
  return (
    <Page
      title="Community profile"
      subtitle="Only the details this person chose to share."
    >
      {data ? (
        <Card>
          <UserIdentity expanded profile={data} />
          {data.accountId ? (
            <MemberActions id={data.accountId} profile={data} />
          ) : null}
          {data.communities?.length ? (
            <Section title="Public communities">
              {data.communities.map((name) => {
                const c = COMMUNITY_CATALOGUE.find((c) => c.name === name);
                return c ? (
                  <Button
                    key={c.id}
                    label={`Open ${c.name}`}
                    onPress={() => router.push(`/community/${c.id}` as never)}
                  />
                ) : null;
              })}
            </Section>
          ) : null}
          {getFlags().achievements && data.medals?.length ? (
            <Section title="Trophy Cabinet">
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.md,
                }}
              >
                {data.medals.map((m, i) => (
                  <Pressable
                    key={`${m.name}-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.name} medal, ${m.year}${m.pinned ? ", pinned" : ""}`}
                    onPress={() => setMedal(m)}
                    style={{
                      minWidth: 88,
                      minHeight: 44,
                      alignItems: "center",
                      maxWidth: 104,
                      gap: space.xs,
                    }}
                  >
                    <Medal
                      name={m.name}
                      icon={m.icon}
                      category={m.category}
                      earnedAt={new Date(m.year, 0, 1).getTime()}
                      size={56}
                      decorative
                    />
                    <T small align="center">
                      {m.name}
                    </T>
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}
          <T small muted>
            Self-reported identity. Shields and emblems do not grant access to
            private glucose data.
          </T>
        </Card>
      ) : (
        <T>{error || "Loading public profile…"}</T>
      )}
      <Sheet
        visible={!!medal}
        onClose={() => setMedal(null)}
        title={medal?.name ?? "Medal"}
      >
        {medal ? (
          <>
            <T>{`Earned in ${medal.year}`}</T>
            <T muted>
              This person chose to share this medal. It represents
              participation, not medical expertise or a health outcome.
            </T>
          </>
        ) : null}
      </Sheet>
      <Button label="Your profile" onPress={() => router.replace("/profile")} />
    </Page>
  );
}
export function Profile() {
  const { username } = useLocalSearchParams<{ username?: string }>();
  const { profileVersion } = useDemo();
  return getFlags().identity && typeof username === "string" && username ? (
    <MemberProfile key={`${profileVersion}:${username}`} username={username} />
  ) : (
    <OwnProfile />
  );
}
