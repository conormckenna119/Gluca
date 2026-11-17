import React from "react";
import { View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { shieldLabel, tierById, type ShieldTierId } from "../../domain/shield";

// Existing identity colours, never glucose grades. Size and outline are identical for every style.
const TIER_COLORS: Record<
  ShieldTierId,
  { fill: string; edge: string; ink: string }
> = {
  teal: { fill: "#3FB8B0", edge: "#0F5F5A", ink: "#08201F" },
  silver: { fill: "#B2BCC6", edge: "#4F5963", ink: "#14181A" },
  bronze: { fill: "#C98A52", edge: "#6B3F1A", ink: "#1E1208" },
  gold: { fill: "#E8B93C", edge: "#7A5A0A", ink: "#241A02" },
  amethyst: { fill: "#A98BE0", edge: "#4B2F8A", ink: "#170C33" },
  sapphire: { fill: "#4F86E8", edge: "#183C86", ink: "#04122E" },
  emerald: { fill: "#3DBE8A", edge: "#136042", ink: "#04201A" },
  platinum: { fill: "#EEF2F6", edge: "#55606C", ink: "#14181A" },
  diamond: { fill: "#BFEAF5", edge: "#2F7C92", ink: "#06202A" },
  legacy: { fill: "#2A2A31", edge: "#E8B93C", ink: "#F0C650" },
};

const BODY = "M24 2 L44 9 V28 C44 42 35 51 24 54 C13 51 4 42 4 28 V9 Z";
/** A quiet, numeric identity marker. Precision belongs in its accessible label/detail sheet. */
export function Shield({
  tier,
  years,
  showNumber = true,
  size = 44,
  certain = true,
  label,
}: {
  tier: ShieldTierId | string;
  years?: number;
  showNumber?: boolean;
  size?: number;
  certain?: boolean;
  label?: string;
}) {
  const t = tierById(tier) ?? tierById("teal")!,
    col = TIER_COLORS[t.id];
  const number =
    showNumber && years !== undefined && Number.isInteger(years) && years >= 0;
  const text = number ? String(years) : "";
  const fontSize = text.length >= 3 ? 20 : text.length === 2 ? 24 : 28;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? shieldLabel(t, years, certain, number)}
      style={{ width: size, height: (size * 56) / 48, flexShrink: 0 }}
    >
      <Svg width={size} height={(size * 56) / 48} viewBox="0 0 48 56">
        <Path
          d={BODY}
          fill={col.fill}
          stroke={col.edge}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        {number ? (
          <SvgText
            x={24}
            y={25 + fontSize * 0.36}
            fontSize={fontSize}
            fontWeight="700"
            fontFamily="sans-serif"
            fill={col.ink}
            textAnchor="middle"
          >
            {text}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
