import React, { useRef, useState } from "react";
import { View, Platform, Pressable, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SvgXml } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { Button, Card, Eyebrow, Input, T, row, space, useColors } from "../ui";
import { useDemo } from "../store";
import { summarize } from "../analytics";
import {
  SWATCHES,
  TONES,
  TONE_LABEL,
  defaultOptions,
  formats,
  pickTone,
  storyArtwork,
  storySvg,
  switchTemplate,
  templateIds,
  templateInfo,
  type FormatName,
  type ShowOptions,
  type StoryOptions,
} from "../story";
import { captionFor, headlineFor } from "../art/copy";
import { exportImage } from "../export";
import { Post, Visibility } from "../types";
import { Page } from "../components/page";
import { rangeToText } from "../state";
import { useReadings } from "../hooks/use-readings";
import { getFlags } from "../flags";
import { track, exportFormatId, exportFailReason } from "../telemetry";
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
const slug = (s: string) => s.replace(/_/g, "-");

export function Create() {
  const { state, set } = useDemo();
  const c = useColors();
  const { width } = useWindowDimensions();
  const { data = [] } = useReadings();
  const [base, O] = useState<StoryOptions>(() =>
    defaultOptions("daily_recap", state.unit),
  );
  // Unit and range come from the store on every render, so Settings changes apply without a reload.
  const o = React.useMemo<StoryOptions>(
    () => ({ ...base, unit: state.unit, range: state.range }),
    [base, state.unit, state.range],
  );
  const [caption, C] = useState("");
  const [visibility, V] = useState<Visibility>("private");
  const [status, Status] = useState("");
  const [preview, P] = useState(false);
  const [day, Day] = useState("");
  const [busy, B] = useState(false);
  const [custom, Custom] = useState(false);
  const [toneIndex, setToneIndex] = useState(0);
  const art = useRef<React.ElementRef<typeof View>>(null);
  // Welcome opens Create with ?template=milestone; apply it when the param arrives.
  const { template: wanted } = useLocalSearchParams<{ template?: string }>();
  React.useEffect(() => {
    const id = templateIds.find((t) => t === wanted);
    if (id) {
      O((prev) => switchTemplate(prev, id));
      track("template_selected", {
        template: id,
        source: state.imported.length ? "csv" : "demo",
      });
    }
  }, [wanted]);

  // Default day: the latest day that is mostly covered, so the first graphic is a real day, not a sliver of today.
  const defaultAnchor = React.useMemo(() => {
    const last = data.at(-1);
    if (!last) return Date.now();
    const d = new Date(last.timestamp);
    d.setHours(0, 0, 0, 0);
    const count = data.filter((r) => r.timestamp >= d.getTime()).length;
    return d.getTime() + (count >= 200 ? 12 : -12) * 3600000;
  }, [data]);
  const typed =
    day && Number.isFinite(Date.parse(`${day}T12:00:00`))
      ? Date.parse(`${day}T12:00:00`)
      : null;
  const anchor = typed ?? defaultAnchor;
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const end = dayStart.getTime() + 86400000;
  const start = dayStart.getTime() - (o.period === "week" ? 6 : 0) * 86400000;
  const rows = data.filter((r) => r.timestamp >= start && r.timestamp < end);
  const [w, h] = formats[o.format];
  const noData = !data.length;

  const built = React.useMemo(
    () => storyArtwork(data, anchor, o, { native: true }),
    [data, anchor, o],
  );
  const pw = Math.min(width - 40, 360);
  const ph = (pw * h) / w;

  const patch = (p: Partial<StoryOptions>) => {
    O((prev) => ({ ...prev, ...p }));
    P(false);
  };
  const setShow = (k: keyof ShowOptions, v: boolean) =>
    patch({ show: { ...o.show, [k]: v } });

  const doExport = async (save = false) => {
    B(true);
    Status("");
    const evt = {
      template: o.template,
      format: exportFormatId(o.format, o.transparent),
    } as const;
    track("export_started", evt);
    try {
      // Web: embed the font so the PNG looks the same on every device. Native: capture exactly what the preview shows.
      const svg = storySvg(data, anchor, o, {
        embedFont: Platform.OS === "web",
      });
      await exportImage(
        svg,
        o.format,
        () =>
          captureRef(art, {
            format: "png",
            quality: 1,
            width: w,
            height: h,
            result: "tmpfile",
          }),
        save,
        `gluca-${slug(o.template)}-${o.transparent ? "transparent-" : ""}${o.format.toLowerCase()}.png`,
      );
      track("export_succeeded", evt);
      if (Platform.OS !== "web" && !save) track("share_sheet_opened", evt);
      Status(
        Platform.OS === "web"
          ? `Saved a ${w}×${h} PNG${o.transparent ? " with a transparent background" : ""}. Nothing was posted.`
          : save
            ? "Saved to your photo library. Nothing was posted."
            : "The share sheet was opened. Gluca can’t see what you choose, and never posts for you.",
      );
    } catch (e) {
      track("export_failed", { ...evt, reason: exportFailReason(e) });
      Status(e instanceof Error ? e.message : "Export failed.");
    } finally {
      B(false);
    }
  };

  const tint = (selected: boolean) => ({
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: selected ? 3 : 2,
    borderColor: selected ? c.text : c.border,
  });

  return (
    <Page title="Create">
      <T muted>
        Your day, your words. Pick a look, and everything on the image is listed
        below so you know exactly what you are sharing.
      </T>

      {noData ? (
        <T>
          No glucose data yet. Milestone graphics work without any; or import a
          CSV first.
        </T>
      ) : null}

      <View style={{ alignItems: "center", gap: space.md }}>
        <View
          style={{
            width: pw + 16,
            padding: 8,
            borderRadius: 22,
            backgroundColor: c.raised,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <View
            ref={art}
            collapsable={false}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Preview of your graphic. ${built.contents.join(". ")}`}
            style={{
              width: pw,
              height: ph,
              backgroundColor: "transparent",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <SvgXml xml={built.svg} width={pw} height={ph} />
          </View>
        </View>
        <T small muted align="center">
          {w} × {h} px · {o.transparent ? "transparent PNG" : "solid PNG"} ·
          preview omits the soft glow that appears in web exports
        </T>
      </View>

      <View style={row}>
        {(Object.keys(formats) as FormatName[]).map((f) => (
          <Button
            key={f}
            label={f}
            selected={o.format === f}
            onPress={() => patch({ format: f })}
          />
        ))}
        <Button
          label={o.transparent ? "Transparent: on" : "Transparent: off"}
          selected={o.transparent}
          onPress={() => patch({ transparent: !o.transparent })}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Template</Eyebrow>
        <View style={row}>
          {templateIds.map((t) => (
            <Button
              key={t}
              label={templateInfo[t].label}
              selected={t === o.template}
              disabled={templateInfo[t].needsData && noData}
              onPress={() => {
                track("template_selected", {
                  template: t,
                  source: state.imported.length ? "csv" : "demo",
                });
                O(switchTemplate(o, t));
                setToneIndex(0);
                P(false);
              }}
            />
          ))}
        </View>
        <T small muted>
          {templateInfo[o.template].blurb}
        </T>
      </View>

      {templateInfo[o.template].needsData ? (
        <View style={{ gap: space.sm }}>
          <View style={row}>
            <Button
              label="Day"
              selected={o.period === "day"}
              onPress={() => patch({ period: "day" })}
            />
            <Button
              label="7 days"
              selected={o.period === "week"}
              onPress={() => patch({ period: "week" })}
            />
          </View>
          <Input
            label="Day ending at midnight (YYYY-MM-DD, optional)"
            value={day}
            onChange={(v) => {
              Day(v);
              P(false);
            }}
          />
        </View>
      ) : null}

      <Button
        kind="primary"
        label={busy ? "Exporting…" : "Export PNG / Share"}
        disabled={busy}
        onPress={() => void doExport()}
      />
      {Platform.OS !== "web" ? (
        <Button
          label="Save to photo library"
          disabled={busy}
          onPress={() => void doExport(true)}
        />
      ) : null}
      {status ? <T small>{status}</T> : null}

      <Card tone="raised">
        <Eyebrow>What’s on this image</Eyebrow>
        {built.contents.map((line, i) => (
          <T key={i} small>
            • {line}
          </T>
        ))}
        <T small muted>
          Only what is listed here is in the export. Exporting never posts
          anything.
        </T>
      </Card>

      <Button
        label={custom ? "Hide customization" : "Customize"}
        onPress={() => {
          if (!custom) track("customization_opened", { template: o.template });
          Custom(!custom);
        }}
      />
      {custom ? (
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
                  O(pickTone(o, t));
                  P(false);
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
            Units and target range follow Settings & privacy (
            {rangeToText(state.range.low, state.unit)}–
            {rangeToText(state.range.high, state.unit)} {state.unit}).
          </T>
        </Card>
      ) : null}

      {getFlags().communityFeed ? (
        <Card>
          <Eyebrow>Share to the local demo feed</Eyebrow>
          <T small muted>
            Publishing creates a local demo post containing only your selected
            numerical snapshot and caption. The exported artwork is saved
            separately. Shared images may be copied and cannot always be
            withdrawn.
          </T>
          <Input
            label="Post caption"
            value={caption}
            onChange={(v) => {
              C(v);
              P(false);
            }}
          />
          <View style={row}>
            {(["private", "followers", "public"] as const).map((v) => (
              <Button
                key={v}
                label={v}
                selected={v === visibility}
                onPress={() => {
                  V(v);
                  P(false);
                }}
              />
            ))}
          </View>
          <Button label="Preview post" onPress={() => P(true)} />
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
                {o.show.date
                  ? "Selected date range included."
                  : "Dates hidden."}
              </T>
              <Button
                kind="primary"
                label="Publish to local feed"
                onPress={() => {
                  const s = summarize(rows, start, end);
                  const p: Post = {
                    id: `local-${Date.now()}`,
                    author: "You",
                    title: templateInfo[o.template].label,
                    caption: (caption || o.caption || o.headline).slice(
                      0,
                      1000,
                    ),
                    visibility,
                    kudos: 0,
                    liked: false,
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
                  Status("Published to your local demo feed.");
                  P(false);
                  router.push("/");
                }}
              />
            </>
          ) : null}
        </Card>
      ) : null}
    </Page>
  );
}
