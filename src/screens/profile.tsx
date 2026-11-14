import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  EmptyState,
  Group,
  ListRow,
  Section,
  Stat,
  T,
  space,
} from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PostCard } from "../components/post-card";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";

export function Profile() {
  const { state } = useDemo();
  const flags = getFlags();
  const mine = state.posts.filter((p) => p.author === "You");
  return (
    <Page title="Profile">
      <View style={{ alignItems: "center", gap: space.md }}>
        <Avatar name="You" size={88} />
        <T heading>You</T>
        <T muted align="center">
          This profile exists only on this device.
        </T>
      </View>
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
