import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Emblem } from "../../domain/profile";
import { useColors } from "../../ui";

export const EMBLEM_LABEL: Record<Emblem, string> = {
  supporter: "Supporter",
  caregiver: "Caregiver",
  advocate: "Advocate",
};

export const EMBLEM_MEANING: Record<Emblem, string> = {
  supporter: "The person says they support someone who lives with diabetes.",
  caregiver: "The person says they care for someone who lives with diabetes.",
  advocate: "The person says they speak up for people who live with diabetes.",
};

// Three different outlines: a heart, a figure held in cupped arms, and a flag on a pole.
const SHAPES: Record<
  Emblem,
  { d: string; extra?: { cx: number; cy: number; r: number } }
> = {
  supporter: {
    d: "M12 19.5 C6.5 15.5 4.5 12.5 4.5 9.6 A3.9 3.9 0 0 1 12 8 A3.9 3.9 0 0 1 19.5 9.6 C19.5 12.5 17.5 15.5 12 19.5 Z",
  },
  caregiver: {
    d: "M4.5 12 C4.5 16.5 8 19.5 12 19.5 C16 19.5 19.5 16.5 19.5 12",
    extra: { cx: 12, cy: 8.2, r: 2.6 },
  },
  advocate: { d: "M7 20 V4.5 M7 5.5 H18 L15 9 L18 12.5 H7" },
};

/** Small original icon for a self-reported community role. Different shapes, so it never relies on colour. */
export function EmblemBadge({
  emblem,
  size = 28,
}: {
  emblem: Emblem;
  size?: number;
}) {
  const c = useColors();
  const s = SHAPES[emblem];
  const glyph = Math.round(size * 0.68);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={EMBLEM_LABEL[emblem]}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.raised,
        borderWidth: 1.5,
        borderColor: c.accent,
      }}
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
        <Path
          d={s.d}
          fill="none"
          stroke={c.text}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {s.extra ? (
          <Circle
            cx={s.extra.cx}
            cy={s.extra.cy}
            r={s.extra.r}
            fill="none"
            stroke={c.text}
            strokeWidth={2}
          />
        ) : null}
      </Svg>
    </View>
  );
}
