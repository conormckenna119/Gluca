import React, { useRef } from "react";
import { useColors } from "../../ui";
import {
  moveOverlay,
  overlayBounds,
  scaleOverlay,
  type OverlayTransform,
} from "../../overlay-transform";

export interface OverlayInteractionProps {
  width: number;
  height: number;
  value: OverlayTransform;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: OverlayTransform) => void;
}
/** Editing chrome is a sibling of the capture surface, never a child of it. */
export function OverlayInteraction({
  width,
  height,
  value,
  selected,
  onSelect,
  onChange,
}: OverlayInteractionProps) {
  const c = useColors();
  const moved = useRef(false);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({ value, x: 0, y: 0, distance: 0, resize: false });
  const latest = useRef(value);
  latest.current = value;
  const distance = () => {
    const [a, b] = [...points.current.values()];
    return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const centroid = () => {
    const all = [...points.current.values()];
    return {
      x: all.reduce((s, p) => s + p.x, 0) / all.length,
      y: all.reduce((s, p) => s + p.y, 0) / all.length,
    };
  };
  const rebase = (resize = false) => {
    const p = centroid();
    start.current = {
      value: latest.current,
      x: p.x,
      y: p.y,
      distance: distance(),
      resize,
    };
  };
  const stop = (e: React.PointerEvent<HTMLDivElement>) => {
    points.current.delete(e.pointerId);
    if (points.current.size) rebase();
  };
  const b = overlayBounds(value, width, height);
  const inset = (v: number, max: number) =>
    Math.max(0, Math.min(max - 44, v - 22));
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        selected
          ? "Move glucose overlay. Arrow keys move; Shift moves faster."
          : "Select glucose overlay"
      }
      aria-pressed={selected}
      style={{
        position: "absolute",
        left: 8,
        top: 8,
        width,
        height,
        zIndex: 3,
        overflow: "hidden",
        touchAction: selected ? "none" : "pan-y",
        cursor: selected ? "move" : "pointer",
        outlineOffset: 2,
      }}
      onClick={() => {
        if (!moved.current) onSelect();
        moved.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) {
          e.preventDefault();
          onSelect();
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
          return;
        }
        if (!selected) return;
        const step = e.shiftKey ? 0.02 : 0.005;
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        if (delta[e.key]) {
          e.preventDefault();
          onChange(moveOverlay(value, ...delta[e.key]));
        }
      }}
      onPointerDown={(e) => {
        if (!selected) return;
        if (!points.current.size) moved.current = false;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        rebase((e.target as HTMLElement).dataset.resize === "true");
      }}
      onPointerMove={(e) => {
        if (!selected || !points.current.has(e.pointerId)) return;
        points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const s = start.current,
          p = centroid(),
          d = distance();
        if (points.current.size > 1 || Math.hypot(p.x - s.x, p.y - s.y) > 5)
          moved.current = true;
        if (points.current.size > 1 && s.distance > 0)
          onChange(scaleOverlay(s.value, d / s.distance));
        else if (s.resize) {
          const center = e.currentTarget.getBoundingClientRect();
          const radius = Math.hypot(
            s.x - center.left - s.value.x * width,
            s.y - center.top - s.value.y * height,
          );
          onChange(
            scaleOverlay(
              s.value,
              Math.hypot(
                e.clientX - center.left - s.value.x * width,
                e.clientY - center.top - s.value.y * height,
              ) / Math.max(1, radius),
            ),
          );
        } else
          onChange(
            moveOverlay(s.value, (p.x - s.x) / width, (p.y - s.y) / height),
          );
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      {selected && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              pointerEvents: "none",
              left: b.left,
              top: b.top,
              width: b.width,
              height: b.height,
              boxSizing: "border-box",
              border: `2px dashed ${c.accent}`,
            }}
          />
          {[
            [b.left, b.top],
            [b.left + b.width, b.top],
            [b.left, b.top + b.height],
            [b.left + b.width, b.top + b.height],
          ].map(([x, y], i) => (
            <div
              key={i}
              data-resize="true"
              aria-hidden
              style={{
                position: "absolute",
                left: inset(x, width),
                top: inset(y, height),
                width: 44,
                height: 44,
                cursor: i === 0 || i === 3 ? "nwse-resize" : "nesw-resize",
                display: "grid",
                placeItems: "center",
              }}
            >
              <span
                data-resize="true"
                style={{
                  width: 12,
                  height: 12,
                  background: c.text,
                  border: `2px solid ${c.accent}`,
                  borderRadius: 3,
                }}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
