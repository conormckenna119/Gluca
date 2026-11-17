import React, { useRef, useState } from "react";
import { BRAND } from "../art/brand";
import { View, Platform, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { captureRef } from "react-native-view-shot";
import { Button, Card, Input, T, row, space } from "../ui";
import { useDemo } from "../store";
import {
  defaultOptions,
  formats,
  storyArtwork,
  storySvg,
  switchTemplate,
  templateIds,
  templateInfo,
  type FormatName,
  type StoryOptions,
} from "../story";
import { exportImage } from "../export";
import { readShareParams } from "../achievement-share";
import { Page } from "../components/page";
import { ArtworkPreview } from "../components/create/artwork-preview";
import { PhotoBackground } from "../components/create/photo-background";
import { TemplateStrip } from "../components/create/template-strip";
import { DayPicker } from "../components/create/day-picker";
import {
  ExportPanel,
  type ExportResult,
} from "../components/create/export-panel";
import { Customize } from "../components/create/customize";
import { PublishCard } from "../components/create/publish-card";
import { rangeToText } from "../state";
import { useCreateReadings } from "../hooks/use-create-readings";
import { utcDayWindow } from "../create-source";
import { storyComposition } from "../story-composition";
import { GlucoseSyncStatus } from "../components/glucose-sync-status";
import { getFlags, isEnabled } from "../flags";
import { track, exportFormatId, exportFailReason } from "../telemetry";
const slug = (s: string) => s.replace(/_/g, "-");

export function Create() {
  const { state, set } = useDemo();
  const { width } = useWindowDimensions();
  const feed = useCreateReadings();
  const { data } = feed;
  const isDexcom = feed.source === "dexcom";
  const canDexcom =
    __DEV__ &&
    Platform.OS === "web" &&
    getFlags().dexcomApi &&
    getFlags().dexcomDiagnostics;
  const [base, O] = useState<StoryOptions>(() =>
    defaultOptions("daily_recap", state.unit),
  );
  // Unit and range come from the store on every render, so Settings changes apply without a reload.
  const o = React.useMemo<StoryOptions>(
    () => ({
      ...base,
      unit: state.unit,
      range: state.range,
      provenance: isDexcom
        ? "dexcom-sandbox"
        : feed.source === "csv"
          ? "csv"
          : undefined,
      ...(isDexcom ? { period: "day" as const } : {}),
    }),
    [base, state.unit, state.range, isDexcom, feed.source],
  );
  const [result, setResult] = useState<ExportResult>({ kind: "idle" });
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, B] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const previousSession = useRef(feed.sessionVersion);
  React.useEffect(() => {
    if (previousSession.current === feed.sessionVersion) return;
    previousSession.current = feed.sessionVersion;
    setPhotoUri(null);
    setResult({ kind: "idle" });
    setPicked(null);
  }, [feed.sessionVersion]);
  const art = useRef<React.ElementRef<typeof View>>(null);
  // Welcome opens Create with ?template=milestone; apply it when the param arrives.
  const {
    template: wanted,
    headline: wantedHeadline,
    big: wantedBig,
  } = useLocalSearchParams<{
    template?: string;
    headline?: string;
    big?: string;
  }>();
  React.useEffect(() => {
    const id = templateIds.find((t) => t === wanted);
    if (id) {
      // A medal share passes its name as text for the milestone template (90 / 24 character limits).
      const text = readShareParams({
        headline: wantedHeadline,
        big: wantedBig,
      });
      O((prev) => {
        const next = switchTemplate(prev, id);
        if (id !== "milestone") return next;
        return {
          ...next,
          ...(text.headline
            ? { tone: "custom" as const, headline: text.headline }
            : {}),
          ...(text.big ? { milestoneBig: text.big } : {}),
        };
      });
      if (!isDexcom)
        track("template_selected", {
          template: id,
          source: feed.source === "csv" ? "csv" : "demo",
        });
    }
  }, [wanted, wantedHeadline, wantedBig]);

  // Default day: the latest day that is mostly covered, so the first graphic is a real day, not a sliver of today.
  const defaultAnchor = React.useMemo(() => {
    if (isDexcom) {
      try {
        return utcDayWindow(feed.loadedDay).start + 43200000;
      } catch {
        return 0;
      }
    }
    const last = data.at(-1);
    if (!last) return Date.now();
    const d = new Date(last.timestamp);
    d.setHours(0, 0, 0, 0);
    const count = data.filter((r) => r.timestamp >= d.getTime()).length;
    return d.getTime() + (count >= 200 ? 12 : -12) * 3600000;
  }, [data, isDexcom, feed.loadedDay]);
  const anchor = isDexcom ? defaultAnchor : (picked ?? defaultAnchor);
  const dayStart = new Date(anchor);
  if (isDexcom) dayStart.setUTCHours(0, 0, 0, 0);
  else dayStart.setHours(0, 0, 0, 0);
  const end = dayStart.getTime() + 86400000;
  const start = dayStart.getTime() - (o.period === "week" ? 6 : 0) * 86400000;
  const rows = data.filter((r) => r.timestamp >= start && r.timestamp < end);
  const [w, h] = formats[o.format];
  const noData = !data.length;

  // Logged events only reach the artwork while the eventLogging flag is on.
  const events =
    !isDexcom && isEnabled("eventLogging") ? state.events : undefined;
  const built = React.useMemo(
    () => storyArtwork(data, anchor, o, { native: true, events }),
    [data, anchor, o, events],
  );
  // The contents list must match the image: a chosen photo is part of the export, so it is listed.
  const composition = storyComposition(o.transparent, photoUri);
  const hasPhoto = composition.background === "photo";
  const contents = React.useMemo(
    () =>
      hasPhoto
        ? [
            ...built.contents.filter((l) => !/transparent/i.test(l)),
            "Your photo as the background",
          ]
        : built.contents,
    [built.contents, hasPhoto],
  );
  const pw = Math.min(width - 40, 360);
  const ph = (pw * h) / w;

  const patch = (p: Partial<StoryOptions>) => O((prev) => ({ ...prev, ...p }));

  const doExport = async (save = false) => {
    if (isDexcom && (feed.busy || !data.length || feed.day !== feed.loadedDay))
      return;
    B(true);
    setResult({ kind: "idle" });
    const evt = {
      template: o.template,
      format: exportFormatId(o.format, o.transparent),
    } as const;
    if (!isDexcom) track("export_started", evt);
    try {
      // Web: embed the font so the PNG looks the same on every device. Native: capture exactly what the preview shows.
      const svg = storySvg(data, anchor, o, {
        embedFont: Platform.OS === "web",
        events,
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
        composition.photoUri ?? undefined,
      );
      if (!isDexcom) track("export_succeeded", evt);
      if (!isDexcom)
        set((s) => ({
          ...s,
          counters: { ...s.counters, exports: s.counters.exports + 1 },
        }));
      if (Platform.OS !== "web" && !save) track("share_sheet_opened", evt);
      setResult({
        kind: "success",
        text:
          Platform.OS === "web"
            ? `Saved a ${w}×${h} PNG${hasPhoto ? " with your photo behind it" : o.transparent ? " with a transparent background" : ""}. Nothing was posted.`
            : save
              ? "Saved to your photo library. Nothing was posted."
              : `The share sheet was opened. ${BRAND.name} can’t see what you choose, and never posts for you.`,
      });
    } catch (e) {
      if (!isDexcom)
        track("export_failed", { ...evt, reason: exportFailReason(e) });
      setResult({
        kind: "error",
        text: e instanceof Error ? e.message : "Export failed.",
      });
    } finally {
      B(false);
    }
  };

  return (
    <Page
      title="Create"
      glucoseLabel={
        isDexcom
          ? "Dexcom Sandbox · Simulated"
          : feed.source === "csv"
            ? "Imported CSV glucose"
            : "Synthetic glucose"
      }
    >
      <GlucoseSyncStatus />
      <Card>
        <T bold>Glucose Story · Share My Day</T>
        <T small muted>
          Choose the data used for this graphic. Nothing is published
          automatically.
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Button
            label="Demo data"
            selected={feed.source === "demo"}
            onPress={() => {
              feed.select("demo");
              setPicked(null);
              setResult({ kind: "idle" });
            }}
          />
          <Button
            label="CSV data"
            selected={feed.source === "csv"}
            onPress={() => {
              feed.select("csv");
              setPicked(null);
              setResult({ kind: "idle" });
            }}
          />
          {canDexcom ? (
            <Button
              label="Dexcom Sandbox"
              selected={isDexcom}
              onPress={() => {
                feed.select("dexcom");
                setPicked(null);
                setResult({ kind: "idle" });
              }}
            />
          ) : null}
        </View>
        {isDexcom ? (
          <>
            <T>Dexcom Sandbox · SIMULATED · UTC calendar day</T>
            {feed.range ? (
              <T small>
                Available:{" "}
                {new Date(feed.range.start).toISOString().slice(0, 10)} through{" "}
                {new Date(feed.range.end).toISOString().slice(0, 10)}.
              </T>
            ) : null}
            <Input
              label="Historical date (UTC, YYYY-MM-DD)"
              value={feed.day}
              onChange={(v) => {
                feed.setDay(v);
                setResult({ kind: "idle" });
              }}
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />
            <Button
              label={
                feed.busy
                  ? "Retrieving Dexcom data…"
                  : "Load selected Dexcom day"
              }
              disabled={feed.busy}
              onPress={() => void feed.load(feed.day || undefined)}
            />
            <T small>
              {data.length} Dexcom readings loaded
              {feed.loadedDay ? ` for ${feed.loadedDay} UTC` : ""}. The preview
              uses the loaded day. To use another period, select its date and
              load it. Data stays in this open app.
            </T>
            {feed.error ? (
              <View accessibilityRole="alert">
                <T>{feed.error}</T>
              </View>
            ) : null}
          </>
        ) : null}
      </Card>
      <T muted>
        Your day, your words. Pick a look, and everything on the image is listed
        below so you know exactly what you are sharing.
      </T>

      {noData ? (
        <T>
          {isDexcom
            ? "No Dexcom data loaded. Demo and CSV are not substituted."
            : "No glucose data yet. Milestone graphics work without any; or import a CSV first."}
        </T>
      ) : null}

      {!isDexcom || !noData ? (
        <View style={{ alignItems: "center", gap: space.md }}>
          <ArtworkPreview
            ref={art}
            svg={built.svg}
            width={pw}
            height={ph}
            label={`Preview of your graphic. ${contents.join(". ")}`}
            photoUri={composition.photoUri}
          />
          <T small muted align="center">
            {w} × {h} px ·{" "}
            {hasPhoto
              ? "PNG with your photo"
              : o.transparent
                ? "transparent PNG"
                : "solid PNG"}
          </T>
        </View>
      ) : null}

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
      {o.transparent ? (
        <PhotoBackground photoUri={photoUri} onChange={setPhotoUri} />
      ) : null}

      {!isDexcom || !noData ? (
        <TemplateStrip
          data={data}
          anchor={anchor}
          options={o}
          noData={noData}
          onSelect={(t) => {
            if (!isDexcom)
              track("template_selected", {
                template: t,
                source: feed.source === "csv" ? "csv" : "demo",
              });
            O(switchTemplate(o, t));
          }}
        />
      ) : null}

      {templateInfo[o.template].needsData && !isDexcom ? (
        <DayPicker
          period={o.period}
          onPeriod={(p) => patch({ period: p })}
          data={data}
          anchor={anchor}
          onAnchor={setPicked}
        />
      ) : null}

      <ExportPanel
        busy={busy}
        disabled={
          (templateInfo[o.template].needsData && noData) ||
          (isDexcom &&
            (feed.busy || !data.length || feed.day !== feed.loadedDay))
        }
        result={result}
        contents={isDexcom && noData ? [] : contents}
        onShare={() => void doExport()}
        onSave={Platform.OS !== "web" ? () => void doExport(true) : undefined}
      />

      <Customize
        options={o}
        onChange={O}
        rangeText={`${rangeToText(state.range.low, state.unit)}–${rangeToText(state.range.high, state.unit)} ${state.unit}`}
      />

      {getFlags().communityFeed && !isDexcom ? (
        <PublishCard options={o} rows={rows} start={start} end={end} />
      ) : null}
    </Page>
  );
}
