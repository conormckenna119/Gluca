import React, { useEffect } from "react";
import { View } from "react-native";
import { Stack, router, usePathname, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DemoStore, useDemo } from "../src/store";
import { useColors } from "../src/ui";
import { BRAND } from "../src/art/brand";
import { configureFlags } from "../src/flags";
import { configureTelemetry, track } from "../src/telemetry";
import { useArtFonts } from "../src/fonts";

// Literal env access: Expo inlines these at bundle time. Telemetry stays "off" unless EXPO_PUBLIC_TELEMETRY=local.
configureFlags(process.env.EXPO_PUBLIC_FLAGS);
configureTelemetry(process.env.EXPO_PUBLIC_TELEMETRY);

const queryClient = new QueryClient();

function Nav() {
  const c = useColors();
  const { state, ready } = useDemo();
  const pathname = usePathname();
  const fontsDone = useArtFonts();
  const navReady = !!useRootNavigationState()?.key;
  // First run: once saved state has loaded, a person who has not seen the welcome screen is sent there.
  const needsWelcome = ready && !state.seenWelcome && pathname !== "/welcome";
  useEffect(() => {
    if (navReady && needsWelcome) router.replace("/welcome");
  }, [navReady, needsWelcome]);
  // Cover the tabs until the saved state is known and any redirect has happened, so they never flash.
  const covered = !ready || needsWelcome;
  // Hold the screens back until Inter has loaded or failed, so the first artwork preview is built with the right fonts.
  if (!fontsDone) {
    return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  }
  return (
    <>
      <StatusBar style={state.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerTitle: BRAND.name,
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ title: "Conversation" }} />
        <Stack.Screen name="settings" options={{ title: "Settings & privacy" }} />
        <Stack.Screen name="import" options={{ title: "Import & export" }} />
      </Stack>
      {covered ? (
        <View
          pointerEvents="auto"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg }}
        />
      ) : null}
    </>
  );
}

export default function Layout() {
  useEffect(() => track("app_opened"), []);
  return (
    <QueryClientProvider client={queryClient}>
      <DemoStore>
        <Nav />
      </DemoStore>
    </QueryClientProvider>
  );
}
