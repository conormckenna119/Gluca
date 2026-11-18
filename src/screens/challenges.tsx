import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Notice,
  Pill,
  Sheet,
  SwitchRow,
  T,
  space,
} from "../ui";
import { Page } from "../components/page";
import { Medal } from "../components/achievements/medal";
import { ChallengeArtwork } from "../components/achievements/challenge-artwork";
import { CHALLENGES, challengeAvailable } from "../achievements/challenges";
import { getDef } from "../achievements/registry";
import { getFlags } from "../flags";
import { useCommunityChallenges } from "../hooks/use-community-challenges";
import { useAchievements } from "../hooks/use-achievements";
import { onSessionEvent } from "../services/session-events";
const TABS = ["Available", "Joined", "Completed"] as const;
export function CommunityChallenges() {
  const data = useCommunityChallenges(),
    medals = useAchievements(),
    flags = getFlags();
  const [filter, filterSet] = useState<(typeof TABS)[number]>("Available"),
    [selected, selectedSet] = useState<string | null>(null),
    [confirmed, confirmedSet] = useState(false),
    [joined, joinedSet] = useState(false),
    [exchange, exchangeSet] = useState(false),
    [message, messageSet] = useState("");
  const open = (id: string) => {
    selectedSet(id);
    confirmedSet(false);
    joinedSet(false);
    exchangeSet(false);
    messageSet("");
  };
  useEffect(
    () =>
      onSessionEvent((_event, _remote, reason) => {
        if (reason !== "account") return;
        selectedSet(null);
        confirmedSet(false);
        joinedSet(false);
        exchangeSet(false);
        messageSet("");
      }),
    [],
  );
  const c = CHALLENGES.find((x) => x.id === selected),
    p = data.items.find((x) => x.challengeId === selected);
  const canManage = data.status === "ready" && !data.busy;
  const shown = CHALLENGES.filter((c) => {
    const p = data.items.find((p) => p.challengeId === c.id);
    return filter === "Joined"
      ? p?.status === "joined"
      : filter === "Completed"
        ? p?.status === "completed"
        : (!p || p.status === "left") && challengeAvailable(c, Date.now());
  });
  if (!flags.communityChallenges) return <Redirect href="/explore" />;
  return (
    <Page
      title="Challenges"
      glucoseLabel="No glucose data required"
      subtitle="Optional experiences, on your terms. Participation is private."
    >
      {data.status === "guest" ? (
        <Notice>
          Sign in to join challenges and keep completion with your account. No
          Dexcom connection is needed.
        </Notice>
      ) : null}
      {data.status === "checking" ? (
        <T small muted>
          Loading your participation…
        </T>
      ) : null}
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {TABS.map((tab) => (
          <Chip
            key={tab}
            label={tab}
            selected={filter === tab}
            onPress={() => filterSet(tab)}
          />
        ))}
      </View>
      {!shown.length ? (
        <Card>
          <T bold>
            {filter === "Joined"
              ? "No joined challenges"
              : filter === "Completed"
                ? "No completed challenges"
                : "No available challenges"}
          </T>
          <T small muted>
            Join only what interests you. There are no streaks or health
            targets.
          </T>
        </Card>
      ) : null}
      {shown.map((ch) => {
        const part = data.items.find((p) => p.challengeId === ch.id),
          complete = part?.status === "completed";
        return (
          <Card key={ch.id}>
            <View
              style={{
                flexDirection: "row",
                gap: space.lg,
                alignItems: "center",
              }}
            >
              <ChallengeArtwork icon={ch.artwork.icon} />
              <View style={{ flex: 1, gap: space.xs }}>
                <T heading>{ch.title}</T>
                <T small muted>
                  {ch.description}
                </T>
                <Pill>
                  {complete
                    ? "Completed"
                    : part?.status === "joined"
                      ? "Joined · Private"
                      : "Optional"}
                </Pill>
              </View>
            </View>
            <Button label={`View ${ch.title}`} onPress={() => open(ch.id)} />
          </Card>
        );
      })}
      <Button
        label="Reload challenges"
        disabled={data.busy}
        onPress={() => void data.reload()}
      />
      <Button
        label="Back to Community"
        onPress={() => router.navigate("/explore")}
      />
      <Sheet
        visible={!!c}
        onClose={() => selectedSet(null)}
        title={c?.title ?? "Challenge"}
        footer={
          <Button label="Close challenge" onPress={() => selectedSet(null)} />
        }
      >
        {c ? (
          <>
            <View style={{ alignItems: "center", gap: space.sm }}>
              <Medal
                icon={c.artwork.icon}
                category={c.artwork.category}
                name={getDef(c.medalId)?.name ?? c.title}
                earnedAt={
                  medals.awards.find((a) => a.achievementId === c.medalId)
                    ?.awardedAt
                }
                locked={
                  !medals.awards.some((a) => a.achievementId === c.medalId)
                }
                size={84}
              />
              <T small muted>
                Associated medal · {getDef(c.medalId)?.name}
              </T>
            </View>
            <T>{c.description}</T>
            <T small muted>
              {c.howToComplete}
            </T>
            <T small muted>
              Open to people living with diabetes and supporters. No glucose,
              treatment, or exercise targets. Your enrollment and completion are
              private.
            </T>
            {data.error ? <Notice tone="error">{data.error}</Notice> : null}
            {p?.status === "completed" ? (
              <>
                <T
                  bold
                >{`Completed ${new Date(p.completedAt!).toLocaleDateString()}`}</T>
                <Pill>
                  {p.source === "verified_post"
                    ? "Verified public post"
                    : "Self-reported completion"}
                </Pill>
                <T
                  small
                  muted
                >{`Associated medal: ${getDef(c.medalId)?.name ?? "Medal"}. Existing medals are kept; they are not awarded twice.`}</T>
                <Button
                  label="View associated medal"
                  onPress={() => {
                    selectedSet(null);
                    router.push(
                      (p.awardId
                        ? `/trophies?award=${encodeURIComponent(p.awardId)}`
                        : "/trophies") as never,
                    );
                  }}
                />
              </>
            ) : p?.status === "joined" ? (
              <>
                <Pill>Joined · Private</Pill>
                {c.criterion === "public_post" ? (
                  <Button
                    label="Create a moment"
                    onPress={() => {
                      selectedSet(null);
                      router.push("/create?template=milestone");
                    }}
                  />
                ) : (
                  <>
                    {c.criterion === "connection" ? (
                      <>
                        <Notice>
                          Gluca communities are currently demos. Confirm a real
                          exchange in an existing community outside Gluca; demo
                          clicks do not qualify.
                        </Notice>
                        <SwitchRow
                          title="I joined an existing community"
                          value={joined}
                          onChange={joinedSet}
                        />
                        <SwitchRow
                          title="I had a meaningful exchange"
                          value={exchange}
                          onChange={exchangeSet}
                        />
                      </>
                    ) : (
                      <SwitchRow
                        title={
                          c.criterion === "activity"
                            ? "I completed an activity of my choosing"
                            : c.criterion === "awareness"
                              ? "I took part in an awareness activity"
                              : "I marked a personal milestone"
                        }
                        value={confirmed}
                        onChange={confirmedSet}
                      />
                    )}
                    <T small muted>
                      Self-reported. No evidence, personal details or public
                      post are required.
                    </T>
                    <Button
                      kind="primary"
                      label="Confirm completion"
                      disabled={
                        !canManage ||
                        (c.criterion === "connection"
                          ? !(joined && exchange)
                          : !confirmed)
                      }
                      onPress={async () => {
                        const ok = await data.mutate({
                          action: "complete",
                          challengeId: c.id,
                          enrollmentId: p.enrollmentId,
                          confirmed: true,
                          ...(c.criterion === "connection"
                            ? {
                                communityId: "outside_gluca",
                                joinedCommunity: joined,
                                meaningfulInteraction: exchange,
                              }
                            : {}),
                        });
                        if (ok) {
                          selectedSet(null);
                          filterSet("Completed");
                          messageSet(
                            "Challenge completed. Your associated medal is in the Trophy Cabinet.",
                          );
                        }
                      }}
                    />
                    {c.criterion === "activity" && flags.eventLogging ? (
                      <Button
                        label="Use activity Log instead"
                        onPress={() => {
                          selectedSet(null);
                          router.push(
                            `/log?kind=activity&challengeEnrollment=${encodeURIComponent(p.enrollmentId)}` as never,
                          );
                        }}
                      />
                    ) : null}
                  </>
                )}
                <Button
                  label="Leave challenge"
                  disabled={!canManage}
                  onPress={async () => {
                    if (
                      await data.mutate({
                        action: "leave",
                        challengeId: c.id,
                        enrollmentId: p.enrollmentId,
                      })
                    ) {
                      selectedSet(null);
                      messageSet(
                        "You left the challenge. You can join again whenever you choose.",
                      );
                    }
                  }}
                />
              </>
            ) : (
              <Button
                kind="primary"
                label={
                  data.status === "guest" ? "Sign in to join" : "Join challenge"
                }
                disabled={data.busy || data.status === "checking"}
                onPress={async () => {
                  if (data.status === "guest") {
                    selectedSet(null);
                    router.push("/account");
                    return;
                  }
                  if (
                    await data.mutate({ action: "join", challengeId: c.id })
                  ) {
                    filterSet("Joined");
                    messageSet("");
                  }
                }}
              />
            )}
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}
