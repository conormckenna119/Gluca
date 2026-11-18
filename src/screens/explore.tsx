import React from "react";
import { router } from "expo-router";
import {
  Pressable,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AuthorIdentity } from "../components/identity/user-identity";
import {
  COMMUNITIES,
  joinCommunity,
  leaveCommunity,
  setCommunityVisible,
  suggestedFor,
} from "../domain/communities";
import { localToday } from "../domain/shield";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  Section,
  T,
  radius,
  space,
  useColors,
} from "../ui";
import { useDemo, people, clubNames } from "../store";
import { Page } from "../components/page";
import { Guard } from "../components/guard";
import { getFlags, isEnabled } from "../flags";

const personLines = [
  "Fictional person. Shares walks and quiet wins.",
  "Fictional person. Likes early-morning routes.",
  "Fictional person. Posts calm weekly summaries.",
];
const clubLines: Record<string, string> = {
  "Type 1 Runners": "Fictional club for easy runs and shared routes.",
  "Diabetic Golfers": "Fictional club for slow rounds and good company.",
  "Newly Diagnosed Community":
    "Fictional club for first-weeks questions and kindness.",
  "Diabetes Tech Enthusiasts": "Fictional club for swapping gadget stories.",
  "T1D Strength Training": "Fictional club for lifting and gentle progress.",
};

export function Explore() {
  return (
    <Guard route="/explore">
      <ExploreBody />
    </Guard>
  );
}

/** Follow / Join toggle. State is in words and a check mark, not colour alone. */
function Toggle({
  on,
  offLabel,
  onLabel,
  a11yOff,
  a11yOn,
  onPress,
}: {
  on: boolean;
  offLabel: string;
  onLabel: string;
  a11yOff: string;
  a11yOn: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? a11yOn : a11yOff}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 104,
        paddingHorizontal: space.lg,
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: on ? c.accent : c.border,
        backgroundColor: on ? c.accent : c.raised,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {on ? <Icon name="check" size={16} color={c.accentInk} /> : null}
      <Text
        style={{
          color: on ? c.accentInk : c.text,
          fontWeight: "700",
          fontSize: 14.5,
        }}
      >
        {on ? onLabel : offLabel}
      </Text>
    </Pressable>
  );
}

/** Club visibility switch. Off by default; the label names the club. */
function VisibleSwitch({
  club,
  value,
  onChange,
}: {
  club: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
      }}
    >
      <Switch
        accessibilityLabel={`Visible on profile: ${club}`}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.border, true: c.accent }}
        thumbColor={c.text}
      />
      <T small muted>
        {value ? "Visible on profile" : "Private: visible only to you"}
      </T>
    </View>
  );
}

function Entry({
  name,
  line,
  toggle,
  nameNode,
  extra,
}: {
  name: string;
  line: string;
  toggle: React.ReactNode;
  nameNode?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <Card>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
      >
        {!nameNode ? <Avatar name={name} size={48} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          {nameNode ?? <T bold>{name}</T>}
          <T small muted>
            {line}
          </T>
        </View>
      </View>
      <View style={{ alignItems: "flex-start" }}>{toggle}</View>
      {extra}
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  const wide = useWindowDimensions().width >= 900;
  const items = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg }}>
      {items.map((ch, i) => (
        <View key={i} style={{ width: wide ? "48.5%" : "100%" }}>
          {ch}
        </View>
      ))}
    </View>
  );
}

function ExploreBody() {
  const flags = getFlags();
  const { state, set } = useDemo();
  const visiblePeople = flags.communityFeed
    ? people.filter((p) => !state.blocked.includes(p))
    : [];
  const identity = isEnabled("identity");
  const clubList = identity
    ? COMMUNITIES.map((c) => ({ name: c.name, line: c.blurb }))
    : clubNames.map((n) => ({
        name: n,
        line: clubLines[n] ?? "Fictional demo club.",
      }));
  const visibleClubs = flags.clubs ? clubList : [];
  const suggestions =
    identity && flags.clubs
      ? suggestedFor(state.profile, localToday(), state.clubs)
      : [];
  const joinedToggle = (n: string, joined: boolean) =>
    identity
      ? set((s) => (joined ? leaveCommunity(s, n) : joinCommunity(s, n)))
      : toggleIn("clubs", n);
  const toggleIn = (key: "following" | "clubs", n: string) =>
    set((s) => ({
      ...s,
      [key]: s[key].includes(n)
        ? s[key].filter((x: string) => x !== n)
        : [...s[key], n],
    }));

  return (
    <Page title="Explore" subtitle="Discover people and communities.">
      {flags.communityChallenges ? (
        <Card>
          <T heading>Challenges</T>
          <T small muted>
            Optional community experiences. No glucose targets or streaks.
          </T>
          <Button
            label="Explore Challenges"
            onPress={() => router.push("/challenges")}
          />
        </Card>
      ) : null}
      {suggestions.length ? (
        <Section
          title="Suggested for you"
          note="Based only on what you chose to put in your profile. Nothing is joined until you tap Join."
        >
          <Grid>
            {suggestions.map(({ community, reason }) => (
              <Entry
                key={community.id}
                name={community.name}
                line={`${reason}. ${community.blurb}`}
                toggle={
                  <Toggle
                    on={false}
                    offLabel="Join"
                    onLabel="Joined"
                    a11yOff={`Join ${community.name}`}
                    a11yOn={`Leave ${community.name}`}
                    onPress={() => joinedToggle(community.name, false)}
                  />
                }
              />
            ))}
          </Grid>
        </Section>
      ) : null}
      {visibleClubs.length ? (
        <Section
          title="Clubs"
          note="Fictional demo clubs. Be kind, respect privacy, and avoid treatment advice."
        >
          <Grid>
            {visibleClubs.map(({ name: n, line }) => {
              const joined = state.clubs.includes(n);
              return (
                <Entry
                  key={n}
                  name={n}
                  line={line}
                  extra={
                    identity && joined ? (
                      <VisibleSwitch
                        club={n}
                        value={state.clubVisibility[n] === true}
                        onChange={(v) =>
                          set((s) => setCommunityVisible(s, n, v))
                        }
                      />
                    ) : null
                  }
                  toggle={
                    <Toggle
                      on={joined}
                      offLabel="Join"
                      onLabel="Joined"
                      a11yOff={`Join ${n}`}
                      a11yOn={`Leave ${n}`}
                      onPress={() => joinedToggle(n, joined)}
                    />
                  }
                />
              );
            })}
          </Grid>
        </Section>
      ) : null}
      {visiblePeople.length ? (
        <Section title="People" note="Fictional profiles for this demo.">
          <Grid>
            {visiblePeople.map((p) => (
              <Entry
                key={p}
                name={p}
                nameNode={identity ? <AuthorIdentity name={p} /> : undefined}
                line={personLines[people.indexOf(p) % personLines.length]}
                toggle={
                  <Toggle
                    on={state.following.includes(p)}
                    offLabel="Follow"
                    onLabel="Following"
                    a11yOff={`Follow ${p}`}
                    a11yOn={`Unfollow ${p}`}
                    onPress={() => toggleIn("following", p)}
                  />
                }
              />
            ))}
          </Grid>
        </Section>
      ) : null}
      {!visibleClubs.length && !visiblePeople.length ? (
        <EmptyState
          icon="user"
          title="Nobody to show yet"
          body="People and clubs will appear here when they are available. Blocked people stay hidden."
        />
      ) : null}
    </Page>
  );
}
