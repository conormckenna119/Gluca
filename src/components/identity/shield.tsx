import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import {
  shieldLabel,
  tierById,
  type ShieldGlyph,
  type ShieldTierId,
} from "../../domain/shield";

// Identity colours. These say nothing about glucose and avoid pure red and pure green.
// Each tier also has its own inner glyph, so colour is never the only signal.
const TIER_COLORS: Record<
  ShieldTierId,
  { fill: string; edge: string; ink: string }
> = {
  teal: { fill: "#3FB8B0", edge: "#0F5F5A", ink: "#08201F" },
  silver: { fill: "#C3CBD3", edge: "#59636D", ink: "#14181A" },
  bronze: { fill: "#C98A52", edge: "#6B3F1A", ink: "#1E1208" },
  gold: { fill: "#E8B93C", edge: "#7A5A0A", ink: "#241A02" },
  amethyst: { fill: "#A98BE0", edge: "#4B2F8A", ink: "#170C33" },
  sapphire: { fill: "#4F86E8", edge: "#183C86", ink: "#04122E" },
  emerald: { fill: "#3DBE8A", edge: "#136042", ink: "#04201A" },
  platinum: { fill: "#E4E9EE", edge: "#6A7581", ink: "#14181A" },
  diamond: { fill: "#BFEAF5", edge: "#2F7C92", ink: "#06202A" },
  legacy: { fill: "#1B1B1F", edge: "#E8B93C", ink: "#E8B93C" },
};

const BODY = "M24 2 L44 9 V28 C44 42 35 51 24 54 C13 51 4 42 4 28 V9 Z";
const INNER =
  "M24 6 L40 11.6 V28 C40 39.5 32.8 47.4 24 50.2 C15.2 47.4 8 39.5 8 28 V11.6 Z";

function Glyph({
  id,
  x,
  y,
  r,
  color,
}: {
  id: ShieldGlyph;
  x: number;
  y: number;
  r: number;
  color: string;
}) {
  const p = (pts: [number, number][]) =>
    pts
      .map(
        ([a, b], i) =>
          `${i ? "L" : "M"}${(x + a * r).toFixed(2)} ${(y + b * r).toFixed(2)}`,
      )
      .join(" ") + " Z";
  switch (id) {
    case "dot":
      return <Circle cx={x} cy={y} r={r * 0.55} fill={color} />;
    case "ring":
      return (
        <Circle
          cx={x}
          cy={y}
          r={r * 0.7}
          fill="none"
          stroke={color}
          strokeWidth={r * 0.35}
        />
      );
    case "bar":
      return (
        <Rect
          x={x - r}
          y={y - r * 0.3}
          width={r * 2}
          height={r * 0.6}
          rx={r * 0.15}
          fill={color}
        />
      );
    case "chevron":
      return (
        <Path
          d={`M${x - r} ${y + r * 0.5} L${x} ${y - r * 0.5} L${x + r} ${y + r * 0.5}`}
          fill="none"
          stroke={color}
          strokeWidth={r * 0.45}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "diamond":
      return (
        <Path
          d={p([
            [0, -1],
            [0.8, 0],
            [0, 1],
            [-0.8, 0],
          ])}
          fill={color}
        />
      );
    case "triangle":
      return (
        <Path
          d={p([
            [0, -0.95],
            [1, 0.75],
            [-1, 0.75],
          ])}
          fill={color}
        />
      );
    case "square":
      return (
        <Rect
          x={x - r * 0.75}
          y={y - r * 0.75}
          width={r * 1.5}
          height={r * 1.5}
          fill={color}
        />
      );
    case "spark":
      return (
        <Path
          d={p([
            [0, -1],
            [0.28, -0.28],
            [1, 0],
            [0.28, 0.28],
            [0, 1],
            [-0.28, 0.28],
            [-1, 0],
            [-0.28, -0.28],
          ])}
          fill={color}
        />
      );
    case "hexagon":
      return (
        <Path
          d={p([
            [0.5, -0.87],
            [1, 0],
            [0.5, 0.87],
            [-0.5, 0.87],
            [-1, 0],
            [-0.5, -0.87],
          ])}
          fill="none"
          stroke={color}
          strokeWidth={r * 0.4}
          strokeLinejoin="round"
        />
      );
    case "star":
      return (
        <Path
          d={p([
            [0, -1],
            [0.24, -0.33],
            [0.95, -0.31],
            [0.38, 0.12],
            [0.59, 0.81],
            [0, 0.4],
            [-0.59, 0.81],
            [-0.38, 0.12],
            [-0.95, -0.31],
            [-0.24, -0.33],
          ])}
          fill={color}
        />
      );
  }
}

/** Original shield for time since diagnosis. The number, when shown, sits inside; uncertainty is told in the label and sheet. */
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
  const t = tierById(tier) ?? tierById("teal")!;
  const col = TIER_COLORS[t.id];
  const number = showNumber && years !== undefined;
  const a11y = label ?? shieldLabel(t, years, certain, number);
  const text = String(years ?? "");
  const fontSize = text.length >= 3 ? 12 : text.length === 2 ? 16 : 19;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
      style={{ width: size, height: (size * 56) / 48 }}
    >
      <Svg width={size} height={(size * 56) / 48} viewBox="0 0 48 56">
        <Path
          d={BODY}
          fill={col.fill}
          stroke={col.edge}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path
          d={INNER}
          fill="none"
          stroke={col.edge}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
        <Glyph
          id={t.mark}
          x={24}
          y={number ? 18 : 28}
          r={number ? 5.5 : 9}
          color={col.ink}
        />
        {number ? (
          <SvgText
            x={24}
            y={42}
            fontSize={fontSize}
            fontWeight="800"
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
