import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Chip, EmptyState, T, space } from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PostCard } from "../components/post-card";
import { Guard } from "../components/guard";

const FILTERS = ["All", "Following", "Bookmarks"] as const;
const EMPTY: Record<(typeof FILTERS)[number], { title: string; body: string }> =
  {
    All: {
      title: "No posts yet",
      body: "Create a graphic and choose whether to post it to Gluca.",
    },
    Following: {
      title: "Nobody followed yet",
      body: "Follow a fictional member from a post's options menu.",
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
      !state.blocked.includes(p.author) &&
      (filter === "All" ||
        (filter === "Following" && state.following.includes(p.author)) ||
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
      subtitle="Your Gluca posts and a labelled fictional community. Private posts are visible only to their owner."
    >
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
