import React, { useState } from "react";
import { router } from "expo-router";
import { Button, Card, T } from "../ui";
import { useDemo, seed } from "../store";
import { Page } from "../components/page";
export function Settings() {
  const { state, set } = useDemo();
  const [confirm, C] = useState(false);
  return (
    <Page title="Settings & privacy">
      <Button
        label={state.dark ? "Use light theme" : "Use dark theme"}
        onPress={() => set((s) => ({ ...s, dark: !s.dark }))}
      />
      <Button
        label={`Units: ${state.unit}`}
        onPress={() =>
          set((s) => ({ ...s, unit: s.unit === "mg/dL" ? "mmol/L" : "mg/dL" }))
        }
      />
      <Card>
        <T large>Privacy center</T>
        <T>
          Everything stays in this browser or device. Imported CSV readings use
          unencrypted local demo storage; use synthetic files only in this
          prototype. No server, analytics, or advertising trackers are
          configured.
        </T>
        <T>
          {
            state.posts.filter(
              (p) => p.author === "You" && p.visibility === "public",
            ).length
          }{" "}
          public demo posts ·{" "}
          {
            state.posts.filter(
              (p) => p.author === "You" && p.visibility === "followers",
            ).length
          }{" "}
          followers-only posts ·{" "}
          {
            state.posts.filter(
              (p) => p.author === "You" && p.visibility === "private",
            ).length
          }{" "}
          private posts
        </T>
        <T>
          Account sign-in, server permissions, deletion requests, notifications,
          and live health connections are planned. Registration is not enabled.
        </T>
        <T>Dexcom, Apple Health, Health Connect: not connected.</T>
        <Button
          label="Import / export local data"
          onPress={() => router.push("/import")}
        />
        <Button label="Reset local demo data" onPress={() => C(true)} />
        {confirm ? (
          <>
            <T>Delete posts, imports, and preferences from this local demo?</T>
            <Button
              label="Confirm local reset"
              onPress={() => {
                set(() => seed());
                C(false);
              }}
            />
            <Button label="Cancel reset" onPress={() => C(false)} />
          </>
        ) : null}
      </Card>
      {state.blocked.map((p) => (
        <Button
          key={p}
          label={`Unblock ${p}`}
          onPress={() =>
            set((s) => ({ ...s, blocked: s.blocked.filter((n) => n !== p) }))
          }
        />
      ))}
    </Page>
  );
}
