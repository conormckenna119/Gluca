/** Application chrome only. Story artwork has its own intentionally unchanged palette. */
export const palette = {
  dark: {
    bg: "#101413",
    surface: "#1B2320",
    raised: "#242B27",
    text: "#F5F8F6",
    muted: "#A7B5AC",
    border: "#37443C",
    accent: "#91E6B2",
    accentInk: "#0C1410",
    focus: "#76B8FF",
    below: "#FFBD82",
    inRange: "#91E6B2",
    above: "#C5B3FF",
    line: "#91E6B2",
  },
  light: {
    bg: "#F3F6F4",
    surface: "#FFFFFF",
    raised: "#EAF0EC",
    text: "#132119",
    muted: "#4A5E53",
    border: "#D5E0D9",
    accent: "#1F7A4A",
    accentInk: "#FFFFFF",
    focus: "#1D5FB5",
    below: "#9A5311",
    inRange: "#1F7A4A",
    above: "#5B47B0",
    line: "#1F7A4A",
  },
} as const;
export type Colors = (typeof palette)["dark"] | (typeof palette)["light"];
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const typography = {
  family: {
    web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    ios: "System",
    android: "sans-serif",
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  heading: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0 },
  caption: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "400",
    letterSpacing: 0,
  },
  metric: {
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  label: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  button: { fontSize: 15, lineHeight: 21, fontWeight: "600", letterSpacing: 0 },
} as const;
export const layout = {
  contentWidth: 720,
  pageInset: 16,
  cardInset: 16,
  touchTarget: 44,
  buttonHeight: 48,
  headerHeight: 44,
  navHeight: 64,
  navMaxWidth: 560,
  navInset: 12,
  navGap: 8,
} as const;
export const borders = { hairline: 0.5, control: 1 } as const;
export const shadows = {
  navigation: {
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
} as const;
export const avatarTints = [
  "#91E6B2",
  "#76B8FF",
  "#C5B3FF",
  "#FFBD82",
  "#F2A5C6",
  "#9BE3E0",
] as const;
export const LOGO_VIEWBOX = "0 0 36 50";
