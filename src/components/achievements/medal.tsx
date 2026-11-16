import React, { useId } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Stop,
} from "react-native-svg";
import { useColors } from "../../ui";
import type { AchievementCategory, MedalIcon } from "../../domain/achievements";

// Original medal artwork: a ribbon, a round medal with a rim and an inner disc, and one simple line glyph.
// Colours here are the medal's own metal and ribbon palette (no pure red or green).
const METAL = {
  rim1: "#F6E3A1",
  rim2: "#CFA040",
  rim3: "#8E6722",
  disc1: "#FCF3D6",
  disc2: "#EAD08C",
  ink: "#4F360C",
};
const RIBBON = {
  health: { base: "#4F7FBF", mark: "#BBD3F2" },
  life: { base: "#C9852E", mark: "#F7D9A4" },
  community: { base: "#7C69C4", mark: "#D6CCF6" },
} as const;

// Glyphs drawn on a 24 x 24 grid.
export const GLYPHS: Record<MedalIcon, string> = {
  post: "M4 5.5 H20 V16.5 H11 L6.5 20 V16.5 H4 Z",
  activity: "M3 19 L9 9 L13 15 L16 11 L21 19 Z",
  story:
    "M4 5.5 H20 V18.5 H4 Z M4 15.5 L9 11 L13 14.5 L16 12 L20 15.5 M15.5 9 H15.6",
  anniversary:
    "M4.5 6.5 H19.5 V19.5 H4.5 Z M4.5 10.5 H19.5 M8.5 4 V8 M15.5 4 V8 M12 12.5 L12.9 14.4 L15 14.7 L13.5 16.1 L13.9 18.2 L12 17.2 L10.1 18.2 L10.5 16.1 L9 14.7 L11.1 14.4 Z",
  milestone: "M6 21 V4 M6 5 H18 L15 9 L18 13 H6",
  awareness:
    "M12 4 C7 4 7 11 12 14 C17 11 17 4 12 4 Z M12 14 L8 21 M12 14 L16 21",
  community:
    "M9 11 A3 3 0 1 0 9 5 A3 3 0 1 0 9 11 Z M3.5 19 C4 16 6 14.5 9 14.5 C12 14.5 14 16 14.5 19 M16 11 A2.6 2.6 0 1 0 15.5 5.9 M17 14.6 C19 15 20.2 16.6 20.5 19",
  support:
    "M12 20.5 C5 15.5 3 12 3 8.8 A4.6 4.6 0 0 1 12 7 A4.6 4.6 0 0 1 21 8.8 C21 12 19 15.5 12 20.5 Z",
  pulse: "M3 12 H8 L10 6 L14 18 L16 12 H21",
  balance: "M12 4 V20 M6 20 H18 M5 8 H19 M5 8 L3 14 H7 Z M19 8 L17 14 H21 Z",
  goal: "M12 3.5 A8.5 8.5 0 1 0 12 20.5 A8.5 8.5 0 1 0 12 3.5 Z M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8 Z",
};
const LOCK =
  "M6.5 10.5 H17.5 V20 H6.5 Z M8.5 10.5 V7.5 A3.5 3.5 0 0 1 15.5 7.5 V10.5";
const LEFT = "24,0 47,0 62,52 39,52";
const RIGHT = "53,0 76,0 61,52 38,52";

export const medalLabel = (name: string, earnedAt?: number | null) =>
  earnedAt
    ? `${name} medal, earned ${new Date(earnedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
    : `${name}, not earned yet`;

function Pattern({
  category,
  color,
}: {
  category: AchievementCategory;
  color: string;
}) {
  if (category === "health")
    return (
      <>
        {[8, 18, 28, 38, 48].map((y) => (
          <Line
            key={y}
            x1={10}
            y1={y + 10}
            x2={90}
            y2={y - 6}
            stroke={color}
            strokeWidth={3}
          />
        ))}
      </>
    );
  if (category === "life")
    return (
      <>
        {[6, 16, 26, 36, 46].flatMap((y, r) =>
          [32, 44, 56, 68].map((x) => (
            <Circle
              key={`${x}-${y}`}
              cx={x + (r % 2) * 6}
              cy={y}
              r={2.2}
              fill={color}
            />
          )),
        )}
      </>
    );
  return (
    <>
      <Line x1={50} y1={0} x2={50} y2={52} stroke={color} strokeWidth={3.5} />
      <Line x1={42} y1={0} x2={42} y2={52} stroke={color} strokeWidth={1.5} />
      <Line x1={58} y1={0} x2={58} y2={52} stroke={color} strokeWidth={1.5} />
    </>
  );
}

export function Medal({
  icon,
  category,
  name,
  earnedAt,
  size = 88,
  locked = false,
  decorative = false,
}: {
  icon: MedalIcon;
  category: AchievementCategory;
  name: string;
  /** Time earned. Omit (or set `locked`) for the quiet "not earned yet" outline. */
  earnedAt?: number | null;
  size?: number;
  locked?: boolean;
  /** Set when the parent already carries the accessible label. */
  decorative?: boolean;
}) {
  const c = useColors();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const rib = RIBBON[category];
  const open = locked || !earnedAt;
  const g = (s: string) => `${s}${uid}`;
  const label = medalLabel(name, open ? null : earnedAt);
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      style={{ width: size, height: size * 1.24 }}
    >
      <Svg width={size} height={size * 1.24} viewBox="0 0 100 124">
        <Defs>
          <LinearGradient id={g("rim")} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={METAL.rim1} />
            <Stop offset="0.55" stopColor={METAL.rim2} />
            <Stop offset="1" stopColor={METAL.rim3} />
          </LinearGradient>
          <LinearGradient id={g("disc")} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={METAL.disc1} />
            <Stop offset="1" stopColor={METAL.disc2} />
          </LinearGradient>
          <ClipPath id={g("clip")}>
            <Polygon points={LEFT} />
            <Polygon points={RIGHT} />
          </ClipPath>
        </Defs>
        {open ? (
          <G
            fill="none"
            stroke={c.muted}
            strokeWidth={2}
            strokeLinejoin="round"
            opacity={0.75}
          >
            <Polygon points={LEFT} strokeDasharray="4 4" />
            <Polygon points={RIGHT} strokeDasharray="4 4" />
            <Circle cx={50} cy={78} r={36} strokeDasharray="5 4" />
            <Circle cx={50} cy={78} r={27} />
            <G transform="translate(35 63) scale(1.25)">
              <Path
                d={LOCK}
                stroke={c.muted}
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          </G>
        ) : (
          <>
            <Polygon points={LEFT} fill={rib.base} />
            <Polygon points={RIGHT} fill={rib.base} opacity={0.88} />
            <G clipPath={`url(#${g("clip")})`} opacity={0.85}>
              <Pattern category={category} color={rib.mark} />
            </G>
            <Circle cx={50} cy={80} r={37} fill="#000" opacity={0.18} />
            <Circle cx={50} cy={78} r={37} fill={`url(#${g("rim")})`} />
            <Circle
              cx={50}
              cy={78}
              r={31}
              fill="none"
              stroke={METAL.rim3}
              strokeWidth={1.2}
              opacity={0.5}
            />
            <Circle
              cx={50}
              cy={78}
              r={27}
              fill={`url(#${g("disc")})`}
              stroke={METAL.rim2}
              strokeWidth={1.5}
            />
            <Path
              d="M30 70 A22 22 0 0 1 56 54"
              stroke="#FFFFFF"
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
              opacity={0.55}
            />
            <G transform="translate(35 63) scale(1.25)">
              <Path
                d={GLYPHS[icon]}
                fill="none"
                stroke={METAL.ink}
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          </>
        )}
      </Svg>
    </View>
  );
}
