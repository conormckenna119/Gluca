import React, { useRef, useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Platform,
  Share,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { SvgXml } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { captureRef } from "react-native-view-shot";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Avatar, Button, Card, Eyebrow, Input, Pill, Stat, T, row, space, useColors } from "./ui";
import { useDemo, people, clubNames, seed } from "./store";
import { MockGlucoseProvider, CsvGlucoseProvider } from "./providers";
import { convert, segments, summarize } from "./analytics";
import { parseCsv } from "./csv";
import {
  SWATCHES, TONES, TONE_LABEL, defaultOptions, formats, pickTone, storyArtwork, storySvg, switchTemplate,
  templateIds, templateInfo, type FormatName, type ShowOptions, type StoryOptions,
} from "./story";
import { captionFor, headlineFor } from "./art/copy";
import { BRAND } from "./art/brand";
import { exportImage } from "./export";
import { Post, Visibility } from "./types";
const mock = new MockGlucoseProvider();
/** Close a line path down to the baseline so it can take a soft gradient fill. Gaps stay gaps: each segment is closed separately. */
function areaPath(d: string) {
  const pts = d.trim().split(/[ML]/).map((x) => x.trim()).filter(Boolean);
  if (!pts.length) return "";
  const x0 = pts[0].split(",")[0];
  const x1 = pts[pts.length - 1].split(",")[0];
  return `M${pts.join(" L")} L${x1},300 L${x0},300 Z`;
}
export function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  const { ready, storageError, state } = useDemo();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 50,
        gap: 20,
        width: "100%",
        maxWidth: 900,
        alignSelf: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 8 }}>
        <Eyebrow>{BRAND.name}</Eyebrow>
        <T large>{title}</T>
        <View style={row}>
          <Pill>Local demo</Pill>
          <Pill>Fictional community</Pill>
          <Pill tone={state.imported.length ? "accent" : "neutral"}>
            {state.imported.length ? "Imported CSV glucose" : "Synthetic glucose"}
          </Pill>
        </View>
      </View>
      {storageError ? <T>{storageError}</T> : null}
      {ready ? children : <T>Loading your local demo…</T>}
    </ScrollView>
  );
}
function useReadings() {
  const { state } = useDemo();
  return useQuery({
    queryKey: ["readings", state.imported],
    queryFn: () => {
      const provider = state.imported.length
        ? new CsvGlucoseProvider(state.imported)
        : mock;
      return provider.getReadings(0, Date.now() + 86400000);
    },
  });
}
function PostCard({ post }: { post: Post }) {
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
export function Home() {
  const { state } = useDemo();
  const [filter, setFilter] = useState("All");
  const [limit, setLimit] = useState(8);
  const [refreshing, refresh] = useState(false);
  const posts = state.posts.filter(
    (p) =>
      !state.blocked.includes(p.author) &&
      (filter === "All" ||
        (filter === "Following" && state.following.includes(p.author)) ||
        (filter === "Bookmarks" && p.saved)),
  );
  return (
    <Page title="Home">
      <T>Progress, not perfection. Share the moments behind the numbers.</T>
      <View style={row}>
        {["All", "Following", "Bookmarks"].map((f) => (
          <Button
            key={f}
            label={f}
            selected={f === filter}
            onPress={() => {
              setFilter(f);
              setLimit(8);
            }}
          />
        ))}
      </View>
      <ScrollView
        scrollEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh(true);
              setLimit(8);
              setTimeout(() => refresh(false), 300);
            }}
          />
        }
        contentContainerStyle={{ gap: 20 }}
      >
        {posts.slice(0, limit).map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </ScrollView>
      {!posts.length ? (
        <T>No posts here yet. Follow a demo member or create a post.</T>
      ) : null}
      {limit < posts.length ? (
        <Button label="Load more posts" onPress={() => setLimit(limit + 8)} />
      ) : null}
    </Page>
  );
}
export function PostDetail() {
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
export function Glucose() {
  const { state } = useDemo();
  const c = useColors();
  const { data = [], isPending, error } = useReadings();
  const [hours, H] = useState(24);
  const [date, D] = useState(new Date().toLocaleDateString("en-CA"));
  const [selected, S] = useState("");
  const [chartWidth, setChartWidth] = useState(320);
  const [low, L] = useState("70");
  const [high, U] = useState("180");
  const parsed = Date.parse(`${date}T00:00:00`);
  const start =
    hours <= 24
      ? Number.isFinite(parsed)
        ? parsed
        : Date.now()
      : Date.now() - hours * 3600000;
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);
  const end =
    hours === 24
      ? nextDay.getTime()
      : hours < 24
        ? start + hours * 3600000
        : Date.now();
  const valid =
    Number(low) >= 20 && Number(high) <= 600 && Number(low) < Number(high);
  const s = summarize(
    data,
    start,
    end,
    valid ? Number(low) : 70,
    valid ? Number(high) : 180,
  );
  const rows = data.filter((r) => r.timestamp >= start && r.timestamp < end);
  const latest = data.at(-1);
  const paths = segments(data, start, end);
  return (
    <Page title="My Glucose">
      <T>
        Retrospective reflection. Not for treatment decisions or glucose alarms.
      </T>
      {isPending ? (
        <T>Loading readings…</T>
      ) : error ? (
        <T>Could not load readings.</T>
      ) : (
        <>
          <Card tone="raised">
            <Eyebrow>Latest reading</Eyebrow>
            <T large>
              {latest
                ? `${convert(latest.mgdl, state.unit).toFixed(state.unit === "mmol/L" ? 1 : 0)} ${state.unit}`
                : "No readings"}
            </T>
            <T small muted>
              {latest
                ? `${new Date(latest.timestamp).toLocaleString()} · ${latest.source === "mock" ? "Synthetic demo" : "Imported CSV"} · ${Math.max(0, Math.round((Date.now() - latest.timestamp) / 60000))} minutes old`
                : "Import a CSV or use demo data."}
            </T>
          </Card>
          <Input
            label="Date (YYYY-MM-DD, local day)"
            value={date}
            onChange={D}
          />
          <View style={row}>
            {[3, 6, 12, 24, 168, 336, 720].map((h) => (
              <Button
                key={h}
                label={h < 25 ? `${h} hours` : `${h / 24} days`}
                selected={h === hours}
                onPress={() => H(h)}
              />
            ))}
          </View>
          <T>
            Short ranges start at local midnight. Longer ranges end now. Target
            values below are stored in mg/dL.
          </T>
          <View style={row}>
            <Input label="Target low" value={low} onChange={L} />
            <Input label="Target high" value={high} onChange={U} />
          </View>
          {!valid ? <T>Invalid target; using 70–180 mg/dL.</T> : null}
          <Card>
            <View
              accessibilityLabel={`Glucose chart. ${s.count} readings, ${s.coverage.toFixed(0)} percent coverage.`}
              onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onResponderRelease={(e) => {
                const stamp =
                  start +
                  Math.max(
                    0,
                    Math.min(1, e.nativeEvent.locationX / chartWidth),
                  ) *
                    (end - start);
                const r = rows.reduce<(typeof rows)[number] | undefined>(
                  (nearest, candidate) =>
                    !nearest ||
                    Math.abs(candidate.timestamp - stamp) <
                      Math.abs(nearest.timestamp - stamp)
                      ? candidate
                      : nearest,
                  undefined,
                );
                if (r)
                  S(
                    `${new Date(r.timestamp).toLocaleString()}: ${convert(r.mgdl, state.unit).toFixed(1)} ${state.unit}`,
                  );
              }}
            >
              <Svg width="100%" height={240} viewBox="0 0 900 300">
                <Defs>
                  <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={c.line} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={c.line} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect
                  x={0}
                  y={300 - (((valid ? Number(high) : 180) - 20) / 580) * 300}
                  width={900}
                  height={
                    ((valid ? Number(high) - Number(low) : 110) / 580) * 300
                  }
                  rx={8}
                  fill={c.inRange}
                  opacity={0.14}
                />
                {paths.map((d, i) => (
                  <React.Fragment key={i}>
                    <Path
                      d={areaPath(d)}
                      fill="url(#fade)"
                    />
                    <Path
                      d={d}
                      fill="none"
                      stroke={c.line}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </React.Fragment>
                ))}
              </Svg>
            </View>
            <T>
              Y: 20–600 mg/dL · X: {new Date(start).toLocaleString()} →{" "}
              {new Date(end).toLocaleString()}
            </T>
            <T>
              Gaps represent missing data. Tap chart or browse exact readings
              below.
            </T>
            <T>{selected}</T>
            <Button
              label="Inspect next reading"
              onPress={() => {
                const i = selected
                  ? rows.findIndex((r) =>
                      selected.startsWith(
                        new Date(r.timestamp).toLocaleString(),
                      ),
                    ) + 1
                  : 0;
                const r = rows[i % rows.length];
                if (r)
                  S(
                    `${new Date(r.timestamp).toLocaleString()}: ${convert(r.mgdl, state.unit).toFixed(1)} ${state.unit}`,
                  );
              }}
            />
            <T large>{s.tir.toFixed(1)}% estimated time in range</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg }}>
              <Stat
                label="Average"
                value={convert(s.average, state.unit).toFixed(state.unit === "mmol/L" ? 1 : 0)}
                unit={state.unit}
              />
              <Stat label="Above range" value={`${s.above.toFixed(0)}%`} />
              <Stat label="Below range" value={`${s.below.toFixed(0)}%`} />
              <Stat label="Coverage" value={`${s.coverage.toFixed(0)}%`} />
            </View>
            <T small muted>
              SD {convert(s.sd, state.unit).toFixed(1)} {state.unit} · CV{" "}
              {s.cv.toFixed(1)}% · {s.count} readings
            </T>
            <T small muted>
              Percentages describe observed time only; this is{" "}
              {s.coverage < 99 ? "an incomplete" : "a covered"} interval.
            </T>
          </Card>
          <Button
            kind="primary"
            label="Create a graphic"
            onPress={() => router.push("/create")}
          />
          <Button
            label="Import glucose CSV"
            onPress={() => router.push("/import")}
          />
        </>
      )}
    </Page>
  );
}
const SHOW_LABELS: { key: keyof ShowOptions; label: string; group: "numbers" | "elements" }[] = [
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
  const [o, O] = useState<StoryOptions>(() => defaultOptions("daily_recap", state.unit));
  const [caption, C] = useState("");
  const [visibility, V] = useState<Visibility>("private");
  const [status, Status] = useState("");
  const [preview, P] = useState(false);
  const [day, Day] = useState("");
  const [busy, B] = useState(false);
  const [custom, Custom] = useState(false);
  const [toneIndex, setToneIndex] = useState(0);
  const art = useRef<React.ElementRef<typeof View>>(null);

  // Default day: the latest day that is mostly covered, so the first graphic is a real day, not a sliver of today.
  const defaultAnchor = React.useMemo(() => {
    const last = data.at(-1);
    if (!last) return Date.now();
    const d = new Date(last.timestamp);
    d.setHours(0, 0, 0, 0);
    const count = data.filter((r) => r.timestamp >= d.getTime()).length;
    return d.getTime() + (count >= 200 ? 12 : -12) * 3600000;
  }, [data]);
  const typed = day && Number.isFinite(Date.parse(`${day}T12:00:00`)) ? Date.parse(`${day}T12:00:00`) : null;
  const anchor = typed ?? defaultAnchor;
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const end = dayStart.getTime() + 86400000;
  const start = dayStart.getTime() - (o.period === "week" ? 6 : 0) * 86400000;
  const rows = data.filter((r) => r.timestamp >= start && r.timestamp < end);
  const [w, h] = formats[o.format];
  const noData = !data.length;

  const built = React.useMemo(() => storyArtwork(data, anchor, o, { native: true }), [data, anchor, o]);
  const pw = Math.min(width - 40, 360);
  const ph = (pw * h) / w;

  const patch = (p: Partial<StoryOptions>) => {
    O((prev) => ({ ...prev, ...p }));
    P(false);
  };
  const setShow = (k: keyof ShowOptions, v: boolean) => patch({ show: { ...o.show, [k]: v } });

  const doExport = async (save = false) => {
    B(true);
    Status("");
    try {
      // Web: embed the font so the PNG looks the same on every device. Native: capture exactly what the preview shows.
      const svg = storySvg(data, anchor, o, { embedFont: Platform.OS === "web" });
      await exportImage(
        svg,
        o.format,
        () => captureRef(art, { format: "png", quality: 1, width: w, height: h, result: "tmpfile" }),
        save,
        `gluca-${slug(o.template)}-${o.transparent ? "transparent-" : ""}${o.format.toLowerCase()}.png`,
      );
      Status(
        Platform.OS === "web"
          ? `Saved a ${w}×${h} PNG${o.transparent ? " with a transparent background" : ""}. Nothing was posted.`
          : save ? "Saved to your photo library. Nothing was posted." : "The share sheet was opened. Gluca can’t see what you choose, and never posts for you.",
      );
    } catch (e) {
      Status(e instanceof Error ? e.message : "Export failed.");
    } finally {
      B(false);
    }
  };

  const tint = (selected: boolean) => ({
    width: 48, height: 48, borderRadius: 24, borderWidth: selected ? 3 : 2,
    borderColor: selected ? c.text : c.border,
  });

  return (
    <Page title="Create">
      <T muted>
        Your day, your words. Pick a look, and everything on the image is listed below so you know exactly what you are sharing.
      </T>

      {noData ? <T>No glucose data yet. Milestone graphics work without any; or import a CSV first.</T> : null}

      <View style={{ alignItems: "center", gap: space.md }}>
        <View style={{ width: pw + 16, padding: 8, borderRadius: 22, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border }}>
          <View
            ref={art}
            collapsable={false}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Preview of your graphic. ${built.contents.join(". ")}`}
            style={{ width: pw, height: ph, backgroundColor: "transparent", borderRadius: 14, overflow: "hidden" }}
          >
            <SvgXml xml={built.svg} width={pw} height={ph} />
          </View>
        </View>
        <T small muted align="center">
          {w} × {h} px · {o.transparent ? "transparent PNG" : "solid PNG"} · preview omits the soft glow that appears in web exports
        </T>
      </View>

      <View style={row}>
        {(Object.keys(formats) as FormatName[]).map((f) => (
          <Button key={f} label={f} selected={o.format === f} onPress={() => patch({ format: f })} />
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
                O(switchTemplate(o, t));
                setToneIndex(0);
                P(false);
              }}
            />
          ))}
        </View>
        <T small muted>{templateInfo[o.template].blurb}</T>
      </View>

      {templateInfo[o.template].needsData ? (
        <View style={{ gap: space.sm }}>
          <View style={row}>
            <Button label="Day" selected={o.period === "day"} onPress={() => patch({ period: "day" })} />
            <Button label="7 days" selected={o.period === "week"} onPress={() => patch({ period: "week" })} />
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
        <Button label="Save to photo library" disabled={busy} onPress={() => void doExport(true)} />
      ) : null}
      {status ? <T small>{status}</T> : null}

      <Card tone="raised">
        <Eyebrow>What’s on this image</Eyebrow>
        {built.contents.map((line, i) => (
          <T key={i} small>
            • {line}
          </T>
        ))}
        <T small muted>Only what is listed here is in the export. Exporting never posts anything.</T>
      </Card>

      <Button label={custom ? "Hide customization" : "Customize"} onPress={() => Custom(!custom)} />
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
          <Input label="Headline" value={o.headline} onChange={(v) => patch({ tone: "custom", headline: v.slice(0, 90) })} />
          <Input label="Graphic caption" value={o.caption} onChange={(v) => patch({ tone: "custom", caption: v.slice(0, 140) })} />
          <Button
            label="Another line"
            onPress={() => {
              const tone = o.tone === "custom" ? "minimal" : o.tone;
              const next = toneIndex + 1;
              setToneIndex(next);
              patch({ tone, headline: headlineFor(tone, next), caption: captionFor(tone, next) });
            }}
          />
          {o.template === "milestone" ? (
            <Input label="Milestone" value={o.milestoneBig} onChange={(v) => patch({ milestoneBig: v.slice(0, 24) })} />
          ) : null}
          {templateInfo[o.template].needsData ? (
            <>
              <T bold>Numbers to show (all optional)</T>
              <View style={row}>
                {SHOW_LABELS.filter((x) => x.group === "numbers").map((x) => (
                  <Button key={x.key} label={`${o.show[x.key] ? "Hide" : "Show"} ${x.label.toLowerCase()}`} selected={o.show[x.key]} onPress={() => setShow(x.key, !o.show[x.key])} />
                ))}
              </View>
            </>
          ) : null}
          <T bold>Elements</T>
          <View style={row}>
            {SHOW_LABELS.filter((x) => x.group === "elements").map((x) => (
              <Button key={x.key} label={`${o.show[x.key] ? "Hide" : "Show"} ${x.label.toLowerCase()}`} selected={o.show[x.key]} onPress={() => setShow(x.key, !o.show[x.key])} />
            ))}
          </View>
          <T bold>Theme and colour</T>
          <View style={row}>
            <Button label="Dark" selected={o.theme === "dark"} onPress={() => patch({ theme: "dark" })} />
            <Button label="Light" selected={o.theme === "light"} onPress={() => patch({ theme: "light" })} />
          </View>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            {(["mint", "blue", "lavender", "amber", "white"] as const).map((name) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`Accent ${name}`}
                accessibilityState={{ selected: o.accent === SWATCHES[name] }}
                onPress={() => patch({ accent: SWATCHES[name] })}
                style={[tint(o.accent === SWATCHES[name]), { backgroundColor: SWATCHES[name] }]}
              />
            ))}
          </View>
          <T small muted>Units follow Settings & privacy ({state.unit}). The target range follows the 70–180 mg/dL default.</T>
        </Card>
      ) : null}

      <Card>
        <Eyebrow>Share to the local demo feed</Eyebrow>
        <T small muted>
          Publishing creates a local demo post containing only your selected numerical snapshot and caption. The exported artwork is saved
          separately. Shared images may be copied and cannot always be withdrawn.
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
              Preview: {templateInfo[o.template].label} · {visibility} · {caption || o.caption || o.headline}
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
                  author: "You",
                  title: templateInfo[o.template].label,
                  caption: (caption || o.caption || o.headline).slice(0, 1000),
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
                          label: o.show.date ? new Date(start).toLocaleDateString() : "Date hidden",
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
    </Page>
  );
}
export function Explore() {
  const { state, set } = useDemo();
  return (
    <Page title="Explore">
      <T>
        Participation over competition. This week's invitation: encourage
        another community member.
      </T>
      {clubNames.map((n) => (
        <Card key={n}>
          <T large>{n}</T>
          <T>
            Fictional demo club · Be kind, respect privacy, and avoid treatment
            advice.
          </T>
          <Button
            label={state.clubs.includes(n) ? `Leave ${n}` : `Join ${n}`}
            onPress={() =>
              set((s) => ({
                ...s,
                clubs: s.clubs.includes(n)
                  ? s.clubs.filter((c) => c !== n)
                  : [...s.clubs, n],
              }))
            }
          />
        </Card>
      ))}
      <T large>Community members</T>
      {people
        .filter((p) => !state.blocked.includes(p))
        .map((p) => (
          <Card key={p}>
            <T>{p} · fictional profile</T>
            <Button
              label={`${state.following.includes(p) ? "Unfollow" : "Follow"} ${p}`}
              onPress={() =>
                set((s) => ({
                  ...s,
                  following: s.following.includes(p)
                    ? s.following.filter((n) => n !== p)
                    : [...s.following, p],
                }))
              }
            />
          </Card>
        ))}
    </Page>
  );
}
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
export function Settings() {
  const { state, set } = useDemo();
  const [confirm, C] = useState(false);
  return (
    <Page title="Settings & privacy">
      <Button
        label={state.dark ? "Use light theme" : "Use dark theme"}
        onPress={() => set((s) => ({ ...s, dark: !s.dark }))}
      />
      <Button
        label={`Units: ${state.unit}`}
        onPress={() =>
          set((s) => ({ ...s, unit: s.unit === "mg/dL" ? "mmol/L" : "mg/dL" }))
        }
      />
      <Card>
        <T large>Privacy center</T>
        <T>
          Everything stays in this browser or device. Imported CSV readings use
          unencrypted local demo storage; use synthetic files only in this
          prototype. No server, analytics, or advertising trackers are
          configured.
        </T>
        <T>
          {
            state.posts.filter(
              (p) => p.author === "You" && p.visibility === "public",
            ).length
          }{" "}
          public demo posts ·{" "}
          {
            state.posts.filter(
              (p) => p.author === "You" && p.visibility === "followers",
            ).length
          }{" "}
          followers-only posts ·{" "}
          {
            state.posts.filter(
              (p) => p.author === "You" && p.visibility === "private",
            ).length
          }{" "}
          private posts
        </T>
        <T>
          Account sign-in, server permissions, deletion requests, notifications,
          and live health connections are planned. Registration is not enabled.
        </T>
        <T>Dexcom, Apple Health, Health Connect: not connected.</T>
        <Button
          label="Import / export local data"
          onPress={() => router.push("/import")}
        />
        <Button label="Reset local demo data" onPress={() => C(true)} />
        {confirm ? (
          <>
            <T>Delete posts, imports, and preferences from this local demo?</T>
            <Button
              label="Confirm local reset"
              onPress={() => {
                set(() => seed());
                C(false);
              }}
            />
            <Button label="Cancel reset" onPress={() => C(false)} />
          </>
        ) : null}
      </Card>
      {state.blocked.map((p) => (
        <Button
          key={p}
          label={`Unblock ${p}`}
          onPress={() =>
            set((s) => ({ ...s, blocked: s.blocked.filter((n) => n !== p) }))
          }
        />
      ))}
    </Page>
  );
}
export function ImportScreen() {
  const { state, set } = useDemo();
  const [text, Text] = useState("");
  const [offset, Offset] = useState("-05:00");
  const [order, Order] = useState<"MDY" | "DMY">("MDY");
  const [result, R] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [error, E] = useState("");
  const pick = async () => {
    try {
      const file = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });
      if (file.canceled) return;
      const a = file.assets[0];
      const content =
        Platform.OS === "web"
          ? await a.file!.text()
          : await new File(a.uri).text();
      Text(content);
      R(null);
    } catch {
      E("Unable to read the selected file. You can paste CSV text below.");
    }
  };
  return (
    <Page title="Import & export">
      <T>
        Prototype storage is for synthetic data only. Imports replace the
        selected glucose source after explicit confirmation. Local CSV times
        require an offset and date-order selection; split files at
        daylight-saving transitions.
      </T>
      <Button label="Choose CSV file" onPress={() => void pick()} />
      <Input
        label="CSV text"
        value={text}
        onChange={(v) => {
          Text(v);
          R(null);
        }}
        multiline
      />
      <Input
        label="UTC offset for local timestamps"
        value={offset}
        onChange={(v) => {
          Offset(v);
          R(null);
        }}
      />
      <Button
        label={`Date order: ${order}`}
        onPress={() => {
          Order(order === "MDY" ? "DMY" : "MDY");
          R(null);
        }}
      />
      <Button
        label="Preview import"
        onPress={() => {
          try {
            R(parseCsv(text, order, offset));
            E("");
          } catch (e) {
            E(e instanceof Error ? e.message : "Invalid CSV.");
            R(null);
          }
        }}
      />
      <T>{error}</T>
      {result ? (
        <Card>
          <T>
            {result.readings.length} valid readings · {result.duplicates}{" "}
            duplicates removed · {result.errors.length} rejected rows ·{" "}
            {result.unit}
          </T>
          {result.errors.slice(0, 8).map((e) => (
            <T key={e}>{e}</T>
          ))}
          <Button
            label="Confirm import"
            disabled={!result.readings.length}
            onPress={() => {
              set((s) => ({ ...s, imported: result.readings }));
              E("Imported locally. Dashboard now uses CSV data.");
              R(null);
            }}
          />
        </Card>
      ) : null}
      <Button
        label="Use synthetic source again"
        onPress={() => set((s) => ({ ...s, imported: [] }))}
      />
      <Button
        label="Export local data JSON"
        onPress={() => {
          const json = JSON.stringify(state, null, 2);
          if (Platform.OS === "web") {
            const u = URL.createObjectURL(
              new Blob([json], { type: "application/json" }),
            );
            const a = document.createElement("a");
            a.href = u;
            a.download = "gluca-local-demo.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
          } else
            Share.share({ message: json }).catch(() =>
              E("Sharing unavailable."),
            );
        }}
      />
    </Page>
  );
}
