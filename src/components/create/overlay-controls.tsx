import React from "react";
import { View } from "react-native";
import { Button, Card, T, row } from "../../ui";
import {
  DEFAULT_OVERLAY,
  MIN_SCALE,
  MAX_SCALE,
  moveOverlay,
  normalizeOverlay,
  type OverlayTransform,
} from "../../overlay-transform";
import { EditorSlider } from "./editor-slider";
export function OverlayControls({
  value,
  selected,
  onSelect,
  onChange,
}: {
  value: OverlayTransform;
  selected: boolean;
  onSelect: () => void;
  onChange: (t: OverlayTransform) => void;
}) {
  return (
    <Card>
      <T bold>Overlay layout</T>
      <T small muted>
        Drag to move. Pinch or use the corner handles to resize. Edges outside
        the canvas are cropped.
      </T>
      <View style={row}>
        <Button
          label={selected ? "Done positioning" : "Edit overlay"}
          selected={selected}
          onPress={onSelect}
        />
        <Button
          label="Reset layout"
          onPress={() => onChange({ ...DEFAULT_OVERLAY })}
        />
      </View>
      <EditorSlider
        label="Overlay size"
        value={value.scale * 100}
        min={MIN_SCALE * 100}
        max={MAX_SCALE * 100}
        onChange={(v) =>
          onChange(normalizeOverlay({ ...value, scale: v / 100 }))
        }
      />
      <EditorSlider
        label="Overlay opacity"
        value={value.opacity * 100}
        min={20}
        max={100}
        onChange={(v) =>
          onChange(normalizeOverlay({ ...value, opacity: v / 100 }))
        }
      />
      <View style={row}>
        {(
          [
            ["Move left", -0.02, 0],
            ["Move right", 0.02, 0],
            ["Move up", 0, -0.02],
            ["Move down", 0, 0.02],
          ] as const
        ).map(([label, x, y]) => (
          <Button
            key={label}
            label={label}
            onPress={() => onChange(moveOverlay(value, x, y))}
          />
        ))}
      </View>
      <T small muted>
        Layout stays in place when you change the photo, style or date. Use a
        smaller size to keep more text inside the canvas.
      </T>
    </Card>
  );
}
