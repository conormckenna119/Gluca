import React, { useState } from "react";
import { BRAND } from "../art/brand";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Chip,
  ConfirmSheet,
  Group,
  ListRow,
  Notice,
  Section,
  T,
  row,
  space,
} from "../ui";
import { useDemo, seed } from "../store";
import { Page } from "../components/page";
import { RangeInputs } from "../components/range-inputs";
import { telemetry } from "../telemetry";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";
import { hasImported, removeImported, REMOVED_IMPORT_MESSAGE } from "../state";

type Pending = null | "import" | "reset";

export function Settings() {
  const { state, set } = useDemo();
  const [pending, setPending] = useState<Pending>(null);
  const [removed, setRemoved] = useState(false);
  const [wasReset, setWasReset] = useState(false);
  const [, refresh] = useState(0);
  const local = telemetry.mode() === "local";
  const counts = Object.entries(telemetry.counts()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const mine = state.posts.filter((p) => p.author === "You");
  const byVisibility = (v: string) =>
    mine.filter((p) => p.visibility === v).length;
  const imported = hasImported(state);

  return (
    <Page
      title="Settings & privacy"
      subtitle={`Everything here stays on this device. ${BRAND.name} is not a medical device and gives no medical advice.`}
    >
      <Section title="Appearance">
        <Group>
          <ListRow
            icon="settings"
            title={state.dark ? "Use light theme" : "Use dark theme"}
            detail={state.dark ? "Dark is on now." : "Light is on now."}
            onPress={() => set((s) => ({ ...s, dark: !s.dark }))}
          />
        </Group>
      </Section>

      <Section
        title="Units and range"
        note="Readings are stored in mg/dL and converted only for display."
      >
        <View style={row}>
          {(["mg/dL", "mmol/L"] as const).map((u) => (
            <Chip
              key={u}
              label={u}
              selected={state.unit === u}
              accessibilityLabel={`Show glucose in ${u}`}
              onPress={() => set((s) => ({ ...s, unit: u }))}
            />
          ))}
        </View>
        <T small muted>
          Target range, used for time in range on My Glucose and Create.
        </T>
        <RangeInputs />
      </Section>

      <Section title="Privacy">
        <Group>
          <ListRow
            icon="info"
            title="Stays on this device"
            detail="Glucose files are read on this device and never uploaded. There is no account, no server and no advertising tracker. Imported readings sit in unencrypted local demo storage, so use synthetic files only in this prototype."
          />
          <ListRow
            icon="file"
            title="Your demo posts"
            detail={`${byVisibility("public")} public · ${byVisibility("followers")} followers-only · ${byVisibility("private")} private`}
          />
          <ListRow
            icon="user"
            title="Not connected"
            detail="Sign-in, notifications and live health connections (Dexcom, Apple Health, Health Connect) are planned and not enabled."
          />
          <ListRow
            icon="info"
            title={local ? "Local analytics are on" : "Analytics are off"}
            detail={
              local
                ? "Event counts are kept in memory on this device only."
                : "Nothing is recorded."
            }
          />
        </Group>
        {local ? (
          <Group>
            <ListRow
              title="Local analytics"
              detail="These counts stay on this device and are not sent anywhere. They hold event names only: no glucose values, file names, text or identifiers. They reset when the app restarts."
            />
            {counts.length ? (
              counts.map(([name, n]) => (
                <ListRow key={name} title={name} value={String(n)} />
              ))
            ) : (
              <ListRow title="No events recorded yet." />
            )}
            <ListRow
              title="Refresh counts"
              icon="check"
              onPress={() => refresh((k) => k + 1)}
            />
            <ListRow
              title="Clear counts"
              icon="close"
              onPress={() => {
                telemetry.clear();
                refresh((k) => k + 1);
              }}
            />
          </Group>
        ) : null}
      </Section>

      <Section title="Data">
        {removed && !imported ? (
          <Notice tone="success" title="Done">
            {REMOVED_IMPORT_MESSAGE}
          </Notice>
        ) : null}
        {wasReset ? (
          <Notice tone="success" title="Done">
            Local demo data was reset on this device.
          </Notice>
        ) : null}
        <Group>
          {linkVisible("import", getFlags()) ? (
            <ListRow
              icon="upload"
              title="Import / export local data"
              detail="Bring in a glucose CSV or save a copy of what is stored here."
              onPress={() => router.push("/import")}
            />
          ) : null}
          <ListRow
            icon="image"
            title="Show welcome screen"
            onPress={() => router.push("/welcome")}
          />
          {imported ? (
            <ListRow
              destructive
              title="Remove imported data"
              detail={`${state.imported.length} imported readings are stored here.`}
              onPress={() => setPending("import")}
            />
          ) : null}
          <ListRow
            destructive
            title="Reset local demo data"
            detail="Removes posts, imported readings and preferences."
            onPress={() => setPending("reset")}
          />
        </Group>
        {state.blocked.length ? (
          <View style={{ gap: space.sm }}>
            {state.blocked.map((p) => (
              <Button
                key={p}
                label={`Unblock ${p}`}
                onPress={() =>
                  set((s) => ({
                    ...s,
                    blocked: s.blocked.filter((n) => n !== p),
                  }))
                }
              />
            ))}
          </View>
        ) : null}
      </Section>

      <ConfirmSheet
        visible={pending === "import"}
        title="Remove imported data?"
        body="This deletes the imported glucose readings from this device and the app goes back to synthetic demo data. Your posts and preferences are kept. This can't be undone."
        confirmLabel="Yes, remove imported data"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          set(removeImported);
          setRemoved(true);
          setWasReset(false);
          setPending(null);
        }}
      />
      <ConfirmSheet
        visible={pending === "reset"}
        title="Reset local demo data?"
        body="This deletes your posts, imported readings and preferences (theme, units and target range) from this local demo. Nothing else is stored, and nothing was ever sent anywhere. This can't be undone."
        confirmLabel="Confirm local reset"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          set(() => seed());
          setWasReset(true);
          setRemoved(false);
          setPending(null);
        }}
      />
    </Page>
  );
}
