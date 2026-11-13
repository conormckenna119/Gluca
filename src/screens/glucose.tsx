import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Eyebrow, Input, Stat, T, row, space } from "../ui";
import { RangeInputs } from "../components/range-inputs";
import { useDemo } from "../store";
import { convert, segments, summarize } from "../analytics";
import { Page } from "../components/page";
import { GlucoseChart } from "../components/glucose-chart";
import { useReadings } from "../hooks/use-readings";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";
export function Glucose() {
  const { state } = useDemo();
  const { data = [], isPending, error } = useReadings();
  const [hours, H] = useState(24);
  const [date, D] = useState(new Date().toLocaleDateString("en-CA"));
  const [selected, S] = useState("");
  const [chartWidth, setChartWidth] = useState(320);
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
  const { low, high } = state.range;
  const s = summarize(data, start, end, low, high);
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
            values are stored in mg/dL and shown in {state.unit}.
          </T>
          <RangeInputs />
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
              <GlucoseChart paths={paths} valid high={String(high)} low={String(low)} />
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
          {linkVisible("import", getFlags()) ? (
            <Button
              label="Import glucose CSV"
              onPress={() => router.push("/import")}
            />
          ) : null}
        </>
      )}
    </Page>
  );
}
