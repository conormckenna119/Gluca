import React, { useState } from "react";
import { View } from "react-native";
import { Button, Input, row, space } from "../../ui";
import type { Reading } from "../../types";

export function DayPicker({
  period,
  onPeriod,
  onAnchor,
}: {
  period: "day" | "week";
  onPeriod: (p: "day" | "week") => void;
  data: Reading[];
  anchor: number;
  onAnchor: (ms: number | null) => void;
}) {
  const [day, setDay] = useState("");
  return (
    <View style={{ gap: space.sm }}>
      <View style={row}>
        <Button
          label="Day"
          selected={period === "day"}
          onPress={() => onPeriod("day")}
        />
        <Button
          label="7 days"
          selected={period === "week"}
          onPress={() => onPeriod("week")}
        />
      </View>
      <Input
        label="Day ending at midnight (YYYY-MM-DD, optional)"
        value={day}
        onChange={(v) => {
          setDay(v);
          const ms = v ? Date.parse(`${v}T12:00:00`) : NaN;
          onAnchor(Number.isFinite(ms) ? ms : null);
        }}
      />
    </View>
  );
}
