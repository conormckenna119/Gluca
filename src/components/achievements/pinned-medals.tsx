import React from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Button, space } from "../../ui";
import { Medal } from "./medal";
import { getDef } from "../../achievements/registry";
import type { Award } from "../../domain/achievements";

/** Up to three pinned medals, for a profile header. Pass the awards to show (already filtered by the caller). */
export function PinnedMedals({
  awards,
  size = 56,
}: {
  awards: Award[];
  size?: number;
}) {
  const shown = awards.filter((a) => a.pinned && !a.withdrawn).slice(0, 3);
  if (!shown.length) return null;
  return (
    <View
      accessibilityRole="list"
      style={{ flexDirection: "row", gap: space.md, alignItems: "flex-end" }}
    >
      {shown.map((a) => {
        const d = getDef(a.achievementId);
        if (!d) return null;
        return (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityLabel={`${d.name} medal. Open medals`}
            onPress={() => router.push("/trophies" as never)}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Medal
              icon={d.icon}
              category={d.category}
              name={d.name}
              earnedAt={a.awardedAt}
              size={size}
              decorative
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Button that opens the medal cabinet. */
export function ProfileMedalsLink({ label = "Medals" }: { label?: string }) {
  return (
    <Button label={label} onPress={() => router.push("/trophies" as never)} />
  );
}
