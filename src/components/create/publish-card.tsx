import { recordAchievementEvent } from "../../achievements/events";
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Eyebrow, Input, T, row } from "../../ui";
import { useDemo } from "../../store";
import { summarize } from "../../analytics";
import { templateInfo, type StoryOptions } from "../../story";
import type { Post, Reading, Visibility } from "../../types";

export function PublishCard({
  options: o,
  rows,
  start,
  end,
}: {
  options: StoryOptions;
  rows: Reading[];
  start: number;
  end: number;
}) {
  const { set } = useDemo();
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [preview, setPreview] = useState(false);
  React.useEffect(() => {
    setPreview(false);
  }, [o]);

  return (
    <Card>
      <Eyebrow>Share to the local demo feed</Eyebrow>
      <T small muted>
        Publishing creates a local demo post containing only your selected
        numerical snapshot and caption. The exported artwork is saved
        separately. Shared images may be copied and cannot always be withdrawn.
      </T>
      <Input
        label="Post caption"
        value={caption}
        onChange={(v) => {
          setCaption(v);
          setPreview(false);
        }}
      />
      <View style={row}>
        {(["private", "followers", "public"] as const).map((v) => (
          <Button
            key={v}
            label={v}
            selected={v === visibility}
            onPress={() => {
              setVisibility(v);
              setPreview(false);
            }}
          />
        ))}
      </View>
      <Button label="Preview post" onPress={() => setPreview(true)} />
      {preview ? (
        <>
          <T>
            Preview: {templateInfo[o.template].label} · {visibility} ·{" "}
            {caption || o.caption || o.headline}
          </T>
          <T small muted>
            {o.show.tir || o.show.avg
              ? "Includes average, estimated time in range, and coverage."
              : "No glucose statistics in the post."}{" "}
            {o.show.date ? "Selected date range included." : "Dates hidden."}
          </T>
          <Button
            kind="primary"
            label="Publish to local feed"
            onPress={() => {
              const s = summarize(rows, start, end);
              const p: Post = {
                id: `local-${Date.now()}`,
                createdAt: Date.now(),
                author: "You",
                title: templateInfo[o.template].label,
                caption: (caption || o.caption || o.headline).slice(0, 1000),
                visibility,
                reactions: { counts: {}, mine: null },
                saved: false,
                comments: [],
                ...(o.show.tir || o.show.avg
                  ? {
                      snapshot: {
                        average: s.average,
                        tir: s.tir,
                        coverage: s.coverage,
                        label: o.show.date
                          ? new Date(start).toLocaleDateString()
                          : "Date hidden",
                      },
                    }
                  : {}),
              };
              set((st) => ({ ...st, posts: [p, ...st.posts] }));
              if (visibility !== "private")
                recordAchievementEvent("post_published", p.id);
              setPreview(false);
              router.push("/");
            }}
          />
        </>
      ) : null}
    </Card>
  );
}
