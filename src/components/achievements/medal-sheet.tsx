import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Group,
  Notice,
  Sheet,
  SwitchRow,
  T,
  space,
  useColors,
} from "../../ui";
import { Medal } from "./medal";
import { useAchievements } from "../../hooks/use-achievements";
import { getDef } from "../../achievements/registry";
import { shareRoute } from "../../achievement-share";
import type { Award } from "../../domain/achievements";

const CATEGORY_LABEL = {
  health: "Health",
  life: "Life",
  community: "Community",
} as const;
const when = (t: number) =>
  new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** One medal in detail. The only place private snapshot numbers can appear, under "Private details". */
export function MedalSheet({
  award,
  onClose,
}: {
  award: Award | null;
  onClose: () => void;
}) {
  const c = useColors();
  const a = useAchievements();
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(""), [award?.id]);
  // Read the live copy so switches reflect changes immediately.
  const live = award ? (a.awards.find((x) => x.id === award.id) ?? null) : null;
  const def = live ? getDef(live.achievementId) : undefined;
  if (!live || !def) return null;
  const shown = live.visibility === "public";
  const details = live.snapshot ? Object.entries(live.snapshot) : [];
  const togglePin = () => {
    if (live.pinned) {
      a.unpin(live.id);
      setMessage("");
      return;
    }
    const r = a.pin(live.id);
    setMessage(r.ok ? "" : (r.reason ?? ""));
  };
  return (
    <Sheet visible onClose={onClose} title={def.name}>
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Medal
          icon={def.icon}
          category={def.category}
          name={def.name}
          earnedAt={live.awardedAt}
          size={132}
        />
        <T
          small
          muted
        >{`${CATEGORY_LABEL[def.category]} medal · earned ${when(live.awardedAt)}`}</T>
      </View>
      <T>{def.description}</T>
      <T small muted>
        {live.relatedEvent === "awareness_event" ||
        live.relatedEvent === "personal_milestone"
          ? "Source: user-confirmed activity."
          : "Source: an action in Gluca. Community actions currently belong to the local demo feed."}
      </T>
      {!a.collectionPublic ? (
        <T small muted>
          Your collection is private. Turn on Public collection in the cabinet
          to show visible medals.
        </T>
      ) : null}
      {a.status === "account" ? (
        <Group>
          <SwitchRow
            title="Show on my profile"
            detail={
              shown
                ? "Eligible for your public collection"
                : "Only you can see this"
            }
            value={shown}
            onChange={(v) => a.setVisibility(live.id, v ? "public" : "private")}
          />
        </Group>
      ) : (
        <T small muted>
          Guest medals stay in this session. Sign in before earning medals to
          keep an account collection.
        </T>
      )}
      {a.error ? <Notice tone="info">{a.error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Button
        label={live.pinned ? "Unpin from profile" : "Pin to profile"}
        onPress={togglePin}
        selected={live.pinned}
      />
      {details.length ? (
        <View
          style={{
            gap: space.xs,
            padding: space.md,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <T small bold muted>
            Private details
          </T>
          {details.map(([k, v]) => (
            <T key={k} small>{`${k}: ${v}`}</T>
          ))}
        </View>
      ) : null}
      <Button
        kind="primary"
        label="Share"
        onPress={() => {
          onClose();
          router.push(shareRoute(def) as never);
        }}
      />
      <T small muted>
        Share opens Create with a medal image. You see what is on it before you
        save, and nothing is posted for you.
      </T>
    </Sheet>
  );
}
