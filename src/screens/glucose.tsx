import React, { useMemo, useState } from "react";
import { BRAND } from "../art/brand";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { router } from "expo-router";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Eyebrow,
  Group,
  Input,
  ListRow,
  Notice,
  Section,
  Stat,
  T,
  radius,
  row,
  space,
  useColors,
} from "../ui";
import { RangeInputs } from "../components/range-inputs";
import { useDemo } from "../store";
import { segments, summarize } from "../analytics";
import { Page } from "../components/page";
import { CHART_PLOT, GlucoseChart } from "../components/glucose-chart";
import { useReadings } from "../hooks/use-readings";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";
import { eventSummary, eventsInWindow } from "../events";
import {
  STATUS_WORDS,
  chartSummary,
  formatAgo,
  formatGlucose,
  rangeStatus,
  timeTicks,
  yScale,
  type RangeStatus,
} from "../chart-scale";

const PERIODS = [3, 6, 12, 24, 168, 336, 720];
const periodLabel = (h: number) => (h < 25 ? `${h} hours` : `${h / 24} days`);

/** Small shape that says below / in / above without colour: down triangle, circle, up triangle. */
function RangeGlyph({
  status,
  size = 16,
}: {
  status: RangeStatus;
  size?: number;
}) {
  const c = useColors();
  const color = c[status === "in" ? "inRange" : status];
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {status === "in" ? (
        <Circle cx={8} cy={8} r={6} fill={color} />
      ) : status === "above" ? (
        <Path d="M8 2 L14.5 13.5 H1.5 Z" fill={color} />
      ) : (
        <Path d="M8 14 L14.5 2.5 H1.5 Z" fill={color} />
      )}
    </Svg>
  );
}

function Tile({
  status,
  children,
}: {
  status?: RangeStatus;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "46%",
        gap: space.sm,
        padding: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      {status ? <RangeGlyph status={status} /> : null}
      {children}
    </View>
  );
}

export function Glucose() {
  const { state } = useDemo();
  const { data = [], isPending, error, refetch } = useReadings();
  const c = useColors();
  const [hours, H] = useState(24);
  const [date, D] = useState(new Date().toLocaleDateString("en-CA"));
  const [selected, S] = useState("");
  const [chartWidth, setChartWidth] = useState(320);
  const { low, high } = state.range;
  const unit = state.unit;
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

  const rows = useMemo(
    () => data.filter((r) => r.timestamp >= start && r.timestamp < end),
    [data, start, end],
  );
  const s = useMemo(
    () => summarize(data, start, end, low, high),
    [data, start, end, low, high],
  );
  const paths = useMemo(() => segments(data, start, end), [data, start, end]);
  const values = rows.map((r) => r.mgdl);
  const scale = yScale(values, low, high, unit);
  const xTicks = timeTicks(start, end, chartWidth < 420 ? 5 : 7);
  const latest =
    data.filter((r) => r.timestamp <= Date.now()).at(-1) ?? data.at(-1);
  const status = latest ? rangeStatus(latest.mgdl, low, high) : undefined;
  const fmt = (m: number) => formatGlucose(m, unit);
  const reading = (r: (typeof rows)[number]) =>
    `${new Date(r.timestamp).toLocaleString()}: ${formatGlucose(r.mgdl, unit)} ${unit}`;
  const summary = chartSummary({
    periodLabel: periodLabel(hours),
    count: s.count,
    coveragePct: s.coverage,
    minMgdl: values.length ? Math.min(...values) : undefined,
    maxMgdl: values.length ? Math.max(...values) : undefined,
    low,
    high,
    unit,
  });
  const canImport = linkVisible("import", getFlags());
  const canLog = linkVisible("log", getFlags());
  const logged = canLog ? eventsInWindow(state.events, start, end) : [];

  const importButton = canImport ? (
    <Button
      kind="primary"
      label="Import glucose CSV"
      onPress={() => router.push("/import")}
    />
  ) : null;

  return (
    <Page
      title="My Glucose"
      subtitle="Look back at your own readings. Not for treatment decisions or glucose alarms."
    >
      {isPending ? (
        <Card>
          <T muted>Loading readings…</T>
        </Card>
      ) : error ? (
        <Notice tone="error" title="Could not load readings">
          <T small>
            Something went wrong reading your glucose data on this device.
            Nothing was sent anywhere.
          </T>
          <Button label="Try again" onPress={() => void refetch()} />
        </Notice>
      ) : !data.length || !latest || !status ? (
        <EmptyState
          icon="upload"
          title="No readings yet"
          body={
            canImport
              ? "Import a glucose CSV from your meter or app, or switch back to the synthetic demo data in Settings."
              : "Switch to the synthetic demo data in Settings, or come back once you have readings."
          }
          action={importButton}
        />
      ) : (
        <>
          <Card tone="raised">
            <Eyebrow>Latest reading</Eyebrow>
            <View
              accessible
              accessibilityLabel={`Latest reading ${fmt(latest.mgdl)} ${unit}, ${formatAgo(latest.timestamp, Date.now())}. ${STATUS_WORDS[status]}.`}
              style={{ gap: space.xs }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: space.sm,
                }}
              >
                <T large>{fmt(latest.mgdl)}</T>
                <T muted bold>
                  {unit}
                </T>
              </View>
              <T muted>{formatAgo(latest.timestamp, Date.now())}</T>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
              }}
            >
              <RangeGlyph status={status} />
              <T bold>{STATUS_WORDS[status]}</T>
            </View>
            <T small muted>
              {latest.source === "mock"
                ? "Synthetic demo data"
                : "From your imported CSV"}{" "}
              · {new Date(latest.timestamp).toLocaleString()}
            </T>
          </Card>

          <Section
            title="Period"
            note="Short periods show one local day starting at midnight. Longer periods end now."
          >
            <View style={row}>
              {PERIODS.map((h) => (
                <Chip
                  key={h}
                  label={periodLabel(h)}
                  selected={h === hours}
                  onPress={() => H(h)}
                />
              ))}
            </View>
            {hours <= 24 ? (
              <Input
                label="Date (YYYY-MM-DD, local day)"
                value={date}
                onChange={D}
              />
            ) : null}
          </Section>

          <Section
            title="Chart"
            note={`Y axis in ${unit}, fitted to your readings and target range.`}
          >
            <Card>
              <View
                accessibilityLabel={summary}
                onLayout={(e) =>
                  setChartWidth(
                    Math.max(120, Math.floor(e.nativeEvent.layout.width)),
                  )
                }
                onStartShouldSetResponder={() => true}
                onResponderRelease={(e) => {
                  const plotW = Math.max(
                    40,
                    chartWidth - CHART_PLOT.left - CHART_PLOT.right,
                  );
                  const frac = Math.max(
                    0,
                    Math.min(
                      1,
                      (e.nativeEvent.locationX - CHART_PLOT.left) / plotW,
                    ),
                  );
                  const stamp = start + frac * (end - start);
                  const r = rows.reduce<(typeof rows)[number] | undefined>(
                    (nearest, cand) =>
                      !nearest ||
                      Math.abs(cand.timestamp - stamp) <
                        Math.abs(nearest.timestamp - stamp)
                        ? cand
                        : nearest,
                    undefined,
                  );
                  if (r) S(reading(r));
                }}
              >
                <GlucoseChart
                  paths={paths}
                  width={chartWidth}
                  scale={scale}
                  xTicks={xTicks}
                  start={start}
                  end={end}
                  low={low}
                  high={high}
                  unit={unit}
                  label={summary}
                />
              </View>
              {!rows.length ? (
                <T small muted>
                  No readings in this period. Try another period or date.
                </T>
              ) : null}
              <T small muted>
                Gaps in the line are missing data; they are never filled in. Tap
                the chart or use the button to read exact values.
              </T>
              {selected ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: c.raised,
                  }}
                >
                  <T bold>{selected}</T>
                </View>
              ) : null}
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
                  if (r) S(reading(r));
                }}
              />
            </Card>
          </Section>

          {canLog ? (
            <Section
              title="Logged"
              note="Meals, activity and notes you marked, for your own graphics."
            >
              {logged.length ? (
                <Group>
                  {logged.map((e) => (
                    <ListRow
                      key={e.id}
                      title={`${eventSummary(e)}${e.label ? `: ${e.label}` : ""}`}
                      detail={new Date(e.start).toLocaleString([], {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      accessibilityLabel={`Edit ${eventSummary(e)} at ${new Date(e.start).toLocaleString()}`}
                      onPress={() =>
                        router.push({ pathname: "/log", params: { id: e.id } })
                      }
                    />
                  ))}
                </Group>
              ) : (
                <T small muted>
                  Nothing logged in this period.
                </T>
              )}
              <Button
                label="Log a meal or activity"
                onPress={() => router.push("/log")}
              />
            </Section>
          ) : null}

          <Section title="This period">
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}
            >
              <Tile>
                <Stat
                  label="Average"
                  value={s.count ? fmt(s.average) : "–"}
                  unit={s.count ? unit : undefined}
                />
              </Tile>
              <Tile status="in">
                <Stat
                  label="Time in range"
                  value={s.count ? `${s.tir.toFixed(0)}%` : "–"}
                />
              </Tile>
              <Tile status="below">
                <Stat
                  label="Time below range"
                  value={s.count ? `${s.below.toFixed(0)}%` : "–"}
                />
              </Tile>
              <Tile status="above">
                <Stat
                  label="Time above range"
                  value={s.count ? `${s.above.toFixed(0)}%` : "–"}
                />
              </Tile>
              <Tile>
                <Stat label="Readings" value={String(s.count)} />
              </Tile>
              <Tile>
                <Stat label="Coverage" value={`${s.coverage.toFixed(0)}%`} />
              </Tile>
            </View>
            <T small muted>
              Variability: SD {s.count ? fmt(s.sd) : "–"} {unit} · CV{" "}
              {s.count ? s.cv.toFixed(0) : "–"}%
            </T>
          </Section>

          <Notice title="About these numbers">
            {`Time in, below and above range are shares of the time we have readings for in the selected period only (${periodLabel(hours)}). They are not medical advice, and ${BRAND.name} is not a medical device.${
              s.coverage < 99
                ? ` Coverage is ${s.coverage.toFixed(0)}%, so some of this period has no data and the figures may not reflect all of it.`
                : ""
            }`}
          </Notice>

          <Section
            title="Target range"
            note={`Stored in mg/dL and shown in ${unit}.`}
          >
            <RangeInputs />
          </Section>

          <View style={{ gap: space.md }}>
            <Button
              kind="primary"
              label="Create a graphic"
              onPress={() => router.push("/create")}
            />
            {canImport ? (
              <Button
                label="Import glucose CSV"
                onPress={() => router.push("/import")}
              />
            ) : null}
          </View>
        </>
      )}
    </Page>
  );
}
