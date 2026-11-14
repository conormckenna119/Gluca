import React, { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Button,
  Chip,
  Group,
  Icon,
  Input,
  Section,
  Sheet,
  SwitchRow,
  T,
  row,
  space,
  useColors,
} from "../../ui";
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
import { BRAND } from "../../art/brand";
import { track } from "../../telemetry";

const HEADLINE_MAX = 90;
const CAPTION_MAX = 140;
const MILESTONE_MAX = 24;

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
  { key: "brand", label: `${BRAND.name} mark`, group: "elements" },
];

/** Black or white, whichever contrasts more with a #rrggbb swatch. */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#000000";
  const n = parseInt(m[1], 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L =
    0.2126 * lin((n >> 16) & 255) +
    0.7152 * lin((n >> 8) & 255) +
    0.0722 * lin(n & 255);
  return L > 0.179 ? "#000000" : "#FFFFFF";
}

function Count({ value, max }: { value: string; max: number }) {
  return (
    <T small muted>
      {max - value.length} characters left
    </T>
  );
}

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
  const switches = (g: "numbers" | "elements") => (
    <Group>
      {SHOW_LABELS.filter((x) => x.group === g).map((x) => (
        <SwitchRow
          key={x.key}
          title={x.label}
          value={o.show[x.key]}
          onChange={(v) => setShow(x.key, v)}
        />
      ))}
    </Group>
  );

  return (
    <>
      <Button
        label="Customize"
        onPress={() => {
          track("customization_opened", { template: o.template });
          setOpen(true);
        }}
      />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Customize"
        footer={
          <Button kind="primary" label="Done" onPress={() => setOpen(false)} />
        }
      >
        <View style={{ gap: space.xl }}>
          <Section title="Words">
            <View style={row}>
              {TONES.map((t) => (
                <Chip
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
                patch({ tone: "custom", headline: v.slice(0, HEADLINE_MAX) })
              }
            />
            <Count value={o.headline} max={HEADLINE_MAX} />
            <Input
              label="Graphic caption"
              value={o.caption}
              onChange={(v) =>
                patch({ tone: "custom", caption: v.slice(0, CAPTION_MAX) })
              }
            />
            <Count value={o.caption} max={CAPTION_MAX} />
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
              <>
                <Input
                  label="Milestone"
                  value={o.milestoneBig}
                  onChange={(v) =>
                    patch({ milestoneBig: v.slice(0, MILESTONE_MAX) })
                  }
                />
                <Count value={o.milestoneBig} max={MILESTONE_MAX} />
              </>
            ) : null}
          </Section>

          {templateInfo[o.template].needsData ? (
            <Section
              title="Numbers"
              note="All optional. Only what is switched on appears on the image."
            >
              {switches("numbers")}
            </Section>
          ) : null}

          <Section title="Elements">{switches("elements")}</Section>

          <Section title="Look">
            <View style={row}>
              <Chip
                label="Dark"
                selected={o.theme === "dark"}
                onPress={() => patch({ theme: "dark" })}
              />
              <Chip
                label="Light"
                selected={o.theme === "light"}
                onPress={() => patch({ theme: "light" })}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              {(["mint", "blue", "lavender", "amber", "white"] as const).map(
                (name) => {
                  const selected = o.accent === SWATCHES[name];
                  return (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityLabel={`Accent ${name}`}
                      accessibilityState={{ selected }}
                      onPress={() => patch({ accent: SWATCHES[name] })}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: selected ? 3 : 1,
                        borderColor: selected ? c.text : c.border,
                        padding: selected ? 2 : 0,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 24,
                          backgroundColor: SWATCHES[name],
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {selected ? (
                          <Icon
                            name="check"
                            size={20}
                            color={inkOn(SWATCHES[name])}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                },
              )}
            </View>
            <T small muted>
              Units and target range follow Settings & privacy ({rangeText}).
            </T>
          </Section>
        </View>
      </Sheet>
    </>
  );
}
