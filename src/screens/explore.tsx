import React from "react";
import { Button, Card, T } from "../ui";
import { useDemo, people, clubNames } from "../store";
import { Page } from "../components/page";
import { Guard } from "../components/guard";
import { getFlags } from "../flags";
export function Explore() {
  return (
    <Guard route="/explore">
      <ExploreBody />
    </Guard>
  );
}
function ExploreBody() {
  const flags = getFlags();
  const { state, set } = useDemo();
  return (
    <Page title="Explore">
      <T>
        Participation over competition. This week's invitation: encourage
        another community member.
      </T>
      {flags.clubs ? clubNames.map((n) => (
        <Card key={n}>
          <T large>{n}</T>
          <T>
            Fictional demo club · Be kind, respect privacy, and avoid treatment
            advice.
          </T>
          <Button
            label={state.clubs.includes(n) ? `Leave ${n}` : `Join ${n}`}
            onPress={() =>
              set((s) => ({
                ...s,
                clubs: s.clubs.includes(n)
                  ? s.clubs.filter((c) => c !== n)
                  : [...s.clubs, n],
              }))
            }
          />
        </Card>
      )) : null}
      {flags.communityFeed ? <T large>Community members</T> : null}
      {(flags.communityFeed ? people : [])
        .filter((p) => !state.blocked.includes(p))
        .map((p) => (
          <Card key={p}>
            <T>{p} · fictional profile</T>
            <Button
              label={`${state.following.includes(p) ? "Unfollow" : "Follow"} ${p}`}
              onPress={() =>
                set((s) => ({
                  ...s,
                  following: s.following.includes(p)
                    ? s.following.filter((n) => n !== p)
                    : [...s.following, p],
                }))
              }
            />
          </Card>
        ))}
    </Page>
  );
}
