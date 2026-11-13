import React from "react";
import { Tabs } from "expo-router";
import { View, type ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Mark, useColors } from "../../src/ui";

// Original line icons (24 px grid). Each tab keeps its text label, so icons are never the only cue.
const ICONS: Record<string, (p: { color: string; filled: boolean }) => React.ReactElement> = {
  index: ({ color, filled }) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill={filled ? color : "none"} />
    </Svg>
  ),
  glucose: ({ color, filled }) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 14h3l2.5-7 4 12 2.5-8 1.5 3H21" />
      {filled ? <Circle cx={21} cy={14} r={1.6} fill={color} /> : null}
    </Svg>
  ),
  explore: ({ color, filled }) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="m15.5 8.5-2 5-5 2 2-5z" fill={filled ? color : "none"} />
    </Svg>
  ),
  profile: ({ color, filled }) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8.5} r={3.6} fill={filled ? color : "none"} />
      <Path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
    </Svg>
  ),
};

export default function Layout() {
  const c = useColors();
  const icon = (name: string) => ({ color, focused }: { color: ColorValue; focused: boolean }) => ICONS[name]({ color: String(color), filled: focused });
  return (
    <Tabs
      screenOptions={{
        headerTitle: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Mark size={20} />
          </View>
        ),
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTintColor: c.text,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, minHeight: 72, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: "600", marginBottom: 4 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("index"), tabBarAccessibilityLabel: "Home" }} />
      <Tabs.Screen name="glucose" options={{ title: "My Glucose", tabBarIcon: icon("glucose") }} />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", marginTop: -14, borderWidth: 3, borderColor: c.surface, opacity: focused ? 1 : 0.92 }}>
              <Svg width={22} height={22} viewBox="0 0 24 24" stroke={c.accentInk} strokeWidth={2.6} strokeLinecap="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: icon("explore") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
