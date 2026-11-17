import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
// Original line icons (24 px grid). Each tab keeps its text label, so icons are never the only cue.
export const ICONS: Record<
  string,
  (p: { color: string; filled: boolean }) => React.ReactElement
> = {
  index: ({ color, filled }) => (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path
        d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"
        fill={filled ? color : "none"}
      />
    </Svg>
  ),
  glucose: ({ color, filled }) => (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 14h3l2.5-7 4 12 2.5-8 1.5 3H21" />
      {filled ? <Circle cx={21} cy={14} r={1.6} fill={color} /> : null}
    </Svg>
  ),
  explore: ({ color, filled }) => (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={9} />
      <Path d="m15.5 8.5-2 5-5 2 2-5z" fill={filled ? color : "none"} />
    </Svg>
  ),
  profile: ({ color, filled }) => (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={8.5} r={3.6} fill={filled ? color : "none"} />
      <Path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
    </Svg>
  ),
};
