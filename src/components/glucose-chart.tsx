import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useColors } from "../ui";
import {
  formatGlucose,
  remapPath,
  type TimeTick,
  type YScale,
} from "../chart-scale";

// Paths from segments() are drawn on a 900 x 300 canvas (20-600 mg/dL); remapPath fits them to the plot area.
const SRC = { w: 900, h: 300 };
const HEIGHT = 232;
const M = { left: 38, right: 10, top: 10, bottom: 24 };

/** Close a line path down to the baseline so it can take a soft gradient fill. Gaps stay gaps: each segment is closed separately. */
function areaPath(d: string, base: number) {
  const pts = d
    .trim()
    .split(/[ML]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!pts.length) return "";
  const x0 = pts[0].split(",")[0];
  const x1 = pts[pts.length - 1].split(",")[0];
  return `M${pts.join(" L")} L${x1},${base} L${x0},${base} Z`;
}

export function GlucoseChart({
  paths,
  width,
  scale,
  xTicks,
  start,
  end,
  low,
  high,
  unit,
  label,
}: {
  paths: string[];
  width: number;
  scale: YScale;
  xTicks: TimeTick[];
  start: number;
  end: number;
  low: number;
  high: number;
  unit: string;
  label: string;
}) {
  const c = useColors();
  const plot = {
    x: M.left,
    y: M.top,
    w: Math.max(40, width - M.left - M.right),
    h: HEIGHT - M.top - M.bottom,
  };
  const yOf = (mgdl: number) =>
    plot.y + plot.h - ((mgdl - scale.min) / (scale.max - scale.min)) * plot.h;
  const xOf = (t: number) => plot.x + ((t - start) / (end - start)) * plot.w;
  const base = plot.y + plot.h;
  const bandTop = yOf(high);
  const bandBottom = yOf(low);
  const fitted = paths.map((d) => remapPath(d, SRC, plot, scale));
  return (
    <Svg
      width={width}
      height={HEIGHT}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.line} stopOpacity={0.28} />
          <Stop offset="1" stopColor={c.line} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {scale.ticks.map((t) => (
        <React.Fragment key={t.mgdl}>
          <Line
            x1={plot.x}
            x2={plot.x + plot.w}
            y1={yOf(t.mgdl)}
            y2={yOf(t.mgdl)}
            stroke={c.border}
            strokeWidth={1}
            opacity={0.6}
          />
          <SvgText
            x={plot.x - 6}
            y={yOf(t.mgdl) + 4}
            fontSize={11}
            fontFamily="system-ui, sans-serif"
            fill={c.muted}
            textAnchor="end"
          >
            {t.label}
          </SvgText>
        </React.Fragment>
      ))}
      <Rect
        x={plot.x}
        y={bandTop}
        width={plot.w}
        height={Math.max(0, bandBottom - bandTop)}
        rx={6}
        fill={c.inRange}
        opacity={0.14}
      />
      <Line
        x1={plot.x}
        x2={plot.x + plot.w}
        y1={bandTop}
        y2={bandTop}
        stroke={c.inRange}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <Line
        x1={plot.x}
        x2={plot.x + plot.w}
        y1={bandBottom}
        y2={bandBottom}
        stroke={c.inRange}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <SvgText
        x={plot.x + plot.w - 4}
        y={bandTop - 4}
        fontSize={11}
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fill={c.text}
        textAnchor="end"
      >
        {`Target high ${formatGlucose(high, unit)}`}
      </SvgText>
      <SvgText
        x={plot.x + plot.w - 4}
        y={bandBottom + 13}
        fontSize={11}
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fill={c.text}
        textAnchor="end"
      >
        {`Target low ${formatGlucose(low, unit)}`}
      </SvgText>
      {fitted.map((d, i) => (
        <React.Fragment key={i}>
          <Path d={areaPath(d, base)} fill="url(#fade)" />
          <Path
            d={d}
            fill="none"
            stroke={c.line}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </React.Fragment>
      ))}
      {xTicks.map((t, i) => {
        const x = xOf(t.t);
        const anchor =
          i === 0 && x - plot.x < 18
            ? "start"
            : i === xTicks.length - 1 && plot.x + plot.w - x < 18
              ? "end"
              : "middle";
        return (
          <React.Fragment key={t.t}>
            <Line
              x1={x}
              x2={x}
              y1={base}
              y2={base + 4}
              stroke={c.muted}
              strokeWidth={1}
            />
            <SvgText
              x={x}
              y={HEIGHT - 6}
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fill={c.muted}
              textAnchor={anchor}
            >
              {t.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export const CHART_PLOT = { left: M.left, right: M.right };
