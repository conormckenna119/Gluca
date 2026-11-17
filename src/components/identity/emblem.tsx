import React from "react";
import { View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
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

// One family, three silhouettes and three hues: a round badge (blue), a house-shaped badge (violet)
// and a speech-bubble badge (amber). Fills are mid-tones with dark ink glyphs, so they hold up on
// both the dark and the light theme. Shape, not colour, tells them apart.
const LOOK: Record<Emblem, { fill: string; edge: string; ink: string }> = {
  supporter: { fill: "#6FA4F2", edge: "#1F4C9A", ink: "#071A3D" },
  caregiver: { fill: "#B596EC", edge: "#4F2D96", ink: "#1E0F44" },
  advocate: { fill: "#F2AC4A", edge: "#7C4A06", ink: "#2B1702" },
};

const SILHOUETTE: Record<Emblem, string> = {
  supporter: "M12 1.8 A10.2 10.2 0 0 1 12 22.2 A10.2 10.2 0 0 1 12 1.8 Z",
  caregiver:
    "M12 1.6 L21.8 9.2 V19 A3 3 0 0 1 18.8 22 H5.2 A3 3 0 0 1 2.2 19 V9.2 Z",
  advocate:
    "M12 1.8 C17.6 1.8 22 6 22 11 C22 16 17.6 20.2 12 20.2 C10.8 20.2 9.7 20 8.7 19.7 L4 22.2 L5.3 17.7 C3.3 16 2 13.7 2 11 C2 6 6.4 1.8 12 1.8 Z",
};

const HEART =
  "M12 18 C7.8 15 5.8 12.8 5.8 10.4 A3 3 0 0 1 12 9.4 A3 3 0 0 1 18.2 10.4 C18.2 12.8 16.2 15 12 18 Z";

function Glyph({
  emblem,
  detail,
  ink,
}: {
  emblem: Emblem;
  detail: boolean;
  ink: string;
}) {
  if (emblem === "supporter") {
    return (
      <G transform="translate(12 12.2) scale(1.05) translate(-12 -13.7)">
        <Path d={HEART} fill={ink} />
      </G>
    );
  }
  if (emblem === "caregiver") {
    // A heart sheltered under a roof line. The roof line is dropped at small sizes: the badge is already a house.
    return (
      <G>
        {detail ? (
          <Path
            d="M7 11.4 L12 7 L17 11.4"
            fill="none"
            stroke={ink}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <G
          transform={
            detail
              ? "translate(12 16.2) scale(0.72) translate(-12 -13.7)"
              : "translate(12 14.6) scale(0.95) translate(-12 -13.7)"
          }
        >
          <Path d={HEART} fill={ink} />
        </G>
      </G>
    );
  }
  // advocate: a megaphone, with a handle and sound lines when there is room
  return (
    <G
      transform={
        detail ? undefined : "translate(12 11) scale(1.2) translate(-12 -11)"
      }
    >
      <Path
        d="M6.4 9.2 H9.6 L15.6 6 V16 L9.6 12.8 H6.4 Q5.4 12.8 5.4 11.8 V10.2 Q5.4 9.2 6.4 9.2 Z"
        fill={ink}
      />
      {detail ? (
        <>
          <Path
            d="M9.2 13.2 L10.1 16.6"
            fill="none"
            stroke={ink}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Path
            d="M17.9 8.4 L19.2 7.6 M18.1 11 H19.8 M17.9 13.6 L19.2 14.4"
            fill="none"
            stroke={ink}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </G>
  );
}

/**
 * Small original badge for a self-chosen community role. Distinct silhouette and hue per emblem,
 * and a simpler glyph under 24 px. "plain" drops the rim for tight places.
 */
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
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={SILHOUETTE[emblem]}
          fill={look.fill}
          stroke={variant === "plain" ? "none" : look.edge}
          strokeWidth={size < 24 ? 1.8 : 1.4}
          strokeLinejoin="round"
        />
        <Glyph emblem={emblem} detail={size >= 24} ink={look.ink} />
      </Svg>
    </View>
  );
}
