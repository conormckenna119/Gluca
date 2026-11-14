import React, { useState } from "react";
import { View } from "react-native";
import { Input, Notice, space } from "../ui";
import { useDemo } from "../store";
import { parseRange, rangeToText } from "../state";

/** Target low/high, shown in the display unit and stored in mg/dL. Invalid input is never written to state. */
function Inputs() {
  const { state, set } = useDemo();
  const [low, L] = useState(rangeToText(state.range.low, state.unit));
  const [high, H] = useState(rangeToText(state.range.high, state.unit));
  const apply = (l: string, h: string) => {
    const r = parseRange(l, h, state.unit);
    if (r) set((s) => ({ ...s, range: r }));
    return !!r;
  };
  const ok = parseRange(low, high, state.unit) !== null;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        <View style={{ flexGrow: 1, flexBasis: 140 }}>
          <Input
            label={`Target low (${state.unit})`}
            value={low}
            onChange={(v) => {
              L(v);
              apply(v, high);
            }}
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 140 }}>
          <Input
            label={`Target high (${state.unit})`}
            value={high}
            onChange={(v) => {
              H(v);
              apply(low, v);
            }}
          />
        </View>
      </View>
      {!ok ? (
        <Notice tone="error" title="That range can't be used yet">
          {`Still using ${rangeToText(state.range.low, state.unit)}–${rangeToText(state.range.high, state.unit)} ${state.unit}. Low must be below high, within 20–600 mg/dL.`}
        </Notice>
      ) : null}
    </View>
  );
}
// Re-mount when the unit changes so the text boxes show the new unit.
export function RangeInputs() {
  const { state } = useDemo();
  return <Inputs key={state.unit} />;
}
