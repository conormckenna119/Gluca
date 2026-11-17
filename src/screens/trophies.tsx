import React, { useMemo, useState, useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import {
  EmptyState,
  Button,
  Notice,
  SwitchRow,
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
  const params = useLocalSearchParams<{ award?: string }>();
  const handled = useRef("");
  const a = useAchievements();
  const [arranging, setArranging] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [open, setOpen] = useState<Award | null>(null);
  useEffect(() => {
    if (params.award && handled.current !== params.award) {
      const found = a.awards.find((x) => x.id === params.award);
      if (found) {
        handled.current = params.award;
        setOpen(found);
      }
    }
  }, [params.award, a.awards]);
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
      title="Trophy Cabinet"
      subtitle="Life moments and community contributions. Yours to keep private or share."
    >
      {a.status === "guest" ? (
        <Notice tone="info">
          Guest collection � kept in memory for this session. Sign in before
          earning medals to keep them with your account.
        </Notice>
      ) : null}
      {a.status === "checking" ? (
        <T small muted>
          Loading your collection�
        </T>
      ) : null}
      {a.error ? (
        <>
          <Notice tone="info">{a.error}</Notice>
          <Button label="Reload collection" onPress={a.retry} />
        </>
      ) : null}
      {a.status === "account" ? (
        <SwitchRow
          title="Public collection"
          detail="Only medals you choose to show are included. Pinning alone does not share them."
          value={a.collectionPublic}
          onChange={a.setCollectionPublic}
        />
      ) : a.status === "guest" ? (
        <T small muted>
          Sign in to manage public collection visibility.
        </T>
      ) : null}
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
          body="Export a story or confirm a personal milestone to begin your collection."
        />
      )}
      {a.awards.some((x) => x.pinned) ? (
        <Button
          label={arranging ? "Done arranging" : "Arrange pinned medals"}
          onPress={() => setArranging((v) => !v)}
        />
      ) : null}
      {arranging && a.awards.some((x) => x.pinned) ? (
        <Section
          title="Pinned medals"
          note="Up to three, in the order shown on your profile."
        >
          {a.awards
            .filter((x) => x.pinned)
            .map((x, i, pins) => (
              <View key={x.id} style={{ gap: space.xs }}>
                <T bold>{getDef(x.achievementId)?.name}</T>
                <View
                  style={{
                    flexDirection: "row",
                    gap: space.sm,
                    flexWrap: "wrap",
                  }}
                >
                  {i > 0 ? (
                    <Button
                      label={`Move ${getDef(x.achievementId)?.name} earlier`}
                      onPress={() => {
                        const ids = pins.map((p) => p.id);
                        [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                        a.reorder(ids);
                      }}
                    />
                  ) : null}
                  {i < pins.length - 1 ? (
                    <Button
                      label={`Move ${getDef(x.achievementId)?.name} later`}
                      onPress={() => {
                        const ids = pins.map((p) => p.id);
                        [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                        a.reorder(ids);
                      }}
                    />
                  ) : null}
                </View>
              </View>
            ))}
        </Section>
      ) : null}
      <SwitchRow
        title="Show upcoming medals"
        value={showUpcoming}
        onChange={setShowUpcoming}
      />
      {showUpcoming && toEarn.length ? (
        <Section
          title="Ways to earn"
          note="Optional ideas. Participation is not a competition."
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
        title="Personal moments"
        note="Confirm an activity you have completed. No details or evidence are uploaded."
      >
        <ChallengeList />
      </Section>
      <MedalSheet award={open} onClose={() => setOpen(null)} />
    </Page>
  );
}
