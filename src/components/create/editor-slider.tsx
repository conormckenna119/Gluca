import React, { useState, useRef } from "react";
import { PanResponder, View } from "react-native";
import { T, useColors } from "../../ui";
export interface EditorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}
export function EditorSlider({
  label,
  value,
  min,
  max,
  onChange,
}: EditorSliderProps) {
  const c = useColors(),
    [width, setWidth] = useState(1);
  const update = (x: number) =>
    onChange(
      Math.round(Math.max(min, Math.min(max, min + (x / width) * (max - min)))),
    );
  const latest = useRef(update);
  latest.current = update;
  const origin = useRef(0);
  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          origin.current = e.nativeEvent.locationX;
          latest.current(origin.current);
        },
        onPanResponderMove: (_e, g) => latest.current(origin.current + g.dx),
      }),
    [],
  );
  return (
    <View>
      <T small>
        {label} · {Math.round(value)}%
      </T>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: Math.round(value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) =>
          onChange(
            Math.max(
              min,
              Math.min(
                max,
                value + (e.nativeEvent.actionName === "increment" ? 1 : -1),
              ),
            ),
          )
        }
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 44, justifyContent: "center" }}
        {...responder.panHandlers}
      >
        <View style={{ height: 4, backgroundColor: c.border }} />
        <View
          style={{
            position: "absolute",
            left: `${((value - min) / (max - min)) * 100}%`,
            marginLeft: -10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: c.accent,
          }}
        />
      </View>
    </View>
  );
}
