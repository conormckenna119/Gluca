import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Chip,
  Icon,
  IconButton,
  Sheet,
  T,
  radius,
  row,
  space,
  useColors,
} from "../../ui";
import {
  anchorForDay,
  countByDay,
  dayLabel,
  dayOf,
  daysWithData,
  stepDay,
} from "../../days";
import type { Reading } from "../../types";

export function DayPicker({
  period,
  onPeriod,
  data,
  anchor,
  onAnchor,
}: {
  period: "day" | "week";
  onPeriod: (p: "day" | "week") => void;
  data: Reading[];
  anchor: number;
  onAnchor: (ms: number | null) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const counts = useMemo(
    () => countByDay(data.map((r) => r.timestamp)),
    [data],
  );
  const days = useMemo(
    () => daysWithData(data.map((r) => r.timestamp)),
    [data],
  );
  const current = dayOf(anchor);
  const prev = stepDay(days, current, -1);
  const next = stepDay(days, current, 1);
  const text =
    period === "week"
      ? `7 days ending ${dayLabel(current)}`
      : dayLabel(current);
  const newestFirst = useMemo(() => [...days].reverse(), [days]);

  return (
    <View style={{ gap: space.sm }}>
      <View style={row}>
        <Chip
          label="Day"
          selected={period === "day"}
          onPress={() => onPeriod("day")}
        />
        <Chip
          label="7 days"
          selected={period === "week"}
          onPress={() => onPeriod("week")}
        />
      </View>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
      >
        <IconButton
          icon="chevron-left"
          label="Previous day"
          disabled={prev === null}
          onPress={() => prev !== null && onAnchor(anchorForDay(prev))}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose day"
          accessibilityHint={text}
          disabled={days.length === 0}
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.sm,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: pressed ? c.raised : c.surface,
            opacity: days.length === 0 ? 0.45 : 1,
          })}
        >
          <Icon name="calendar" size={18} color={c.muted} />
          <T bold>{text}</T>
        </Pressable>
        <IconButton
          icon="chevron-right"
          label="Next day"
          disabled={next === null}
          onPress={() => next !== null && onAnchor(anchorForDay(next))}
        />
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Choose a day">
        <View style={{ gap: space.xs }}>
          {newestFirst.map((d) => {
            const selected = d === current;
            const n = counts.get(d) ?? 0;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel(d)}, ${n} readings`}
                accessibilityState={{ selected }}
                onPress={() => {
                  onAnchor(anchorForDay(d));
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingHorizontal: space.md,
                  borderRadius: radius.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? c.accent : c.border,
                  backgroundColor: pressed ? c.raised : "transparent",
                })}
              >
                <View style={{ flex: 1 }}>
                  <T bold>{dayLabel(d)}</T>
                </View>
                <T small muted>
                  {n} readings
                </T>
                <View style={{ width: 20 }}>
                  {selected ? (
                    <Icon name="check" size={20} color={c.accent} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
