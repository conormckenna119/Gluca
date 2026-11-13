import React, { useState } from "react";
import { router } from "expo-router";
import { Button, Card, T } from "../ui";
import { useDemo, seed } from "../store";
import { Page } from "../components/page";
import { RangeInputs } from "../components/range-inputs";
import { telemetry } from "../telemetry";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";
import { hasImported, removeImported, REMOVED_IMPORT_MESSAGE } from "../state";
export function Settings() {
  const { state, set } = useDemo();
  const [confirm, C] = useState(false);
  const [removed, Removed] = useState(false);
  const [, refresh] = useState(0);
  const local = telemetry.mode() === "local";
  const counts = Object.entries(telemetry.counts()).sort(([a], [b]) => a.localeCompare(b));
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
      <T>Target range, used for time in range on My Glucose and Create.</T>
      <RangeInputs />
      <Card>
        <T large>Privacy center</T>
        <T>
          Everything stays in this browser or device. Imported CSV readings use
          unencrypted local demo storage; use synthetic files only in this
          prototype. No server or advertising trackers are configured.{" "}
          {local
            ? "Local analytics is on in this build: event counts are kept in memory on this device only."
            : "Analytics are off: nothing is recorded."}
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
        {linkVisible("import", getFlags()) ? (
          <Button
            label="Import / export local data"
            onPress={() => router.push("/import")}
          />
        ) : null}
        {hasImported(state) ? (
          <Button
            label="Remove imported data"
            onPress={() => {
              set(removeImported);
              Removed(true);
            }}
          />
        ) : null}
        {removed && !hasImported(state) ? <T>{REMOVED_IMPORT_MESSAGE}</T> : null}
        <Button
          label="Show welcome screen"
          onPress={() => router.push("/welcome")}
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
      {local ? (
        <Card>
          <T large>Local analytics</T>
          <T small muted>
            These counts stay on this device and are not sent anywhere. They hold event names only: no glucose values, file names, text or
            identifiers. They reset when the app restarts.
          </T>
          {counts.length ? (
            counts.map(([name, n]) => (
              <T key={name} small>
                {name}: {n}
              </T>
            ))
          ) : (
            <T small>No events recorded yet.</T>
          )}
          <Button label="Refresh counts" onPress={() => refresh((k) => k + 1)} />
          <Button
            label="Clear counts"
            onPress={() => {
              telemetry.clear();
              refresh((k) => k + 1);
            }}
          />
        </Card>
      ) : null}
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
