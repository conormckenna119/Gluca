import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect } from "expo-router";
import {
  EmptyState,
  Eyebrow,
  Section,
  T,
  radius,
  space,
  useColors,
} from "../ui";
import { Page } from "../components/page";
import { Medal } from "../components/achievements/medal";
import { MedalSheet } from "../components/achievements/medal-sheet";
import { ChallengeList } from "../components/achievements/challenge-list";
import { useAchievements } from "../hooks/use-achievements";
import { getDef } from "../achievements/registry";
import type { AchievementCategory, Award } from "../domain/achievements";

const GROUPS: { key: AchievementCategory; title: string }[] = [
  { key: "health", title: "Health" },
  { key: "life", title: "Life" },
  { key: "community", title: "Community" },
];

export function Trophies() {
  const c = useColors();
  const a = useAchievements();
  const [open, setOpen] = useState<Award | null>(null);
  const earnedIds = useMemo(
    () => new Set(a.awards.map((x) => x.achievementId)),
    [a.awards],
  );
  if (!a.enabled) return <Redirect href="/create" />;
  const toEarn = a.defs.filter(
    (d) => d.category !== "health" && !earnedIds.has(d.id),
  );
  const sorted = [...a.awards].sort((x, y) => y.awardedAt - x.awardedAt);
  return (
    <Page
      title="Medals"
      subtitle="Small marks for things you chose to do. There is no score, and nothing here is ever taken away."
    >
      {sorted.length ? (
        GROUPS.map((g) => {
          const items = sorted.filter(
            (x) => getDef(x.achievementId)?.category === g.key,
          );
          if (!items.length) return null;
          return (
            <View key={g.key} style={{ gap: space.md }}>
              <Eyebrow>{g.title}</Eyebrow>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.md,
                }}
              >
                {items.map((x) => {
                  const d = getDef(x.achievementId)!;
                  const label = `${d.name} medal, earned ${new Date(x.awardedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}${x.pinned ? ", pinned to profile" : ""}`;
                  return (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      onPress={() => setOpen(x)}
                      style={({ pressed }) => ({
                        width: 104,
                        minHeight: 44,
                        alignItems: "center",
                        gap: space.xs,
                        padding: space.sm,
                        borderRadius: radius.md,
                        backgroundColor: pressed ? c.raised : "transparent",
                      })}
                    >
                      <Medal
                        icon={d.icon}
                        category={d.category}
                        name={d.name}
                        earnedAt={x.awardedAt}
                        size={72}
                        decorative
                      />
                      <T small bold align="center">
                        {d.name}
                      </T>
                      {x.pinned ? (
                        <T small muted align="center">
                          Pinned
                        </T>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })
      ) : (
        <EmptyState
          icon="medal"
          title="No medals yet"
          body="Medals appear on their own as you make graphics, take part and join in. There is no rush."
        />
      )}
      {toEarn.length ? (
        <Section
          title="Ways to earn"
          note="Whenever it suits you. Nothing is counted or timed."
        >
          <View style={{ gap: space.md }}>
            {toEarn.map((d) => (
              <View
                key={d.id}
                accessible
                accessibilityLabel={`${d.name}, not earned yet. ${d.description}`}
                style={{
                  flexDirection: "row",
                  gap: space.md,
                  alignItems: "center",
                  padding: space.md,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: c.border,
                }}
              >
                <Medal
                  icon={d.icon}
                  category={d.category}
                  name={d.name}
                  locked
                  size={48}
                  decorative
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <T bold>{d.name}</T>
                  <T small muted>
                    {d.description}
                  </T>
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
      <Section
        title="Challenges"
        note="Mark one as done when you have done it, in your own way."
      >
        <ChallengeList />
      </Section>
      <MedalSheet award={open} onClose={() => setOpen(null)} />
    </Page>
  );
}
