import React, { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Chip,
  ConfirmSheet,
  EmptyState,
  IconButton,
  T,
  radius,
  row,
  space,
  useColors,
} from "../ui";
import { Wheel, WheelLabel } from "../components/wheel";
import { useDemo } from "../store";
import { useReadings } from "../hooks/use-readings";
import { segments } from "../analytics";
import { getFlags } from "../flags";
import { redirectFor } from "../nav";
import {
  EVENT_KINDS,
  KIND_LABELS,
  MAX_LABEL,
  WHEEL_DURATION,
  addEvent,
  canShiftDay,
  composeStart,
  defaultStart,
  eventSummary,
  fitPaths,
  floorTo5,
  formatDuration,
  fractionIn,
  hasDuration,
  newEventId,
  removeEvent,
  roundDuration,
  shiftDay,
  stripWindow,
  updateEvent,
  wheelValues,
  type EventKind,
} from "../events";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);
const DURATIONS = wheelValues(
  WHEEL_DURATION.min,
  WHEEL_DURATION.max,
  WHEEL_DURATION.step,
);
const clock = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Six hours of the person's trace around the chosen time, a marker where the event sits, and a bar for an activity. */
function Strip({
  start,
  durationMin,
  kind,
}: {
  start: number;
  durationMin: number;
  kind: EventKind;
}) {
  const c = useColors();
  const { data = [] } = useReadings();
  const [width, setWidth] = useState(300);
  const H = 110;
  const { from, to } = stripWindow(start);
  const rows = useMemo(
    () => data.filter((r) => r.timestamp >= from && r.timestamp <= to),
    [data, from, to],
  );
  const paths = useMemo(() => {
    if (!rows.length) return [];
    const vals = rows.map((r) => r.mgdl);
    const lo = Math.min(...vals) - 10;
    const hi = Math.max(...vals, lo + 60) + 10;
    return fitPaths(segments(data, from, to), width, H - 24, lo, hi);
  }, [data, rows, from, to, width]);
  const x = fractionIn(start, from, to) * width;
  const x2 = fractionIn(start + durationMin * 60000, from, to) * width;
  const label = `${KIND_LABELS[kind]} at ${clock(start)}${hasDuration(kind) ? `, ${formatDuration(durationMin)}` : ""}, on your glucose trace for the 6 hours around it.`;
  return (
    <View
      onLayout={(e) =>
        setWidth(Math.max(120, Math.floor(e.nativeEvent.layout.width)))
      }
      style={{ gap: space.xs }}
    >
      <Svg
        width={width}
        height={H}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        <Rect
          x={0}
          y={0}
          width={width}
          height={H - 24}
          rx={radius.sm}
          fill={c.surface}
          stroke={c.border}
        />
        {hasDuration(kind) && x2 > x ? (
          <Rect
            x={x}
            y={H - 34}
            width={x2 - x}
            height={8}
            rx={4}
            fill={c.accent}
            opacity={0.5}
          />
        ) : null}
        {paths.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill="none"
            stroke={c.line}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <Line
          x1={x}
          x2={x}
          y1={0}
          y2={H - 24}
          stroke={c.accent}
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <Rect
          x={x - 5}
          y={H - 29}
          width={10}
          height={10}
          rx={5}
          fill={c.accent}
        />
        {[from, start, to].map((t, i) => (
          <SvgText
            key={i}
            x={i === 0 ? 2 : i === 2 ? width - 2 : x}
            y={H - 6}
            fontSize={11}
            fontFamily="system-ui, sans-serif"
            fill={c.muted}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          >
            {clock(t)}
          </SvgText>
        ))}
      </Svg>
      {!rows.length ? (
        <T small muted>
          No readings around this time. The marker still shows where the event
          will sit.
        </T>
      ) : (
        <T small muted>
          Gaps in the line are missing data.
        </T>
      )}
    </View>
  );
}

export function LogScreen() {
  const to = redirectFor("/log", getFlags());
  return to ? <Redirect href={to as "/create"} /> : <LogForm />;
}

function LogForm() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, set } = useDemo();
  const existing = id ? state.events.find((e) => e.id === id) : undefined;
  const now = Date.now();
  const [kind, setKind] = useState<EventKind>(existing?.kind ?? "meal");
  const [start, setStart] = useState(
    existing ? floorTo5(existing.start) : defaultStart(now),
  );
  const [dur, setDur] = useState(
    existing && existing.durationMin > 0
      ? roundDuration(existing.durationMin)
      : WHEEL_DURATION.fallback,
  );
  const [label, setLabel] = useState(existing?.label ?? "");
  const [confirming, setConfirming] = useState(false);
  const d = new Date(start);
  const durationMin = hasDuration(kind) ? dur : 0;
  const dayText = d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  if (id && !existing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          padding: space.xl,
          justifyContent: "center",
        }}
      >
        <EmptyState
          icon="info"
          title="This entry is no longer here"
          action={<Button label="Close" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  const save = () => {
    const text = label.trim().slice(0, MAX_LABEL);
    const fields = {
      kind,
      start,
      durationMin,
      ...(text ? { label: text } : {}),
    };
    if (existing)
      set((s) =>
        updateEvent(s, existing.id, { ...fields, label: text || undefined }),
      );
    else set((s) => addEvent(s, { id: newEventId(), ...fields }));
    router.back();
  };
  const remove = () => {
    if (existing) set((s) => removeEvent(s, existing.id));
    setConfirming(false);
    router.back();
  };
  const setTime = (h: number, m: number) =>
    setStart(composeStart(start, h, m, Date.now()));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <T heading>{existing ? "Edit entry" : "Log something"}</T>
      <View style={row}>
        {EVENT_KINDS.map((k) => (
          <Chip
            key={k}
            label={KIND_LABELS[k]}
            selected={k === kind}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton
          icon="chevron-left"
          label="Previous day"
          disabled={!canShiftDay(start, -1, now)}
          onPress={() => setStart(shiftDay(start, -1, Date.now()))}
        />
        <T bold>{dayText}</T>
        <IconButton
          icon="chevron-right"
          label="Next day"
          disabled={!canShiftDay(start, 1, now)}
          onPress={() => setStart(shiftDay(start, 1, Date.now()))}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: space.lg,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Wheel
            label="Start hour"
            options={HOURS}
            index={d.getHours()}
            onIndexChange={(h) => setTime(h, d.getMinutes())}
          />
        </View>
        <WheelLabel>:</WheelLabel>
        <Wheel
          label="Start minute"
          options={MINUTES}
          index={Math.round(d.getMinutes() / 5) % 12}
          onIndexChange={(i) => setTime(d.getHours(), i * 5)}
        />
        {hasDuration(kind) ? (
          <Wheel
            label="Duration in minutes"
            width={96}
            options={DURATIONS.map((m) => `${m} min`)}
            index={DURATIONS.indexOf(dur)}
            onIndexChange={(i) => setDur(DURATIONS[i])}
          />
        ) : null}
      </View>
      <T small muted align="center">
        {eventSummary({ kind, durationMin })} at {clock(start)}
      </T>
      <View style={{ gap: 6 }}>
        <T small muted bold>
          Label
        </T>
        <TextInput
          accessibilityLabel="Label, optional, up to 40 characters"
          value={label}
          onChangeText={(v) => setLabel(v.slice(0, MAX_LABEL))}
          maxLength={MAX_LABEL}
          placeholder="Optional, e.g. lunch, walk"
          placeholderTextColor={c.muted}
          style={{
            minHeight: 50,
            padding: space.md,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            color: c.text,
            backgroundColor: c.surface,
            fontSize: 16,
          }}
        />
      </View>
      <Strip start={start} durationMin={durationMin} kind={kind} />
      <View style={{ gap: space.sm }}>
        <Button kind="primary" label="Save" onPress={save} />
        <Button label="Cancel" onPress={() => router.back()} />
        {existing ? (
          <Button label="Delete" onPress={() => setConfirming(true)} />
        ) : null}
      </View>
      <ConfirmSheet
        visible={confirming}
        title="Delete this entry?"
        body="It is removed from this device. This cannot be undone."
        confirmLabel="Delete entry"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </ScrollView>
  );
}
