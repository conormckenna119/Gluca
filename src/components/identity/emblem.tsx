import React from "react";
import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import type { Emblem } from "../../domain/profile";
import { EMBLEM_TABLE } from "../../domain/emblems";
export const EMBLEM_LABEL: Record<Emblem, string> = {
  supporter: EMBLEM_TABLE.supporter.label,
  caregiver: EMBLEM_TABLE.caregiver.label,
  advocate: EMBLEM_TABLE.advocate.label,
};
export const EMBLEM_MEANING: Record<Emblem, string> = {
  supporter: EMBLEM_TABLE.supporter.description,
  caregiver: EMBLEM_TABLE.caregiver.description,
  advocate: EMBLEM_TABLE.advocate.description,
};
// One rounded-square frame and stroke language; distinct symbols, with no hierarchy.
const LOOK: Record<Emblem, { fill: string; edge: string; ink: string }> = {
  supporter: { fill: "#6FA4F2", edge: "#1F4C9A", ink: "#071A3D" },
  caregiver: { fill: "#B596EC", edge: "#4F2D96", ink: "#1E0F44" },
  advocate: { fill: "#F2AC4A", edge: "#7C4A06", ink: "#2B1702" },
};

function Glyph({ emblem, ink }: { emblem: Emblem; ink: string }) {
  return (
    <G
      fill="none"
      stroke={ink}
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {emblem === "supporter" ? (
        <Path d="M12 17.5 C10.2 16.1 6.2 13.5 6.2 10.1 C6.2 6.7 10.1 6.2 12 9 C13.9 6.2 17.8 6.7 17.8 10.1 C17.8 13.5 13.8 16.1 12 17.5 Z" />
      ) : emblem === "caregiver" ? (
        <>
          <Path d="M12.5 11.8 C11.2 10.8 8.7 9 8.7 7.3 C8.7 5.4 11.2 5 12.5 6.7 C13.8 5 16.3 5.4 16.3 7.3 C16.3 9 13.8 10.8 12.5 11.8 Z" />
          <Path d="M5.5 15.6 L8.3 12.9 H11.4 C13.2 12.9 13.2 15 11.6 15 H10 M12 15 L16.3 12.9 C18.1 12.1 19 14 17.5 15.1 L12.9 18.4 H8.2 L6.5 19 M4.8 14.8 L7.7 18.5" />
        </>
      ) : (
        <Path d="M8.3 18.5 L14.8 8.8 C17 5.2 10.1 4.1 9.2 7.9 C8.8 10.1 11.2 13.2 15.8 18.5 L18 16.7 L11.6 8.2 C10.8 7 10.4 6.8 10.1 7" />
      )}
    </G>
  );
}
export function EmblemBadge({
  emblem,
  size = 28,
  variant = "badge",
}: {
  emblem: Emblem;
  size?: number;
  variant?: "badge" | "plain";
}) {
  const look = LOOK[emblem];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={EMBLEM_TABLE[emblem].a11y}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect
          x={1.5}
          y={1.5}
          width={21}
          height={21}
          rx={6}
          fill={look.fill}
          stroke={variant === "plain" ? "none" : look.edge}
          strokeWidth={1.1}
        />
        <Glyph emblem={emblem} ink={look.ink} />
      </Svg>
    </View>
  );
}
