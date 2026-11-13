import React from "react";
import { router } from "expo-router";
import { Button, Card, T } from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PostCard } from "../components/post-card";
export function Profile() {
  const { state } = useDemo();
  return (
    <Page title="Your demo profile">
      <Card>
        <T large>You · @demo</T>
        <T>A fictional journey. Making room for life and community.</T>
        <T>
          {state.posts.filter((p) => p.author === "You").length} posts ·
          Following {state.following.length} · {state.clubs.length} clubs
        </T>
        <T>
          Achievements: Community explorer
          {state.posts.some((p) => p.author === "You") ? " · First post" : ""}
        </T>
        <T>Health profile fields are private and unset.</T>
        <Button
          label="Settings & privacy"
          onPress={() => router.push("/settings")}
        />
      </Card>
      {state.posts
        .filter((p) => p.author === "You")
        .map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
    </Page>
  );
}
