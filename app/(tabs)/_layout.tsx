import { BrandHeader } from "../../src/components/brand-header";
import React from "react";
import { Tabs } from "expo-router";
import { useColors } from "../../src/ui";
// The root application shell owns the one persistent navigation bar, including stack detail routes.
export default function Layout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerTitle: () => <BrandHeader />,
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTintColor: c.text,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="glucose" options={{ title: "My Glucose" }} />
      <Tabs.Screen name="create" options={{ title: "Create" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
