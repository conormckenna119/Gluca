import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { NameLine } from "../components/identity/name-line";
import { Shield } from "../components/identity/shield";
import { publicView } from "../domain/public-view";
import {
  formatLocalDate,
  localToday,
  nextAnniversary,
  shieldFor,
  shieldLabel,
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
  const { state } = useDemo();
  const { view } = useOwnPublicView();
  const name = state.profile.displayName;
  return (
    <View style={{ alignItems: "center", gap: space.md }}>
      <Avatar name={name} size={88} />
      <NameLine
        name={name}
        publicProfile={view}
        diagnosis={state.profile.diagnosis}
      />
      <T muted align="center">
        This is how others see you. This profile exists only on this device.
      </T>
    </View>
  );
}

function IdentityCards() {
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
            <Shield
              tier={info.tier.id}
              years={info.years}
              certain={info.certain}
              size={56}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <T heading>Your shield</T>
              <T muted>{shieldLabel(info.tier, info.years, info.certain)}</T>
            </View>
          </View>
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

export function Profile() {
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
      {flags.achievements ? (
        <View style={{ gap: space.md }}>
          <PinnedMedals awards={state.awards} />
          <ProfileMedalsLink />
        </View>
      ) : null}
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
