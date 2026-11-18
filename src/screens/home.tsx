import { SocialInbox } from "../components/social-interactions";
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Chip, EmptyState, T, space } from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PostCard } from "../components/post-card";
import { Guard } from "../components/guard";
import { getFlags } from "../flags";

const FILTERS = ["All", "Following", "Bookmarks"] as const;
const EMPTY: Record<(typeof FILTERS)[number], { title: string; body: string }> =
  {
    All: {
      title: "No posts yet",
      body: "Create a graphic and choose whether to post it to Gluca.",
    },
    Following: {
      title: "Nobody followed yet",
      body: "Open a member profile to follow their posts.",
    },
    Bookmarks: {
      title: "Nothing saved",
      body: "Use the bookmark on a post to keep it here.",
    },
  };

export function Home() {
  return (
    <Guard route="/">
      <HomeFeed />
    </Guard>
  );
}
function HomeFeed() {
  const { state, ready } = useDemo();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [limit, setLimit] = useState(8);
  const posts = state.posts.filter(
    (p) =>
      (p.remote || !state.blocked.includes(p.author)) &&
      (filter === "All" ||
        (filter === "Following" &&
          (p.remote ? p.isFollowing : state.following.includes(p.author))) ||
        (filter === "Bookmarks" && p.saved)),
  );
  const shown = posts.slice(0, limit);
  return (
    <Page
      title="Home"
      glucoseLabel={
        state.posts.some((p) => p.remote)
          ? "Sources labelled on each graphic"
          : undefined
      }
    >
      {getFlags().accounts ? (
        <SocialInbox
          extra={
            getFlags().communityChallenges ? (
              <Button
                kind="ghost"
                label="Challenges"
                accessibilityLabel="Discover Challenges"
                onPress={() => router.push("/challenges")}
              />
            ) : null
          }
        />
      ) : null}
      {getFlags().communityChallenges && !getFlags().accounts ? (
        <Button
          label="Discover Challenges"
          onPress={() => router.push("/challenges")}
        />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f}
            selected={f === filter}
            onPress={() => {
              setFilter(f);
              setLimit(8);
            }}
          />
        ))}
      </View>
      {!ready ? (
        <T muted>Loading your feed…</T>
      ) : !posts.length ? (
        <EmptyState
          icon="image"
          title={EMPTY[filter].title}
          body={EMPTY[filter].body}
          action={
            <Button
              kind="primary"
              label="Go to Create"
              onPress={() => router.push("/create")}
            />
          }
        />
      ) : (
        <View style={{ gap: space.xl - 4 }}>
          {shown.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {limit < posts.length ? (
            <Button
              label="Load more posts"
              onPress={() => setLimit(limit + 8)}
            />
          ) : (
            <T small muted align="center">
              You're all caught up.
            </T>
          )}
        </View>
      )}
    </Page>
  );
}
