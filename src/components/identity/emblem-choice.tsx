import React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { EMBLEMS, type Emblem } from "../../domain/profile";
import {
  EMBLEM_NONE_LABEL,
  EMBLEM_NOTE,
  EMBLEM_TABLE,
} from "../../domain/emblems";
import { T, radius, space, useColors } from "../../ui";
import { EmblemBadge } from "./emblem";

function Check({ color, ink }: { color: string; ink: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={10} fill={color} />
      <Path
        d="M5.8 10.4 L8.7 13.2 L14.2 7.2"
        fill="none"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Choice({
  selected,
  label,
  line,
  a11y,
  stacked,
  onPress,
  children,
}: {
  selected: boolean;
  label: string;
  line?: string;
  a11y: string;
  stacked: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={a11y}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: stacked ? undefined : 1,
        minHeight: 44,
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accent : c.border,
        backgroundColor: selected ? c.raised : c.surface,
        padding: space.md,
        opacity: pressed ? 0.85 : 1,
        flexDirection: stacked ? "row" : "column",
        alignItems: "center",
        gap: space.sm,
      })}
    >
      {children ? (
        <View
          style={{
            width: 56,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </View>
      ) : null}
      <View
        style={{
          gap: 2,
          flex: stacked ? 1 : undefined,
          alignItems: stacked ? "flex-start" : "center",
        }}
      >
        <T bold align={stacked ? "left" : "center"}>
          {label}
        </T>
        {line ? (
          <T small muted align={stacked ? "left" : "center"}>
            {line}
          </T>
        ) : null}
      </View>
      {selected ? (
        <View
          style={
            stacked
              ? undefined
              : { position: "absolute", top: space.sm, right: space.sm }
          }
        >
          <Check color={c.accent} ink={c.accentInk} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Pick one emblem or none. Self-chosen: it shares no data and connects nobody. */
export function EmblemChoice({
  value,
  onChange,
}: {
  value: Emblem | undefined;
  onChange: (next: Emblem | undefined) => void;
}) {
  const { width } = useWindowDimensions();
  const stacked = width < 360;
  return (
    <View style={{ gap: space.sm }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Emblem"
        style={{
          flexDirection: stacked ? "column" : "row",
          gap: space.sm,
          alignItems: "stretch",
        }}
      >
        {EMBLEMS.map((e) => (
          <Choice
            key={e}
            selected={value === e}
            label={EMBLEM_TABLE[e].label}
            line={EMBLEM_TABLE[e].line}
            a11y={`${EMBLEM_TABLE[e].label}. ${EMBLEM_TABLE[e].line}`}
            stacked={stacked}
            onPress={() => onChange(e)}
          >
            <EmblemBadge emblem={e} size={56} />
          </Choice>
        ))}
      </View>
      <Choice
        selected={value === undefined}
        label={EMBLEM_NONE_LABEL}
        a11y={EMBLEM_NONE_LABEL}
        stacked
        onPress={() => onChange(undefined)}
      >
        {null}
      </Choice>
      <T small muted>
        {EMBLEM_NOTE}
      </T>
    </View>
  );
}
