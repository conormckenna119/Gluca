import React, { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { IconButton, T, radius, space, useColors } from "../ui";

const ROW = 40;
const ROWS = 3; // visible rows; the centre one is the choice

/**
 * Snapping vertical wheel. Works by scrolling, by the small up and down buttons, and for screen readers as an
 * adjustable control (increment and decrement). `options` are the labels shown; `index` is the chosen one.
 */
export function Wheel({
  label,
  options,
  index,
  onIndexChange,
  width = 84,
}: {
  label: string;
  options: string[];
  index: number;
  onIndexChange: (i: number) => void;
  width?: number;
}) {
  const c = useColors();
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [live, setLive] = useState(index);
  const last = options.length - 1;
  const clamp = (i: number) => Math.max(0, Math.min(last, i));

  // Follow the chosen index when it changes from outside (buttons, accessibility actions, other wheels).
  useEffect(() => {
    setLive(index);
    ref.current?.scrollTo({ y: index * ROW, animated: true });
  }, [index]);
  useEffect(() => {
    const t = setTimeout(
      () => ref.current?.scrollTo({ y: index * ROW, animated: false }),
      0,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ROW));
    setLive(i);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      ref.current?.scrollTo({ y: i * ROW, animated: true });
      if (i !== index) onIndexChange(i);
    }, 140);
  };

  const step = (d: number) => onIndexChange(clamp(index + d));
  return (
    <View style={{ alignItems: "center", width }}>
      <View style={{ transform: [{ rotate: "180deg" }] }}>
        <IconButton
          icon="chevron-down"
          label={`${label}, earlier`}
          disabled={index <= 0}
          onPress={() => step(-1)}
        />
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: options[index] }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) =>
          step(e.nativeEvent.actionName === "increment" ? 1 : -1)
        }
        style={{ height: ROW * ROWS, width, justifyContent: "center" }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: ROW,
            height: ROW,
            borderRadius: radius.md,
            backgroundColor: c.raised,
            borderWidth: 1,
            borderColor: c.border,
          }}
        />
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ paddingVertical: ROW }}
          style={{ height: ROW * ROWS }}
        >
          {options.map((o, i) => (
            <View
              key={i}
              aria-hidden
              style={{
                height: ROW,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: i === live ? c.text : c.muted,
                  fontSize: i === live ? 20 : 16,
                  fontWeight: i === live ? "800" : "500",
                  opacity: i === live ? 1 : 0.7,
                }}
              >
                {o}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <IconButton
        icon="chevron-down"
        label={`${label}, later`}
        disabled={index >= last}
        onPress={() => step(1)}
      />
    </View>
  );
}

/** Two wheels with a colon between them, for a time of day. */
export function WheelLabel({ children }: { children: string }) {
  return (
    <View style={{ paddingHorizontal: space.xs }}>
      <T bold>{children}</T>
    </View>
  );
}
