import { recordAchievementEvent } from "../achievements/events";
import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Input,
  Pill,
  T,
  space,
  useColors,
} from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PostCard } from "../components/post-card";
import { Guard } from "../components/guard";
import { AuthorIdentity } from "../components/identity/user-identity";
import { isEnabled } from "../flags";

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
  const c = useColors();
  const [comment, change] = useState("");
  const p = state.posts.find((p) => p.id === id);
  if (!p || state.blocked.includes(p.author))
    return (
      <Page title="Post not found">
        <EmptyState
          icon="alert"
          title="This post isn't here"
          body="It may have been deleted, or its author is blocked on this device."
          action={
            <Button
              kind="primary"
              label="Back to Home"
              onPress={() => router.replace("/")}
            />
          }
        />
      </Page>
    );
  if (p.remote)
    return (
      <Page title="Post" glucoseLabel="Source labelled on graphic">
        <PostCard post={p} inDetail />
        <T small muted>
          Comments and reactions for account posts are not available yet.
        </T>
        <Button label="Back to feed" onPress={() => router.replace("/")} />
      </Page>
    );
  const send = () => {
    const text = comment.trim().slice(0, 1000);
    if (!text) return;
    set((s) => ({
      ...s,
      posts: s.posts.map((x) =>
        x.id === id
          ? {
              ...x,
              comments: [...x.comments, text],
              commentAuthors: [
                ...x.comments.map(
                  (_, i) => x.commentAuthors?.[i] ?? "Community member",
                ),
                "You",
              ],
            }
          : x,
      ),
      counters: { ...s.counters, commentsMade: s.counters.commentsMade + 1 },
    }));
    recordAchievementEvent("comment_added");
    change("");
  };
  return (
    <Page title="Conversation">
      <PostCard post={p} inDetail />
      <View style={{ gap: space.md }}>
        <Eyebrow>{`Comments · ${p.comments.length}`}</Eyebrow>
        {p.comments.length ? (
          <View style={{ gap: space.lg }}>
            {p.comments.map((text, i) => {
              const who = p.commentAuthors?.[i] ?? "Community member";
              return (
                <View key={i} style={{ flexDirection: "row", gap: space.md }}>
                  {!isEnabled("identity") ? (
                    <Avatar name={who} size={36} />
                  ) : null}
                  <View
                    style={{
                      flex: 1,
                      gap: 2,
                      padding: space.md,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor: c.surface,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: space.sm,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {isEnabled("identity") ? (
                        <AuthorIdentity
                          name={who}
                          metadata={
                            who === "You" ? (
                              <Pill tone="accent">You</Pill>
                            ) : (
                              <Pill>Fictional</Pill>
                            )
                          }
                        />
                      ) : (
                        <T small bold>
                          {who}
                        </T>
                      )}
                      {!isEnabled("identity") ? (
                        who === "You" ? (
                          <Pill tone="accent">You</Pill>
                        ) : (
                          <Pill>Fictional</Pill>
                        )
                      ) : null}
                    </View>
                    <T>{text}</T>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="comment"
            title="No comments yet"
            body="Add a comment to this conversation."
          />
        )}
      </View>
      <Card>
        <Input
          label="Your comment"
          value={comment}
          onChange={change}
          multiline
        />
        <T small muted>
          Comments stay on this device. Nothing is posted to any other app.
        </T>
        <Button
          kind="primary"
          label="Add comment"
          disabled={!comment.trim()}
          onPress={send}
        />
      </Card>
    </Page>
  );
}
