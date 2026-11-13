import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DemoStore, useDemo } from "../src/store";
import { useColors } from "../src/ui";
import { BRAND } from "../src/art/brand";

const queryClient = new QueryClient();

function Nav() {
  const c = useColors();
  const { state } = useDemo();
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
        <Stack.Screen name="post/[id]" options={{ title: "Conversation" }} />
        <Stack.Screen name="settings" options={{ title: "Settings & privacy" }} />
        <Stack.Screen name="import" options={{ title: "Import & export" }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <DemoStore>
        <Nav />
      </DemoStore>
    </QueryClientProvider>
  );
}
