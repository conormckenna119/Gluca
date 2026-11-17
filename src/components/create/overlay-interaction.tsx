import React, { useRef } from "react";
import { PanResponder, Pressable, View } from "react-native";
import { useColors } from "../../ui";
import {
  moveOverlay,
  scaleOverlay,
  overlayBounds,
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
export function OverlayInteraction({
  width,
  height,
  value,
  selected,
  onSelect,
  onChange,
}: OverlayInteractionProps) {
  const c = useColors(),
    start = useRef({ value, distance: 0, dx: 0, dy: 0 });
  const multi = useRef(false);
  const latest = useRef({ value, selected, onChange, onSelect, width, height });
  latest.current = { value, selected, onChange, onSelect, width, height };
  const distance = (touches: readonly { pageX: number; pageY: number }[]) =>
    touches.length > 1
      ? Math.hypot(
          touches[0].pageX - touches[1].pageX,
          touches[0].pageY - touches[1].pageY,
        )
      : 0;
  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.selected,
        onMoveShouldSetPanResponder: () => latest.current.selected,
        onPanResponderGrant: (e) => {
          multi.current = e.nativeEvent.touches.length > 1;
          start.current = {
            value: latest.current.value,
            distance: distance(e.nativeEvent.touches),
            dx: 0,
            dy: 0,
          };
        },
        onPanResponderMove: (e, g) => {
          const d = distance(e.nativeEvent.touches),
            s = start.current;
          if (d) {
            multi.current = true;
            if (!s.distance) {
              start.current = {
                value: latest.current.value,
                distance: d,
                dx: g.dx,
                dy: g.dy,
              };
              return;
            }
            latest.current.onChange(scaleOverlay(s.value, d / s.distance));
          } else if (s.distance) {
            start.current = {
              value: latest.current.value,
              distance: 0,
              dx: g.dx,
              dy: g.dy,
            };
          } else
            latest.current.onChange(
              moveOverlay(
                s.value,
                (g.dx - s.dx) / latest.current.width,
                (g.dy - s.dy) / latest.current.height,
              ),
            );
        },
        onPanResponderRelease: (_e, g) => {
          if (!multi.current && Math.hypot(g.dx, g.dy) < 5)
            latest.current.onSelect();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  const b = overlayBounds(value, width, height);
  return (
    <View
      style={{
        position: "absolute",
        left: 8,
        top: 8,
        width,
        height,
        zIndex: 3,
        overflow: "hidden",
      }}
      {...responder.panHandlers}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select glucose overlay"
        onPress={onSelect}
        style={{ flex: 1 }}
      >
        {selected ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              width: b.width,
              height: b.height,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: c.accent,
            }}
          />
        ) : null}
      </Pressable>
    </View>
  );
}
