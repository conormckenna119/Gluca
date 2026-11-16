import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Card, Pill, Stat, T, space, useColors } from "../ui";
import { getFlags } from "../flags";
import {
  DexcomGlucoseProvider,
  GlucoseDataError,
  glucoseDataMessage,
} from "../services/dexcom-data";
import {
  createOAuthClient,
  ConnectionError,
  connectionLabel,
  type ConnectionStatus,
} from "../services/dexcom-oauth";
import type { DexcomDataResult, DexcomRangeResult } from "../glucose-window";
import { summarize, segments } from "../analytics";
import { periodSummaries, utcChartTicks } from "../glucose-periods";
import { yScale } from "../chart-scale";
import { GlucoseChart } from "../components/glucose-chart";

const utc = (t: number) =>
  new Date(t).toISOString().replace("T", " ").replace(".000Z", " UTC");
/** Isolated opt-in browser diagnostics. Never writes to the demo store, query cache, telemetry or device storage. */
export default function DexcomData() {
  const c = useColors();
  const flags = getFlags();
  const allowed =
    __DEV__ &&
    Platform.OS === "web" &&
    flags.dexcomApi &&
    flags.dexcomDiagnostics;
  const provider = useMemo(() => new DexcomGlucoseProvider(), []);
  const generation = useRef(0);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [range, setRange] = useState<DexcomRangeResult | null>(null);
  const [data, setData] = useState<DexcomDataResult | null>(null);
  const [days, setDays] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(260);
  const clear = useCallback(() => {
    generation.current++;
    provider.clear();
    setData(null);
    setRange(null);
    setStatus(null);
    setBusy(false);
    setError("");
  }, [provider]);
  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      const epoch = generation.current;
      createOAuthClient()
        .status()
        .then((s) => {
          if (epoch === generation.current) setStatus(s);
        })
        .catch((e) => {
          if (epoch === generation.current)
            setError(
              glucoseDataMessage(
                e instanceof ConnectionError ? new GlucoseDataError(e.code) : e,
              ),
            );
        });
      return clear;
    }, [allowed, clear]),
  );
  useEffect(() => {
    if (!allowed || typeof document === "undefined") return;
    const hidden = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [allowed, clear]);
  async function refresh() {
    clear();
    const epoch = generation.current;
    setBusy(true);
    try {
      const s = await createOAuthClient().status();
      if (epoch !== generation.current) return;
      setStatus(s);
      if (s.mode !== "dexcom")
        throw new GlucoseDataError("dexcom_not_configured");
      if (!s.connected) throw new GlucoseDataError("needs_reconnect");
      const r = await provider.loadLatest(days);
      if (epoch !== generation.current) return;
      // Retrieve the range even when the authorized account has no EGVs.
      setRange(provider.availableRange);
      setData(r);
    } catch (e) {
      if (epoch === generation.current) {
        provider.clear();
        setData(null);
        setRange(null);
        setError(
          glucoseDataMessage(
            e instanceof ConnectionError ? new GlucoseDataError(e.code) : e,
          ) +
            (e instanceof GlucoseDataError && e.retryAfterSeconds
              ? ` Retry after ${e.retryAfterSeconds} seconds.`
              : ""),
        );
        if (e instanceof GlucoseDataError && e.code === "needs_reconnect")
          setStatus((s) =>
            s ? { ...s, connected: false, needsReconnect: true } : null,
          );
      }
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  const stats = data
    ? summarize(
        data.readings,
        data.window.start,
        data.window.end,
        70,
        180,
        "utc",
      )
    : null;
  if (!allowed)
    return (
      <View style={{ padding: space.xl, backgroundColor: c.bg, flex: 1 }}>
        <T>Development diagnostics are unavailable in this build.</T>
        <Button label="Settings" onPress={() => router.replace("/settings")} />
      </View>
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, alignItems: "center" }}
    >
      <View style={{ width: "100%", maxWidth: 760, gap: space.lg }}>
        <Button
          label="Back to Settings"
          onPress={() => router.push("/settings")}
        />
        <T large>Dexcom data viewer</T>
        <Pill>Development only · Sandbox · SIMULATED</Pill>
        <T muted>
          Source: official Dexcom sandbox when connected. Readings stay in this
          viewer’s memory until cleared, hidden or closed. Nothing is published.
        </T>
        <Card>
          <T heading>
            Connection: {status ? connectionLabel(status) : "Not checked"}
          </T>
          <T small>
            Environment: {status?.environment ?? "sandbox"}.{" "}
            {status?.mode === "mock"
              ? "Backend credentials are not configured."
              : ""}
          </T>
          <T>
            Historical period: latest {days} {days === 1 ? "day" : "days"} of
            available data (UTC).
          </T>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            {[1, 7, 30].map((d) => (
              <Button
                key={d}
                label={`${d} ${d === 1 ? "day" : "days"}`}
                selected={days === d}
                disabled={busy}
                onPress={() => {
                  clear();
                  setDays(d);
                }}
              />
            ))}
          </View>
          <Button
            label={busy ? "Retrieving data…" : "Refresh Data"}
            disabled={busy}
            kind="primary"
            onPress={refresh}
          />
          <Button label="Clear data from memory" onPress={clear} />
          {error ? (
            <View accessibilityRole="alert">
              <T>{error}</T>
            </View>
          ) : null}
        </Card>
        {range ? (
          <Card>
            <T heading>Available history</T>
            <T>
              {range.range
                ? `${utc(range.range.start)} through ${utc(range.range.end)}`
                : "No available EGV history for this account."}
            </T>
          </Card>
        ) : null}
        {data && stats ? (
          <>
            <Card>
              <T heading>Retrieved period</T>
              <T>
                {utc(data.window.start)} through {utc(data.window.end)} (end
                exclusive)
              </T>
              <T>
                Most recent retrieved reading:{" "}
                {data.readings.length
                  ? utc(data.readings[data.readings.length - 1].timestamp)
                  : "None"}
              </T>
              <T>
                {data.readings.length} readings · {data.rejectedCount} rejected
                · {data.duplicateCount} duplicate records ·{" "}
                {data.outsideWindowCount} outside period.
              </T>
              <T small muted>
                Latest available reading:{" "}
                {data.range ? utc(data.range.end) : "None"}. Source: Dexcom
                sandbox, simulated. Device system timestamps may drift; original
                timestamps are preserved.
              </T>
            </Card>
            <Card>
              <View
                onLayout={(e) =>
                  setWidth(Math.max(180, e.nativeEvent.layout.width))
                }
                style={{ width: "100%" }}
              >
                <GlucoseChart
                  width={width}
                  paths={segments(
                    data.readings,
                    data.window.start,
                    data.window.end,
                    900,
                    300,
                    "utc",
                  )}
                  scale={yScale(
                    data.readings.map((r) => r.mgdl),
                    70,
                    180,
                    "mg/dL",
                  )}
                  xTicks={utcChartTicks(data.window.start, data.window.end)}
                  start={data.window.start}
                  end={data.window.end}
                  low={70}
                  high={180}
                  unit="mg/dL"
                  label="Simulated Dexcom glucose over time, UTC; gaps show missing data"
                />
              </View>
              <T small muted>
                UTC · mg/dL · Reference range 70–180 mg/dL. No interpolation
                across gaps.
              </T>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.lg,
                }}
              >
                <Stat
                  label="Average"
                  value={stats.count ? stats.average.toFixed(1) : "—"}
                  unit="mg/dL"
                />
                <Stat
                  label="In range"
                  value={stats.count ? stats.tir.toFixed(1) : "—"}
                  unit="%"
                />
                <Stat
                  label="Above range"
                  value={stats.count ? stats.above.toFixed(1) : "—"}
                  unit="%"
                />
                <Stat
                  label="Below range"
                  value={stats.count ? stats.below.toFixed(1) : "—"}
                  unit="%"
                />
                <Stat
                  label="Coverage"
                  value={stats.coverage.toFixed(1)}
                  unit="%"
                />
                <Stat label="Readings" value={String(stats.count)} />
              </View>
              <T small muted>
                Range percentages describe observed time only. Missing time
                reduces coverage. Dexcom 39/401 limit markers are bounded
                estimates, not precise measurements.
              </T>
            </Card>
            {(["day", "week"] as const).map((kind) => (
              <Card key={kind}>
                <T heading>
                  {kind === "day" ? "Daily" : "Weekly"} summaries · UTC
                </T>
                {periodSummaries(data.readings, data.window, kind).map((p) => (
                  <View key={p.start} style={{ gap: space.xs }}>
                    <T small bold>
                      {new Date(p.start).toISOString().slice(0, 10)} ·{" "}
                      {p.fullyRequested
                        ? "Full requested calendar period"
                        : "Partial requested calendar period"}
                    </T>
                    <T small>
                      {p.stats.count} readings · Average{" "}
                      {p.stats.count
                        ? p.stats.average.toFixed(1) + " mg/dL"
                        : "unavailable"}{" "}
                      · In {p.stats.tir.toFixed(1)}% / Above{" "}
                      {p.stats.above.toFixed(1)}% / Below{" "}
                      {p.stats.below.toFixed(1)}% · Coverage{" "}
                      {p.stats.coverage.toFixed(1)}%
                    </T>
                  </View>
                ))}
              </Card>
            ))}
          </>
        ) : null}
        {/* Claude design handoff: revisit diagnostics presentation only if this becomes a product feature. Preserve privacy gates, explicit simulation/coverage labels, and existing charts. */}
      </View>
    </ScrollView>
  );
}
