import React, { useState } from "react";
import { View, Share } from "react-native";
import { router } from "expo-router";
import { Avatar, Button, Card, Input, Pill, T, row } from "../ui";
import { useDemo } from "../store";
import { Post } from "../types";
export function PostCard({ post }: { post: Post }) {
  const { state, set } = useDemo();
  const update = (fn: (p: Post) => Post) =>
    set((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id === post.id ? fn(p) : p)),
    }));
  const [editing, edit] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [message, msg] = useState("");
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={post.author} />
        <View style={{ flex: 1 }}>
          <T bold>{post.author}</T>
          <T small muted>
            @{post.author.toLowerCase().replace(/ /g, "")} · {post.visibility}
          </T>
        </View>
        {post.author === "You" ? <Pill tone="accent">You</Pill> : <Pill>Fictional</Pill>}
      </View>
      <T large>{post.title}</T>
      <T>{post.caption}</T>
      {post.snapshot ? (
        <T small muted>
          Approved snapshot · {post.snapshot.label} ·{" "}
          {post.snapshot.tir.toFixed(0)}% estimated in range ·{" "}
          {post.snapshot.average.toFixed(0)} mg/dL average ·{" "}
          {post.snapshot.coverage.toFixed(0)}% coverage
        </T>
      ) : null}
      <View style={row}>
        <Button
          label={`Kudos ${post.kudos}`}
          selected={post.liked}
          onPress={() =>
            update((p) => ({
              ...p,
              liked: !p.liked,
              kudos: p.kudos + (p.liked ? -1 : 1),
            }))
          }
        />
        <Button
          label={`Comments ${post.comments.length}`}
          onPress={() => router.push(`/post/${post.id}`)}
        />
        <Button
          label={post.saved ? "Bookmarked" : "Bookmark"}
          selected={post.saved}
          onPress={() => update((p) => ({ ...p, saved: !p.saved }))}
        />
        <Button
          label="Share text"
          onPress={() => {
            if (post.visibility !== "public") {
              msg("Only public demo posts can be shared.");
              return;
            }
            Share.share({
              message: `${post.title}\n${post.caption}\nGluca fictional demo post`,
            }).catch(() => msg("Sharing is unavailable."));
          }}
        />
      </View>
      {post.author === "You" ? (
        <View style={row}>
          <Button label="Edit" onPress={() => edit(!editing)} />
          <Button
            label="Delete post"
            onPress={() =>
              set((s) => ({
                ...s,
                posts: s.posts.filter((p) => p.id !== post.id),
              }))
            }
          />
        </View>
      ) : (
        <View style={row}>
          <Button
            label={
              state.following.includes(post.author) ? "Unfollow" : "Follow"
            }
            onPress={() =>
              set((s) => ({
                ...s,
                following: s.following.includes(post.author)
                  ? s.following.filter((n) => n !== post.author)
                  : [...s.following, post.author],
              }))
            }
          />
          <Button
            label="Report locally"
            onPress={() => {
              set((s) => ({ ...s, reports: [...s.reports, post.id] }));
              msg(
                "Recorded on this device. No moderation service is connected.",
              );
            }}
          />
          <Button
            label="Block"
            onPress={() =>
              set((s) => ({ ...s, blocked: [...s.blocked, post.author] }))
            }
          />
        </View>
      )}
      {editing ? (
        <>
          <Input label="Edit caption" value={caption} onChange={setCaption} />
          <Button
            label="Save edit"
            onPress={() => {
              update((p) => ({ ...p, caption: caption.slice(0, 1000) }));
              edit(false);
            }}
          />
        </>
      ) : null}
      {message ? <T>{message}</T> : null}
    </Card>
  );
}
