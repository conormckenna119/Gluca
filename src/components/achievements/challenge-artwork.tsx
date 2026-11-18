import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useColors, radius } from "../../ui";
import { GLYPHS } from "./medal";
import type { MedalIcon } from "../../domain/achievements";
/** Original Gluca glyphs in an illustration tile; this is not an earned medal. */
export function ChallengeArtwork({ icon }: { icon: MedalIcon }) {
  const c = useColors();
  return (
    <View
      aria-hidden
      accessible={false}
      style={{
        width: 68,
        height: 68,
        borderRadius: radius.md,
        backgroundColor: c.raised,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Svg width={66} height={66} viewBox="0 0 66 66">
        <Circle
          cx={33}
          cy={33}
          r={26}
          stroke={c.border}
          fill="none"
          strokeWidth={1}
        />
        <G transform="translate(15 15) scale(1.5)">
          <Path
            d={GLYPHS[icon]}
            fill="none"
            stroke={c.accent}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      </Svg>
    </View>
  );
}
