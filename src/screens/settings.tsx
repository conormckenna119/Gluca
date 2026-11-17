import React, { useState } from "react";
import { BRAND } from "../art/brand";
import { Switch, Text, View } from "react-native";
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
  useColors,
} from "../ui";
import type { PrivacySettings } from "../domain/profile";
import { useDemo, seed } from "../store";
import { Page } from "../components/page";
import { RangeInputs } from "../components/range-inputs";
import { telemetry } from "../telemetry";
import { getFlags } from "../flags";
import { linkVisible } from "../nav";
import { hasImported, removeImported, REMOVED_IMPORT_MESSAGE } from "../state";
import { DexcomConnection } from "../components/dexcom-connection";
import { GlucoseSyncStatus } from "../components/glucose-sync-status";

type Pending = null | "import" | "reset";

/** A switch row that can be disabled while the information behind it is missing. */
function GatedSwitchRow({
  title,
  detail,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        minHeight: 56,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 19 }}>
          {detail}
        </Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: c.border, true: c.accent }}
        thumbColor={c.text}
      />
    </View>
  );
}

const MISSING = "Add this in your profile first.";

/** Each switch is a separate choice and starts off. Nothing is shared by creating a profile. */
function ProfilePrivacy() {
  const { state, set } = useDemo();
  const { profile: p, privacy: v } = state;
  const flip = (k: keyof PrivacySettings) => (on: boolean) =>
    set((s) => ({ ...s, privacy: { ...s.privacy, [k]: on } }));
  const real = (x?: string) => !!x && x !== "prefer_not";
  const has = {
    diagnosis: !!p.diagnosis,
    emblem: !!p.emblem,
    birthday: p.birthday?.month !== undefined && p.birthday?.day !== undefined,
    type: real(p.diabetesType),
    delivery: real(p.delivery?.method),
    cgm: real(p.cgm?.brand),
  };
  const sw = (
    key: keyof PrivacySettings,
    title: string,
    who: string,
    available = true,
    missing = MISSING,
  ) => (
    <GatedSwitchRow
      key={key}
      title={title}
      detail={available || v[key] ? who : missing}
      value={v[key]}
      disabled={!available && !v[key]}
      onChange={flip(key)}
    />
  );
  return (
    <Section
      title="Profile and privacy"
      note="Everything here starts off. Creating a profile shares nothing. Supporters never see your glucose data."
    >
      <Group>
        {sw(
          "showShield",
          "Show diabetes experience shield",
          "Anyone who sees your name will see a shield. It never shows your diagnosis date.",
          has.diagnosis,
        )}
        {sw(
          "showShieldNumber",
          "Show years on the shield",
          "Others see the number of years as well as the shield.",
          has.diagnosis && v.showShield,
          "Turn on the shield first.",
        )}
        {sw(
          "showEmblem",
          "Show supporter emblem",
          "Anyone who sees your name will see your emblem.",
          has.emblem,
        )}
        {sw(
          "showBirthday",
          "Show birthday celebration",
          "Others see a celebration on your birthday only. Your date and age are never shown.",
          has.birthday,
        )}
        {sw(
          "showDiabetesType",
          "Display diabetes type",
          "Others who open your profile will see your diabetes type.",
          has.type,
        )}
        {sw(
          "showDelivery",
          "Display insulin delivery method",
          "Others who open your profile will see how you take insulin.",
          has.delivery,
        )}
        {sw(
          "showCgm",
          "Display CGM device",
          "Others who open your profile will see your CGM device.",
          has.cgm,
        )}
        {sw(
          "showMemberships",
          "Display community memberships",
          "Others will see only the clubs you have also made visible.",
          state.clubs.length > 0,
          "Join a club first.",
        )}
      </Group>
      {getFlags().healthAchievements ? (
        <>
          <Notice title="Health achievements are private and optional">
            They look back at your own data, only you can see them unless you
            choose otherwise, and they are not medical advice.
          </Notice>
          <Group>
            {sw(
              "healthAchievements",
              "Enable health achievements",
              "Only you. Off until you turn it on.",
            )}
          </Group>
        </>
      ) : null}
      <Group>
        {sw(
          "achievementNotifications",
          "Enable achievement notifications",
          "Only you. This saves your preference; notifications are not active in this prototype.",
        )}
      </Group>
    </Section>
  );
}

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
  const flags = getFlags();

  return (
    <Page
      title="Settings & privacy"
      subtitle={`${flags.dexcomApi ? "Demo and CSV data stay on this device. Sandbox authorization uses a protected backend." : "Everything here stays on this device."} ${BRAND.name} is not a medical device and gives no medical advice.`}
    >
      {flags.dexcomApi ? <DexcomConnection /> : null}
      <GlucoseSyncStatus />
      {__DEV__ && flags.dexcomApi && flags.dexcomDiagnostics ? (
        <Button
          label="Dexcom development data viewer"
          onPress={() => router.push("/dexcom-data")}
        />
      ) : null}
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
            detail={
              flags.dexcomApi
                ? "CSV readings and the browser's Dexcom cache stay in this open app's memory. Reloading clears raw history. Encrypted Dexcom tokens use the protected backend. Logout or disconnect clears private session caches; explicit exported files and published snapshots are kept. No advertising tracker is configured."
                : "Glucose files are read on this device and never uploaded. The connection service is off and no advertising tracker is configured. Imported readings sit in unencrypted local demo storage, so use synthetic files only in this prototype."
            }
          />
          <ListRow
            icon="file"
            title="Your demo posts"
            detail={`${byVisibility("public")} public · ${byVisibility("followers")} followers-only · ${byVisibility("private")} private`}
          />
          <ListRow
            icon="user"
            title={
              flags.dexcomApi ? "Connection availability" : "Not connected"
            }
            detail={
              flags.dexcomApi
                ? "Dexcom sandbox connection status appears above. Real health-data connections, notifications, Apple Health and Health Connect remain unavailable."
                : "Notifications and health connections (Dexcom, Apple Health, Health Connect) are not enabled. Sandbox OAuth can be enabled separately for testing."
            }
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

      {flags.identity ? <ProfilePrivacy /> : null}

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
        body="This deletes local demo posts, imported readings and preferences (theme, units and target range). Manage the separate Dexcom connection and private glucose cache using the controls above. This can't be undone."
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
