import React, { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button, Card, Input, T } from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PostCard } from "../components/post-card";
import { Guard } from "../components/guard";
export function PostDetail() {
  return (
    <Guard route="/post">
      <PostConversation />
    </Guard>
  );
}
function PostConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, set } = useDemo();
  const [comment, change] = useState("");
  const p = state.posts.find((p) => p.id === id);
  if (!p || state.blocked.includes(p.author))
    return (
      <Page title="Post unavailable">
        <T>This post was removed or its author is blocked.</T>
      </Page>
    );
  return (
    <Page title="Conversation">
      <PostCard post={p} />
      {p.comments.map((c, i) => (
        <Card key={i}>
          <T>{c}</T>
          <Button
            label={`Reply to comment ${i + 1}`}
            onPress={() => change(`Reply to comment ${i + 1}: `)}
          />
        </Card>
      ))}
      <Input label="Your comment" value={comment} onChange={change} multiline />
      <Button
        label="Add comment"
        disabled={!comment.trim()}
        onPress={() => {
          set((s) => ({
            ...s,
            posts: s.posts.map((x) =>
              x.id === id
                ? {
                    ...x,
                    comments: [...x.comments, comment.trim().slice(0, 1000)],
                  }
                : x,
            ),
          }));
          change("");
        }}
      />
    </Page>
  );
}
