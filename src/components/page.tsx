import React from "react";
import { View, ScrollView } from "react-native";
import { Pill, T, row, space, layout, useColors } from "../ui";
import { useDemo } from "../store";
import { getFlags } from "../flags";

/** Screen frame: brand eyebrow, title, optional subtitle, the demo labels, then the content in one centred column. */
export function Page({
  title,
  subtitle,
  children,
  glucoseLabel,
  accountCommunity = false,
  scrollRef,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  glucoseLabel?: string;
  accountCommunity?: boolean;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
}) {
  const c = useColors();
  const { ready, storageError, state, privacyNotice } = useDemo();
  const flags = getFlags();
  // The community label is only true while fictional people or clubs can appear somewhere in the app.
  const community = flags.communityFeed || flags.clubs;
  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: layout.pageInset,
        paddingBottom: space.xl,
        gap: space.xl,
        width: "100%",
        maxWidth: layout.contentWidth,
        alignSelf: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: space.sm }}>
        <T large>{title}</T>
        {subtitle ? <T muted>{subtitle}</T> : null}
        <View style={row}>
          {accountCommunity ? (
            <Pill>Account communities</Pill>
          ) : (
            <>
              <Pill>Local demo</Pill>
              {community ? <Pill>Fictional community</Pill> : null}
              <Pill tone={state.imported.length ? "accent" : "neutral"}>
                {glucoseLabel ??
                  (state.imported.length
                    ? "Imported CSV glucose"
                    : "Synthetic glucose")}
              </Pill>
            </>
          )}
        </View>
      </View>
      {storageError ? <T>{storageError}</T> : null}
      {privacyNotice ? <T small>{privacyNotice}</T> : null}
      {ready ? children : <T muted>Loading your local demo…</T>}
    </ScrollView>
  );
}
