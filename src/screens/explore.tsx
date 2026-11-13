import React from "react";
import { Button, Card, T } from "../ui";
import { useDemo, people, clubNames } from "../store";
import { Page } from "../components/page";
export function Explore() {
  const { state, set } = useDemo();
  return (
    <Page title="Explore">
      <T>
        Participation over competition. This week's invitation: encourage
        another community member.
      </T>
      {clubNames.map((n) => (
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
      ))}
      <T large>Community members</T>
      {people
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
