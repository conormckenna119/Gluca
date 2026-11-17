import React from "react";
import { View, ScrollView } from "react-native";
import { Eyebrow, Pill, T, row, space, useColors } from "../ui";
import { useDemo } from "../store";
import { BRAND } from "../art/brand";
import { getFlags } from "../flags";

/** Screen frame: brand eyebrow, title, optional subtitle, the demo labels, then the content in one centred column. */
export function Page({
  title,
  subtitle,
  children,
  glucoseLabel,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  glucoseLabel?: string;
}) {
  const c = useColors();
  const { ready, storageError, state } = useDemo();
  const flags = getFlags();
  // The community label is only true while fictional people or clubs can appear somewhere in the app.
  const community = flags.communityFeed || flags.clubs;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 56,
        gap: space.xl,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: space.sm }}>
        <Eyebrow>{BRAND.name}</Eyebrow>
        <T large>{title}</T>
        {subtitle ? <T muted>{subtitle}</T> : null}
        <View style={row}>
          <Pill>Local demo</Pill>
          {community ? <Pill>Fictional community</Pill> : null}
          <Pill tone={state.imported.length ? "accent" : "neutral"}>
            {glucoseLabel ??
              (state.imported.length
                ? "Imported CSV glucose"
                : "Synthetic glucose")}
          </Pill>
        </View>
      </View>
      {storageError ? <T>{storageError}</T> : null}
      {ready ? children : <T muted>Loading your local demo…</T>}
    </ScrollView>
  );
}
