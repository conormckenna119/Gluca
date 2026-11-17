import React, { useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { Card, Section, T, row, space } from "../ui";
import { getFlags } from "../flags";
import { Page } from "../components/page";
import { Shield } from "../components/identity/shield";
import { EmblemBadge } from "../components/identity/emblem";
import { NameLine } from "../components/identity/name-line";
import { SHIELD_TIERS } from "../domain/shield";
import { EMBLEMS, type Emblem } from "../domain/profile";
import { EmblemChoice } from "../components/identity/emblem-choice";

const SAMPLE_YEARS = [0, 3, 7, 12, 17, 22, 27, 35, 45, 52];
const FEED = [
  { name: "Maple", shield: { tier: "sapphire", years: 21 } },
  { name: "Quinn", shield: { tier: "silver" }, emblem: "supporter" as const },
  { name: "Rowan", emblem: "caregiver" as const },
  {
    name: "Ash",
    shield: { tier: "legacy", years: 52 },
    emblem: "advocate" as const,
  },
  { name: "Plain Name" },
];

/** Development-only gallery for the identity components. Redirects to Create unless the identity flag is on. */
export function IdentityPreview() {
  const [choice, setChoice] = useState<Emblem | undefined>("supporter");
  if (!__DEV__ || !getFlags().identity) return <Redirect href="/create" />;
  return (
    <Page
      title="Identity preview"
      subtitle="Development only. Shields and emblems are self-reported, optional and not a ranking."
    >
      <Section title="Every tier">
        <Card>
          <View style={{ gap: space.lg }}>
            {SHIELD_TIERS.map((t, i) => (
              <View key={t.id} style={{ gap: space.xs }}>
                <T small muted>{`${t.label}, ${t.minYears}+ years`}</T>
                <View style={[row, { alignItems: "center", gap: space.md }]}>
                  <Shield tier={t.id} years={SAMPLE_YEARS[i]} size={56} />
                  <Shield tier={t.id} years={t.minYears} size={36} />
                  <Shield
                    tier={t.id}
                    years={t.minYears}
                    showNumber={false}
                    size={44}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </Section>
      <Section
        title="Sizes"
        note="Each tier at 20, 28 and 44 px, with a number."
      >
        <Card>
          <View style={{ gap: space.sm }}>
            {SHIELD_TIERS.map((t, i) => (
              <View
                key={t.id}
                style={[row, { alignItems: "center", gap: space.lg }]}
              >
                <View style={{ width: 70 }}>
                  <T small muted>
                    {t.label}
                  </T>
                </View>
                {[20, 28, 44].map((n) => (
                  <Shield
                    key={n}
                    tier={t.id}
                    years={SAMPLE_YEARS[i]}
                    size={n}
                  />
                ))}
                <Shield tier={t.id} years={88} size={28} />
              </View>
            ))}
          </View>
        </Card>
      </Section>
      <Section
        title="Emblems"
        note="Badge at 20, 28 and 56 px, then the plain variant."
      >
        <Card>
          <View style={{ gap: space.md }}>
            {EMBLEMS.map((e) => (
              <View
                key={e}
                style={[row, { alignItems: "center", gap: space.lg }]}
              >
                <View style={{ width: 80 }}>
                  <T small muted>
                    {e}
                  </T>
                </View>
                {[20, 28, 56].map((n) => (
                  <EmblemBadge key={n} emblem={e} size={n} />
                ))}
                <EmblemBadge emblem={e} size={28} variant="plain" />
              </View>
            ))}
          </View>
        </Card>
      </Section>
      <Section
        title="Emblem choice"
        note="Used in onboarding. Selection is local to this page."
      >
        <Card>
          <EmblemChoice value={choice} onChange={setChoice} />
        </Card>
      </Section>
      <Section
        title="Names in a feed"
        note="Tap a shield or emblem to open its explanation."
      >
        <Card>
          <View style={{ gap: space.xs }}>
            {FEED.map((p) => (
              <NameLine
                key={p.name}
                name={p.name}
                publicProfile={{
                  name: p.name,
                  shield: p.shield,
                  emblem: p.emblem,
                }}
              />
            ))}
          </View>
        </Card>
      </Section>
    </Page>
  );
}
