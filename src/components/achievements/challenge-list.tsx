import React, { useState } from "react";
import { View } from "react-native";
import { Button, Card, Icon, Sheet, T, space, useColors } from "../../ui";
import { useAchievements } from "../../hooks/use-achievements";
import type { Challenge } from "../../achievements/challenges";

/** Participation challenges. The person marks each one done themself: no proof, no deadlines, no streaks. */
export function ChallengeList() {
  const c = useColors();
  const a = useAchievements();
  const [open, setOpen] = useState<Challenge | null>(null);
  const doneAt = (id: string) =>
    a.completed.find((x) => x.id === id)?.completedAt;
  return (
    <View style={{ gap: space.md }}>
      {a.challenges.map((ch) => {
        const t = doneAt(ch.id);
        return (
          <Card key={ch.id}>
            <View
              style={{
                flexDirection: "row",
                gap: space.sm,
                alignItems: "center",
              }}
            >
              {t ? <Icon name="check" color={c.accent} /> : null}
              <View style={{ flex: 1 }}>
                <T bold>{ch.title}</T>
              </View>
            </View>
            <T small muted>
              {ch.prompt}
            </T>
            {t ? (
              <T
                small
                bold
              >{`Done on ${new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`}</T>
            ) : (
              <Button label="Mark as done" onPress={() => setOpen(ch)} />
            )}
          </Card>
        );
      })}
      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title ?? "Challenge"}
        footer={
          <>
            <Button
              kind="primary"
              label="Mark as done"
              onPress={() => {
                if (open) a.completeChallenge(open.id);
                setOpen(null);
              }}
            />
            <Button label="Not yet" onPress={() => setOpen(null)} />
          </>
        }
      >
        <T>{open?.howToComplete}</T>
        <T small muted>
          It is up to you. Nothing is checked, and there is no deadline.
        </T>
      </Sheet>
    </View>
  );
}
