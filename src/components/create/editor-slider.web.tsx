import React from "react";
import { useColors } from "../../ui";
export interface EditorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}
export function EditorSlider({
  label,
  value,
  min,
  max,
  onChange,
}: EditorSliderProps) {
  const c = useColors();
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        color: c.text,
        fontSize: 14,
        fontFamily: "system-ui, sans-serif",
        gap: 4,
      }}
    >
      {label} · {Math.round(value)}%
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        style={{ width: "100%", height: 44, margin: 0, accentColor: c.accent }}
      />
    </label>
  );
}
