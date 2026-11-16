import React from "react";
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useDemo } from "./store";
import { BRAND } from "./art/brand";
import { DROP_PATH, NEAR_BLACK, PEAK_PATH, PEAK_STROKE } from "./art/svg";

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
  children, large = false, heading = false, muted = false, small = false, bold = false, align,
}: {
  children: React.ReactNode; large?: boolean; heading?: boolean; muted?: boolean; small?: boolean; bold?: boolean;
  align?: "left" | "center";
}) {
  const c = useColors();
  return (
    <Text
      accessibilityRole={large || heading ? "header" : undefined}
      style={{
        color: muted ? c.muted : c.text,
        fontSize: large ? 30 : heading ? 20 : small ? 13.5 : 16,
        fontWeight: large ? "800" : heading || bold ? "700" : "400",
        lineHeight: large ? 36 : heading ? 26 : small ? 19 : 24,
        letterSpacing: large ? -0.6 : heading ? -0.3 : 0,
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
    <View aria-hidden style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
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
  label, value, onChange, multiline = false, placeholder, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; maxLength?: number;
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
        placeholder={placeholder}
        maxLength={maxLength}
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

// ---- Icons: 24 px stroke icons drawn here so no icon package is needed. ----
const ICONS = {
  heart: "M12 20.5 C5 15.5 3 12 3 8.8 A4.6 4.6 0 0 1 12 7 A4.6 4.6 0 0 1 21 8.8 C21 12 19 15.5 12 20.5 Z",
  comment: "M4 5.5 H20 V16.5 H11 L6.5 20 V16.5 H4 Z",
  bookmark: "M6.5 4 H17.5 V20.5 L12 16.5 L6.5 20.5 Z",
  check: "M5 12.5 L10 17.5 L19 7",
  close: "M6 6 L18 18 M18 6 L6 18",
  plus: "M12 5 V19 M5 12 H19",
  "chevron-left": "M14.5 5.5 L8 12 L14.5 18.5",
  "chevron-right": "M9.5 5.5 L16 12 L9.5 18.5",
  "chevron-down": "M5.5 9.5 L12 16 L18.5 9.5",
  calendar: "M4.5 6.5 H19.5 V19.5 H4.5 Z M4.5 10.5 H19.5 M8.5 4 V8 M15.5 4 V8",
  image: "M4 5.5 H20 V18.5 H4 Z M4 15.5 L9 11 L13 14.5 L16 12 L20 15.5 M15.5 9 H15.6",
  upload: "M12 15.5 V4.5 M7.5 9 L12 4.5 L16.5 9 M5 15 V19.5 H19 V15",
  settings: "M4 7.5 H13 M17 7.5 H20 M4 16.5 H7 M11 16.5 H20 M15 5 V10 M9 14 V19",
  trash: "M5 7 H19 M9.5 7 V4.5 H14.5 V7 M7 7 L8 19.5 H16 L17 7",
  info: "M12 11 V17 M12 7.5 H12.1 M12 3.5 A8.5 8.5 0 1 0 12 20.5 A8.5 8.5 0 1 0 12 3.5 Z",
  alert: "M12 4 L21 19.5 H3 Z M12 10 V14.5 M12 17 H12.1",
  share: "M12 14.5 V3.5 M8 7.5 L12 3.5 L16 7.5 M6 11 V20 H18 V11",
  file: "M7 3.5 H14 L18 7.5 V20.5 H7 Z M14 3.5 V7.5 H18",
  bolt: "M13 2.5 L5 13.5 H11 L10 21.5 L19 9.5 H13 Z",
  "chevron-up": "M5.5 14.5 L12 8 L18.5 14.5",
  medal: "M8.5 3 L12 9 L15.5 3 M12 9 A6 6 0 1 0 12 21 A6 6 0 1 0 12 9 Z M9.5 15.2 L11.3 17 L14.6 13.4",
  shield: "M12 3 L19.5 6 V11.5 C19.5 16 16.5 19.5 12 21 C7.5 19.5 4.5 16 4.5 11.5 V6 Z",
  lock: "M6.5 10.5 H17.5 V20 H6.5 Z M8.5 10.5 V7.5 A3.5 3.5 0 0 1 15.5 7.5 V10.5",
  link: "M10 14 L14 10 M8.5 11.5 L6.5 13.5 A3.2 3.2 0 0 0 11 18 L13 16 M15.5 12.5 L17.5 10.5 A3.2 3.2 0 0 0 13 6 L11 8",
  refresh: "M19 12 A7 7 0 1 1 16.5 6.6 M19 4 V8 H15",
  people: "M9 11 A3 3 0 1 0 9 5 A3 3 0 1 0 9 11 Z M3.5 19 C4 16 6 14.5 9 14.5 C12 14.5 14 16 14.5 19 M16 11 A2.6 2.6 0 1 0 15.5 5.9 M17 14.6 C19 15 20.2 16.6 20.5 19",
  user: "M12 12 A4 4 0 1 0 12 4 A4 4 0 1 0 12 12 Z M4.5 20 C5.5 16.5 8.5 15 12 15 C15.5 15 18.5 16.5 19.5 20",
} as const;
export type IconName = keyof typeof ICONS;

/** Decorative icon. Always pair it with text or an accessibility label on the parent. */
export function Icon({ name, size = 22, color, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  const c = useColors();
  const ink = color ?? c.text;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={ICONS[name]} fill={filled ? ink : "none"} stroke={ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** Icon-only (or icon plus count) button. `label` is what a screen reader says; state is shown by a filled icon, not colour alone. */
export function IconButton({
  icon, label, onPress, selected = false, count, disabled = false,
}: {
  icon: IconName; label: string; onPress: () => void; selected?: boolean; count?: number; disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        minWidth: 44, minHeight: 44, paddingHorizontal: space.sm, flexDirection: "row", gap: 6,
        alignItems: "center", justifyContent: "center", borderRadius: radius.pill,
        backgroundColor: pressed ? c.raised : "transparent", opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon name={icon} filled={selected} color={selected ? c.accent : c.muted} />
      {count !== undefined ? <Text style={{ color: selected ? c.text : c.muted, fontSize: 14, fontWeight: "700" }}>{count}</Text> : null}
    </Pressable>
  );
}

/** Toggle chip for choices and filters. Selected shows a check mark as well as the fill. */
export function Chip({
  label, selected = false, onPress, disabled = false, accessibilityLabel,
}: {
  label: string; selected?: boolean; onPress: () => void; disabled?: boolean; accessibilityLabel?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44, paddingHorizontal: space.md + 2, flexDirection: "row", gap: 6, alignItems: "center",
        borderRadius: radius.pill, borderWidth: 1, borderColor: selected ? c.accent : c.border,
        backgroundColor: selected ? c.accent : c.surface, opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      {selected ? <Icon name="check" size={16} color={c.accentInk} /> : null}
      <Text style={{ color: selected ? c.accentInk : c.text, fontWeight: "600", fontSize: 14.5 }}>{label}</Text>
    </Pressable>
  );
}

/** Titled group of content: eyebrow, optional note, then children. */
export function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Eyebrow>{title}</Eyebrow>
        {note ? <T small muted>{note}</T> : null}
      </View>
      {children}
    </View>
  );
}

/** Bordered container for ListRow / SwitchRow children; draws hairlines between them. */
export function Group({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const items = React.Children.toArray(children);
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.surface, overflow: "hidden" }}>
      {items.map((child, i) => (
        <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>{child}</View>
      ))}
    </View>
  );
}

/** One row in a Group. With `onPress` it is a button and shows a chevron; `destructive` adds a trash icon and bold text (no red). */
export function ListRow({
  title, detail, value, icon, onPress, destructive = false, accessibilityLabel,
}: {
  title: string; detail?: string; value?: string; icon?: IconName; onPress?: () => void; destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const body = (
    <>
      {destructive || icon ? <Icon name={destructive ? "trash" : icon!} color={c.muted} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: destructive ? "700" : "600" }}>{title}</Text>
        {detail ? <Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 19 }}>{detail}</Text> : null}
      </View>
      {value ? <Text style={{ color: c.muted, fontSize: 15, fontWeight: "600" }}>{value}</Text> : null}
      {onPress ? <Icon name="chevron-right" size={18} color={c.muted} /> : null}
    </>
  );
  const box = { minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: "row", alignItems: "center", gap: space.md } as const;
  if (!onPress) return <View style={box}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => ({ ...box, backgroundColor: pressed ? c.raised : "transparent" })}
    >
      {body}
    </Pressable>
  );
}

/** A row in a Group with an on/off switch. */
export function SwitchRow({ title, detail, value, onChange }: { title: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <View style={{ minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: "row", alignItems: "center", gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{title}</Text>
        {detail ? <Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 19 }}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.border, true: c.accent }}
        thumbColor={c.text}
      />
    </View>
  );
}

/** Inline message. Tone is carried by the icon and the bold lead word, never by red or green. */
export function Notice({ tone = "info", title, children }: { tone?: "info" | "success" | "error"; title?: string; children?: React.ReactNode }) {
  const c = useColors();
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row", gap: space.md, padding: space.md + 2, borderRadius: radius.md, borderWidth: 1,
        borderColor: tone === "info" ? c.border : c.text, backgroundColor: c.raised,
      }}
    >
      <Icon name={tone === "success" ? "check" : tone === "error" ? "alert" : "info"} color={c.text} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <T bold>{title}</T> : null}
        {typeof children === "string" ? <T small>{children}</T> : children}
      </View>
    </View>
  );
}

/** Centred placeholder for a screen or list with nothing to show. */
export function EmptyState({ icon = "info", title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.raised, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} color={c.muted} size={26} />
      </View>
      <T heading align="center">{title}</T>
      {body ? <T muted align="center">{body}</T> : null}
      {action}
    </View>
  );
}

/** Numbered progress for a short flow, e.g. Import. The current step is named in words. */
export function Steps({ labels, current }: { labels: string[]; current: number }) {
  const c = useColors();
  return (
    <View accessible accessibilityLabel={`Step ${current + 1} of ${labels.length}: ${labels[current]}`} style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {labels.map((l, i) => (
          <View key={l} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= current ? c.accent : c.border }} />
        ))}
      </View>
      <T small muted bold>
        Step {current + 1} of {labels.length} · {labels[current]}
      </T>
    </View>
  );
}

/** Bottom sheet built on Modal, so it works on iOS, Android and web without a native dependency. */
export function Sheet({
  visible, onClose, title, children, footer,
}: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel={`Close ${title}`} accessibilityRole="button" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, opacity: 0.72 }} />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "86%", width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderBottomWidth: 0, borderColor: c.border,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: space.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: space.xl - 4, paddingRight: space.sm, paddingTop: space.xs }}>
            <View style={{ flex: 1 }}>
              <T heading>{title}</T>
            </View>
            <IconButton icon="close" label={`Close ${title}`} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.xl - 4, paddingTop: space.sm, gap: space.lg }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: c.border, gap: space.sm }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/** Confirmation for destructive actions. Says what will happen in `body`; the confirm button repeats the action in words. */
export function ConfirmSheet({
  visible, title, body, confirmLabel, onConfirm, onCancel,
}: {
  visible: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button kind="primary" label={confirmLabel} onPress={onConfirm} />
          <Button label="Cancel" onPress={onCancel} />
        </>
      }
    >
      <T>{body}</T>
    </Sheet>
  );
}

/** The Gluca drop mark. Set `name` in src/art/brand.ts if the product is renamed. */
export function Mark({ size = 22, color }: { size?: number; color?: string }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel={BRAND.name}>
      <Path d={DROP_PATH} fill={color ?? c.accent} />
      <Path d={PEAK_PATH} fill="none" stroke={color ? NEAR_BLACK : c.accentInk} strokeWidth={PEAK_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
