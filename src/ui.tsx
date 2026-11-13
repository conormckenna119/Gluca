import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useDemo } from "./store";
import { BRAND } from "./art/brand";

// Design tokens. Below / in / above range are never red or green: they are labelled in words and use
// amber / mint / lavender so colour alone never says "good" or "bad".
export const palette = {
  dark: {
    bg: "#0D110F", surface: "#161D19", raised: "#1F2924", text: "#F4F7F5", muted: "#B4C0B9",
    border: "#33423A", accent: "#91E6B2", accentInk: "#0C1410", focus: "#76B8FF",
    below: "#FFBD82", inRange: "#91E6B2", above: "#C5B3FF", line: "#91E6B2",
  },
  light: {
    bg: "#F4F7F5", surface: "#FFFFFF", raised: "#EAF0EC", text: "#101412", muted: "#47594F",
    border: "#C4D2C9", accent: "#1F7A4A", accentInk: "#FFFFFF", focus: "#1D5FB5",
    below: "#9A5311", inRange: "#1F7A4A", above: "#5B47B0", line: "#1F7A4A",
  },
} as const;
export type Colors = (typeof palette)["dark"] | (typeof palette)["light"];
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export function useColors(): Colors {
  const { state } = useDemo();
  return state.dark ? palette.dark : palette.light;
}

export function T({
  children, large = false, muted = false, small = false, bold = false, align,
}: {
  children: React.ReactNode; large?: boolean; muted?: boolean; small?: boolean; bold?: boolean;
  align?: "left" | "center";
}) {
  const c = useColors();
  return (
    <Text
      style={{
        color: muted ? c.muted : c.text,
        fontSize: large ? 30 : small ? 13.5 : 16,
        fontWeight: large ? "800" : bold ? "700" : "400",
        lineHeight: large ? 36 : small ? 19 : 24,
        letterSpacing: large ? -0.6 : 0,
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}

/** Small spaced-out label above a title or a group. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: "700", letterSpacing: 2.2, textTransform: "uppercase" }}>{children}</Text>;
}

export function Card({ children, tone = "surface" }: { children: React.ReactNode; tone?: "surface" | "raised" }) {
  const c = useColors();
  return (
    <View
      style={{
        padding: space.xl - 4, gap: space.md, borderWidth: 1, borderColor: c.border,
        borderRadius: radius.lg, backgroundColor: tone === "raised" ? c.raised : c.surface,
      }}
    >
      {children}
    </View>
  );
}

/** A single figure with a caption, for glucose summaries. */
export function Stat({ value, label, unit }: { value: string; label: string; unit?: string }) {
  const c = useColors();
  return (
    <View style={{ flexGrow: 1, flexBasis: 90, gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.8 }}>
        {value}
        {unit ? <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}> {unit}</Text> : null}
      </Text>
      <Text style={{ color: c.muted, fontSize: 11.5, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  const c = useColors();
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: tone === "accent" ? c.accent : c.raised }}>
      <Text style={{ color: tone === "accent" ? c.accentInk : c.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 }}>{children}</Text>
    </View>
  );
}

/** Initial in a tinted circle. Colour comes from the name, never from health data. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const tints = ["#91E6B2", "#76B8FF", "#C5B3FF", "#FFBD82", "#F2A5C6", "#9BE3E0"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tint = tints[h % tints.length];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#101412", fontWeight: "800", fontSize: size * 0.4 }}>{(name.match(/[A-Za-z]/)?.[0] ?? "·").toUpperCase()}</Text>
    </View>
  );
}

export function Button({
  label, onPress, selected = false, disabled = false, kind = "secondary",
}: {
  label: string; onPress: () => void; selected?: boolean; disabled?: boolean;
  kind?: "primary" | "secondary" | "ghost";
}) {
  const c = useColors();
  const primary = kind === "primary";
  const filled = primary || selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48, paddingHorizontal: space.lg, paddingVertical: space.md,
        borderRadius: primary ? radius.md : radius.pill, borderWidth: kind === "ghost" ? 0 : 1,
        borderColor: filled ? "transparent" : c.border,
        backgroundColor: filled ? c.accent : kind === "ghost" ? "transparent" : c.raised,
        alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Text style={{ color: filled ? c.accentInk : c.text, fontWeight: primary ? "800" : "600", fontSize: 15.5 }}>{label}</Text>
    </Pressable>
  );
}

export function Input({
  label, value, onChange, multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <T small muted bold>{label}</T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={c.muted}
        style={{
          minHeight: 50, padding: space.md, borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
          color: c.text, backgroundColor: c.surface, fontSize: 16, textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

export const row = { flexDirection: "row", flexWrap: "wrap", gap: 8 } as const;

/** The Gluca drop mark. Set `name` in src/art/brand.ts if the product is renamed. */
export function Mark({ size = 22, color }: { size?: number; color?: string }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel={BRAND.name}>
      <Path d="M18 2 C28 16 34 24 34 32 a16 16 0 0 1 -32 0 C2 24 8 16 18 2 Z" fill={color ?? c.accent} />
    </Svg>
  );
}
