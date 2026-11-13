import React from "react";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useColors } from "../ui";
/** Close a line path down to the baseline so it can take a soft gradient fill. Gaps stay gaps: each segment is closed separately. */
function areaPath(d: string) {
  const pts = d.trim().split(/[ML]/).map((x) => x.trim()).filter(Boolean);
  if (!pts.length) return "";
  const x0 = pts[0].split(",")[0];
  const x1 = pts[pts.length - 1].split(",")[0];
  return `M${pts.join(" L")} L${x1},300 L${x0},300 Z`;
}
export function GlucoseChart({ paths, valid, high, low }: { paths: string[]; valid: boolean; high: string; low: string }) {
  const c = useColors();
  return (
    <Svg width="100%" height={240} viewBox="0 0 900 300">
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.line} stopOpacity={0.28} />
          <Stop offset="1" stopColor={c.line} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={300 - (((valid ? Number(high) : 180) - 20) / 580) * 300}
        width={900}
        height={
          ((valid ? Number(high) - Number(low) : 110) / 580) * 300
        }
        rx={8}
        fill={c.inRange}
        opacity={0.14}
      />
      {paths.map((d, i) => (
        <React.Fragment key={i}>
          <Path
            d={areaPath(d)}
            fill="url(#fade)"
          />
          <Path
            d={d}
            fill="none"
            stroke={c.line}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </React.Fragment>
      ))}
    </Svg>
  );
}
