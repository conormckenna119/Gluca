import React, { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { Button, T, row } from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PostCard } from "../components/post-card";
import { Guard } from "../components/guard";
export function Home() {
  return (
    <Guard route="/">
      <HomeFeed />
    </Guard>
  );
}
function HomeFeed() {
  const { state } = useDemo();
  const [filter, setFilter] = useState("All");
  const [limit, setLimit] = useState(8);
  const [refreshing, refresh] = useState(false);
  const posts = state.posts.filter(
    (p) =>
      !state.blocked.includes(p.author) &&
      (filter === "All" ||
        (filter === "Following" && state.following.includes(p.author)) ||
        (filter === "Bookmarks" && p.saved)),
  );
  return (
    <Page title="Home">
      <T>Progress, not perfection. Share the moments behind the numbers.</T>
      <View style={row}>
        {["All", "Following", "Bookmarks"].map((f) => (
          <Button
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
      <ScrollView
        scrollEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh(true);
              setLimit(8);
              setTimeout(() => refresh(false), 300);
            }}
          />
        }
        contentContainerStyle={{ gap: 20 }}
      >
        {posts.slice(0, limit).map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </ScrollView>
      {!posts.length ? (
        <T>No posts here yet. Follow a demo member or create a post.</T>
      ) : null}
      {limit < posts.length ? (
        <Button label="Load more posts" onPress={() => setLimit(limit + 8)} />
      ) : null}
    </Page>
  );
}
