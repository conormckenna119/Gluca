import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Input, T, row, useColors } from "../../ui";
import {
  SWATCHES,
  TONES,
  TONE_LABEL,
  pickTone,
  templateInfo,
  type ShowOptions,
  type StoryOptions,
} from "../../story";
import { captionFor, headlineFor } from "../../art/copy";
import { track } from "../../telemetry";

const SHOW_LABELS: {
  key: keyof ShowOptions;
  label: string;
  group: "numbers" | "elements";
}[] = [
  { key: "tir", label: "Time in range", group: "numbers" },
  { key: "avg", label: "Average glucose", group: "numbers" },
  { key: "readings", label: "Number of readings", group: "numbers" },
  { key: "coverage", label: "Data coverage", group: "numbers" },
  { key: "date", label: "Date", group: "elements" },
  { key: "chart", label: "Glucose trace", group: "elements" },
  { key: "band", label: "Target range band", group: "elements" },
  { key: "axis", label: "Time labels", group: "elements" },
  { key: "partialNote", label: "“Based on X%” note", group: "elements" },
  { key: "brand", label: "Gluca mark", group: "elements" },
];

export function Customize({
  options: o,
  onChange,
  rangeText,
}: {
  options: StoryOptions;
  onChange: (next: StoryOptions) => void;
  rangeText: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [toneIndex, setToneIndex] = useState(0);
  React.useEffect(() => {
    setToneIndex(0);
  }, [o.template]);

  const patch = (p: Partial<StoryOptions>) => onChange({ ...o, ...p });
  const setShow = (k: keyof ShowOptions, v: boolean) =>
    patch({ show: { ...o.show, [k]: v } });
  const tint = (selected: boolean) => ({
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: selected ? 3 : 2,
    borderColor: selected ? c.text : c.border,
  });

  return (
    <>
      <Button
        label={open ? "Hide customization" : "Customize"}
        onPress={() => {
          if (!open) track("customization_opened", { template: o.template });
          setOpen(!open);
        }}
      />
      {open ? (
        <Card>
          <T bold>Tone</T>
          <View style={row}>
            {TONES.map((t) => (
              <Button
                key={t}
                label={TONE_LABEL[t]}
                selected={o.tone === t}
                onPress={() => {
                  setToneIndex(0);
                  onChange(pickTone(o, t));
                }}
              />
            ))}
          </View>
          <Input
            label="Headline"
            value={o.headline}
            onChange={(v) =>
              patch({ tone: "custom", headline: v.slice(0, 90) })
            }
          />
          <Input
            label="Graphic caption"
            value={o.caption}
            onChange={(v) =>
              patch({ tone: "custom", caption: v.slice(0, 140) })
            }
          />
          <Button
            label="Another line"
            onPress={() => {
              const tone = o.tone === "custom" ? "minimal" : o.tone;
              const next = toneIndex + 1;
              setToneIndex(next);
              patch({
                tone,
                headline: headlineFor(tone, next),
                caption: captionFor(tone, next),
              });
            }}
          />
          {o.template === "milestone" ? (
            <Input
              label="Milestone"
              value={o.milestoneBig}
              onChange={(v) => patch({ milestoneBig: v.slice(0, 24) })}
            />
          ) : null}
          {templateInfo[o.template].needsData ? (
            <>
              <T bold>Numbers to show (all optional)</T>
              <View style={row}>
                {SHOW_LABELS.filter((x) => x.group === "numbers").map((x) => (
                  <Button
                    key={x.key}
                    label={`${o.show[x.key] ? "Hide" : "Show"} ${x.label.toLowerCase()}`}
                    selected={o.show[x.key]}
                    onPress={() => setShow(x.key, !o.show[x.key])}
                  />
                ))}
              </View>
            </>
          ) : null}
          <T bold>Elements</T>
          <View style={row}>
            {SHOW_LABELS.filter((x) => x.group === "elements").map((x) => (
              <Button
                key={x.key}
                label={`${o.show[x.key] ? "Hide" : "Show"} ${x.label.toLowerCase()}`}
                selected={o.show[x.key]}
                onPress={() => setShow(x.key, !o.show[x.key])}
              />
            ))}
          </View>
          <T bold>Theme and colour</T>
          <View style={row}>
            <Button
              label="Dark"
              selected={o.theme === "dark"}
              onPress={() => patch({ theme: "dark" })}
            />
            <Button
              label="Light"
              selected={o.theme === "light"}
              onPress={() => patch({ theme: "light" })}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            {(["mint", "blue", "lavender", "amber", "white"] as const).map(
              (name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={`Accent ${name}`}
                  accessibilityState={{ selected: o.accent === SWATCHES[name] }}
                  onPress={() => patch({ accent: SWATCHES[name] })}
                  style={[
                    tint(o.accent === SWATCHES[name]),
                    { backgroundColor: SWATCHES[name] },
                  ]}
                />
              ),
            )}
          </View>
          <T small muted>
            Units and target range follow Settings & privacy ({rangeText}).
          </T>
        </Card>
      ) : null}
    </>
  );
}
