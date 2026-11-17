import React from "react";
import { Pressable, View } from "react-native";
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
  EmptyState,
  Group,
  ListRow,
  Pill,
  Section,
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
  const today = localToday();
  return {
    today,
    view: publicView(state.profile, state.privacy, {
      clubs: state.clubs,
      clubVisibility: state.clubVisibility,
      awards: state.awards,
      today,
    }),
  };
}

function IdentityHeader() {
  const { view } = useOwnPublicView();
  return (
    <View style={{ alignItems: "center", gap: space.md }}>
      <UserIdentity expanded profile={view} />
      {view.username ? (
        <Button
          label="View saved public profile"
          onPress={() =>
            router.push({
              pathname: "/profile",
              params: { username: view.username },
            })
          }
        />
      ) : null}
      <T muted align="center">
        Public preview. Your diagnosis date and birthday date are never part of
        it.
      </T>
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
              <T muted>{shieldLabel(info.tier, info.years, info.certain)}</T>
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
      <Group>
        <ListRow
          title="Edit profile"
          icon="user"
          onPress={() => router.push("/profile-edit")}
        />
      </Group>
    </View>
  );
}

function OwnProfile() {
  const { state } = useDemo();
  const flags = getFlags();
  const mine = state.posts.filter((p) => p.author === "You");
  return (
    <Page title="Profile">
      {flags.identity ? (
        <IdentityHeader />
      ) : (
        <View style={{ alignItems: "center", gap: space.md }}>
          <Avatar name="You" size={88} />
          <T heading>You</T>
          <T muted align="center">
            This profile exists only on this device.
          </T>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <Stat value={String(mine.length)} label="Posts" />
        <Stat value={String(state.following.length)} label="Following" />
        <Stat value={String(state.clubs.length)} label="Clubs" />
      </View>
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
      {flags.identity ? <IdentityCards /> : null}
      {flags.identity && state.following.length ? (
        <Section title="Following" note="Your existing local demo connections.">
          {state.following.map((name) => (
            <Card key={name}>
              <AuthorIdentity name={name} />
            </Card>
          ))}
        </Section>
      ) : null}
      {flags.achievements ? (
        <View style={{ gap: space.md }}>
          <PinnedMedals awards={state.awards} />
          <ProfileMedalsLink />
        </View>
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
    </Page>
  );
}

function MemberProfile({ username }: { username: string }) {
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
          <T small muted>
            Self-reported identity. Shields and emblems do not grant access to
            private glucose data.
          </T>
        </Card>
      ) : (
        <T>{error || "Loading public profile…"}</T>
      )}
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
