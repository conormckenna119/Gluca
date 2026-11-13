import React from "react";
import { View, ScrollView } from "react-native";
import { Eyebrow, Pill, T, row, useColors } from "../ui";
import { useDemo } from "../store";
import { BRAND } from "../art/brand";
export function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  const { ready, storageError, state } = useDemo();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 50,
        gap: 20,
        width: "100%",
        maxWidth: 900,
        alignSelf: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 8 }}>
        <Eyebrow>{BRAND.name}</Eyebrow>
        <T large>{title}</T>
        <View style={row}>
          <Pill>Local demo</Pill>
          <Pill>Fictional community</Pill>
          <Pill tone={state.imported.length ? "accent" : "neutral"}>
            {state.imported.length ? "Imported CSV glucose" : "Synthetic glucose"}
          </Pill>
        </View>
      </View>
      {storageError ? <T>{storageError}</T> : null}
      {ready ? children : <T>Loading your local demo…</T>}
    </ScrollView>
  );
}
