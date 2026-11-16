import React, { useState } from "react";
import { reactionCount, toggleReaction } from "../domain/reactions";
import { BRAND } from "../art/brand";
import { View, Share } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  Card,
  ConfirmSheet,
  Group,
  IconButton,
  Input,
  ListRow,
  Notice,
  Pill,
  Sheet,
  Stat,
  T,
  space,
} from "../ui";
import { useDemo } from "../store";
import { Post } from "../types";
import { relativeTime } from "../time";

const MGDL_PER_MMOL = 18.0182;

export function PostCard({
  post,
  inDetail = false,
}: {
  post: Post;
  /** On the detail screen the comments button is hidden (the thread is right below). */
  inDetail?: boolean;
}) {
  const { state, set } = useDemo();
  const update = (fn: (p: Post) => Post) =>
    set((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id === post.id ? fn(p) : p)),
    }));
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, edit] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [message, msg] = useState("");
  const mine = post.author === "You";
  const following = state.following.includes(post.author);
  const snap = post.snapshot;
  const avg = snap
    ? state.unit === "mmol/L"
      ? (snap.average / MGDL_PER_MMOL).toFixed(1)
      : snap.average.toFixed(0)
    : "";

  const close = () => setMenu(false);
  return (
    <Card>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
      >
        <Avatar name={post.author} />
        <View style={{ flex: 1, gap: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              flexWrap: "wrap",
            }}
          >
            <T bold>{post.author}</T>
            {mine ? <Pill tone="accent">You</Pill> : <Pill>Fictional</Pill>}
          </View>
          <T small muted>
            {post.createdAt ? relativeTime(post.createdAt, Date.now()) : ""}
            {post.createdAt && mine ? " · " : ""}
            {mine ? `Visible to: ${post.visibility}` : ""}
          </T>
        </View>
        <IconButton
          icon="settings"
          label={`More options for post: ${post.title}`}
          onPress={() => setMenu(true)}
        />
      </View>
      <T heading>{post.title}</T>
      <T>{post.caption}</T>
      {snap ? (
        <View style={{ gap: space.sm }}>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg }}
          >
            <Stat value={avg} unit={state.unit} label="Average" />
            <Stat value={`${snap.tir.toFixed(0)}%`} label="Time in range" />
            <Stat value={`${snap.coverage.toFixed(0)}%`} label="Coverage" />
          </View>
          <T small muted>
            Snapshot you approved · {snap.label} · time in range is an estimate
          </T>
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.xs,
          marginLeft: -space.sm,
        }}
      >
        <IconButton
          icon="heart"
          selected={post.reactions.mine === "boost"}
          count={reactionCount(post.reactions)}
          label={
            post.reactions.mine === "boost"
              ? `Remove kudos, ${reactionCount(post.reactions)}`
              : `Give kudos, ${reactionCount(post.reactions)}`
          }
          onPress={() =>
            update((p) => ({ ...p, reactions: toggleReaction(p.reactions) }))
          }
        />
        {inDetail ? null : (
          <IconButton
            icon="comment"
            count={post.comments.length}
            label={`Comments, ${post.comments.length}`}
            onPress={() => router.push(`/post/${post.id}`)}
          />
        )}
        <IconButton
          icon="bookmark"
          selected={post.saved}
          label={post.saved ? "Remove from saved" : "Save post"}
          onPress={() => update((p) => ({ ...p, saved: !p.saved }))}
        />
      </View>
      {editing ? (
        <View style={{ gap: space.md }}>
          <Input label="Edit caption" value={caption} onChange={setCaption} />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button
              label="Save edit"
              onPress={() => {
                update((p) => ({ ...p, caption: caption.slice(0, 1000) }));
                edit(false);
              }}
            />
            <Button
              label="Cancel edit"
              kind="ghost"
              onPress={() => {
                setCaption(post.caption);
                edit(false);
              }}
            />
          </View>
        </View>
      ) : null}
      {message ? <Notice>{message}</Notice> : null}

      <Sheet visible={menu} onClose={close} title="Post options">
        <Group>
          <ListRow
            icon="share"
            title="Share text"
            detail="Opens your device share sheet. Nothing is posted anywhere."
            onPress={() => {
              close();
              if (post.visibility !== "public") {
                msg("Only public demo posts can be shared.");
                return;
              }
              Share.share({
                message: `${post.title}\n${post.caption}\n${BRAND.name} fictional demo post`,
              }).catch(() => msg("Sharing is unavailable."));
            }}
          />
          {mine ? (
            <ListRow
              icon="file"
              title="Edit caption"
              onPress={() => {
                close();
                setCaption(post.caption);
                edit(true);
              }}
            />
          ) : (
            <ListRow
              icon="user"
              title={following ? "Unfollow" : "Follow"}
              onPress={() => {
                close();
                set((s) => ({
                  ...s,
                  following: s.following.includes(post.author)
                    ? s.following.filter((n) => n !== post.author)
                    : [...s.following, post.author],
                }));
              }}
            />
          )}
          {mine ? (
            <ListRow
              destructive
              title="Delete post"
              onPress={() => {
                close();
                setConfirmDelete(true);
              }}
            />
          ) : (
            <ListRow
              icon="alert"
              title="Report locally"
              detail="Saved on this device only. No moderation service is connected."
              onPress={() => {
                close();
                set((s) => ({ ...s, reports: [...s.reports, post.id] }));
                msg(
                  "Recorded on this device. No moderation service is connected.",
                );
              }}
            />
          )}
          {mine ? null : (
            <ListRow
              icon="close"
              title={`Block ${post.author}`}
              detail="Hides their posts from this feed."
              onPress={() => {
                close();
                set((s) => ({ ...s, blocked: [...s.blocked, post.author] }));
              }}
            />
          )}
        </Group>
      </Sheet>
      <ConfirmSheet
        visible={confirmDelete}
        title="Delete this post?"
        body="It will be removed from the demo feed on this device. This cannot be undone."
        confirmLabel="Delete post"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          set((s) => ({
            ...s,
            posts: s.posts.filter((p) => p.id !== post.id),
          }));
        }}
      />
    </Card>
  );
}
