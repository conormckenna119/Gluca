import React from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Button, Eyebrow, Mark, Pill, T, row, space, useColors } from "../ui";
import { useDemo } from "../store";
import { BRAND } from "../art/brand";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";
import { track } from "../telemetry";

export function Welcome() {
  const c = useColors();
  const { set } = useDemo();
  const go = (href: "/create?template=milestone" | "/create" | "/import?from=welcome") => {
    set((s) => ({ ...s, seenWelcome: true }));
    router.replace(href);
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: 20, paddingTop: 48, paddingBottom: 50, gap: space.xl, width: "100%", maxWidth: 560, alignSelf: "center",
      }}
    >
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Mark size={28} />
          <Eyebrow>{BRAND.name}</Eyebrow>
        </View>
        <T large>{BRAND.tagline}</T>
        <T muted>
          Turn a day of glucose data, or a milestone, into a graphic you choose to share. No account needed.
        </T>
        <View style={row}>
          <Pill>Local demo</Pill>
          <Pill>Fictional community</Pill>
        </View>
      </View>
      <View style={{ gap: space.md }}>
        <Button kind="primary" label="Try demo data" onPress={() => {
            track("demo_started");
            go("/create");
          }}
        />
        {linkVisible("import", getFlags()) ? (
          <Button label="Import Dexcom Clarity CSV" onPress={() => go("/import?from=welcome")} />
        ) : null}
        <Button label="Make a milestone graphic (no data)" onPress={() => go("/create?template=milestone")} />
      </View>
      <T small muted>
        Your file is read on this device. Nothing is uploaded, and the file name is not kept.
      </T>
    </ScrollView>
  );
}
