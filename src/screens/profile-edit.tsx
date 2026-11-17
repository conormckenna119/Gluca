import React, { useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import {
  Button,
  Chip,
  ConfirmSheet,
  Group,
  Notice,
  Section,
  SwitchRow,
  T,
  space,
} from "../ui";
import { useDemo } from "../store";
import { ProfileFields } from "../components/identity/profile-fields";
import { ProfileSave } from "../components/identity/profile-save";
import {
  CONNECTIONS,
  chooseConnection,
  connectionChoice,
  type ConnectionChoice,
} from "../domain/profile-experience";
import { Page } from "../components/page";
import { PartialDateInput } from "../components/identity/partial-date-input";
import { BirthdayFields, ChoiceChips, ModelInput } from "./onboarding";
import { getFlags } from "../flags";
import {
  CGM_BRANDS,
  DELIVERY_METHODS,
  DIABETES_TYPES,
  EMBLEMS,
  MAX_INTERESTS,
  MONITORING,
  defaultProfile,
  sanitizeProfile,
  type Profile,
} from "../domain/profile";
import {
  CGM_LABEL,
  DELIVERY_LABEL,
  EMBLEM_NAME,
  INTEREST_SUGGESTIONS,
  MONITORING_LABEL,
  TYPE_LABEL,
} from "../domain/onboarding";

/** A titled field with a clear Remove action while it holds something. */
function Field({
  title,
  hasValue,
  onRemove,
  children,
}: {
  title: string;
  hasValue: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <T bold>{title}</T>
      {children}
      {hasValue ? (
        <View style={{ alignSelf: "flex-start" }}>
          <Button
            kind="ghost"
            label={`Remove ${title.toLowerCase()}`}
            onPress={onRemove}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Edit every profile field in memory, then explicitly save to the current account. */
function ProfileEditor() {
  const { state, set, profileStatus, hasLegacyProfile, reviewLegacyProfile } =
    useDemo();
  const [confirm, setConfirm] = useState(false);
  const [bump, setBump] = useState(0);
  const [validDate, validDateSet] = useState(true);
  const [validBirthday, validBirthdaySet] = useState(true);
  if (!getFlags().identity) return <Redirect href="/create" />;
  const p = state.profile;
  const interests = p.interests;
  // Edit in memory. Explicit save commits to the authenticated account.
  const save = (next: Partial<Profile>) =>
    set((s) => {
      const merged = { ...s.profile, ...next };
      const kept = merged;
      return {
        ...s,
        profile: {
          ...kept,
          displayName: merged.displayName,
          onboarded: s.profile.onboarded,
        } as Profile,
      };
    });
  const remove = (keys: (keyof Profile)[], remount = false) => {
    if (keys.includes("diagnosis")) validDateSet(true);
    if (keys.includes("birthday")) validBirthdaySet(true);
    set((s) => {
      const q: Partial<Profile> = { ...s.profile };
      for (const k of keys) delete q[k];
      const kept = q;
      return {
        ...s,
        profile: sanitizeProfile({
          ...kept,
          displayName: s.profile.displayName,
          onboarded: s.profile.onboarded,
        }),
      };
    });
    if (remount) setBump((b) => b + 1);
  };
  const living = p.role === "living";
  const onCgm = p.monitoring === "cgm" || p.monitoring === "both";
  const pump = [
    "tandem",
    "omnipod",
    "twiist",
    "medtronic",
    "other_pump",
  ].includes(p.delivery?.method ?? "");

  return (
    <Page
      title="Edit profile"
      subtitle="Edit your choices, then save. Medical details are private unless you explicitly share them."
    >
      <Section title="Name">
        <Notice
          title={
            profileStatus === "account"
              ? "Protected account profile"
              : "Session-only profile"
          }
        >
          {profileStatus === "account"
            ? "Save commits your choices to your signed-in account. Public fields are previewed below."
            : "Guest changes last only in this open app. Sign in for protected account storage."}
        </Notice>
        {hasLegacyProfile ? (
          <Button
            label="Review previous local profile"
            onPress={reviewLegacyProfile}
          />
        ) : null}
        <ProfileFields
          profile={p}
          privacy={state.privacy}
          patch={(next) =>
            set((s) => ({ ...s, profile: { ...s.profile, ...next } }))
          }
        />
      </Section>
      <Section title="About you">
        <ChoiceChips
          options={Object.keys(CONNECTIONS) as ConnectionChoice[]}
          labels={CONNECTIONS}
          value={connectionChoice(p)}
          onChange={(choice) => save(chooseConnection(p, choice ?? "private"))}
        />
      </Section>
      {living ? (
        <Section
          title="Diabetes"
          note="Private by default. Prefer not to say is always fine."
        >
          <Field
            title="Type"
            hasValue={!!p.diabetesType}
            onRemove={() => remove(["diabetesType"])}
          >
            <ChoiceChips
              options={DIABETES_TYPES}
              labels={TYPE_LABEL}
              value={p.diabetesType}
              onChange={(v) =>
                v ? save({ diabetesType: v }) : remove(["diabetesType"])
              }
            />
          </Field>
          <Field
            title="Diagnosis date"
            hasValue={!!p.diagnosis}
            onRemove={() => remove(["diagnosis"], true)}
          >
            <PartialDateInput
              key={`dx${bump}`}
              label="Month and day are optional. Enter what you know."
              value={p.diagnosis}
              onValidityChange={validDateSet}
              onChange={(v) => save({ diagnosis: v })}
            />
          </Field>
          <Field
            title="Monitoring"
            hasValue={!!p.monitoring}
            onRemove={() => remove(["monitoring", "cgm"])}
          >
            <ChoiceChips
              options={MONITORING}
              labels={MONITORING_LABEL}
              value={p.monitoring}
              onChange={(v) =>
                v ? save({ monitoring: v }) : remove(["monitoring", "cgm"])
              }
            />
          </Field>
          {onCgm ? (
            <Field
              title="CGM"
              hasValue={!!p.cgm}
              onRemove={() => remove(["cgm"])}
            >
              <ChoiceChips
                options={CGM_BRANDS}
                labels={CGM_LABEL}
                value={p.cgm?.brand}
                onChange={(v) =>
                  v
                    ? save({ cgm: { brand: v, model: p.cgm?.model } })
                    : remove(["cgm"])
                }
              />
              {p.cgm ? (
                <ModelInput
                  label="CGM model (optional)"
                  value={p.cgm.model}
                  onChange={(m) =>
                    save({ cgm: { brand: p.cgm!.brand, model: m } })
                  }
                />
              ) : null}
            </Field>
          ) : null}
          <Field
            title="Insulin delivery"
            hasValue={!!p.delivery}
            onRemove={() => remove(["delivery"])}
          >
            <ChoiceChips
              options={DELIVERY_METHODS}
              labels={DELIVERY_LABEL}
              value={p.delivery?.method}
              onChange={(v) =>
                v
                  ? save({ delivery: { method: v, model: p.delivery?.model } })
                  : remove(["delivery"])
              }
            />
            {p.delivery && pump ? (
              <ModelInput
                label="Pump model (optional)"
                value={p.delivery.model}
                onChange={(m) =>
                  save({ delivery: { method: p.delivery!.method, model: m } })
                }
              />
            ) : null}
          </Field>
        </Section>
      ) : null}
      {p.role && !living ? (
        <Section title="Emblem" note="Says how you take part. Nothing medical.">
          <Field
            title="Emblem"
            hasValue={!!p.emblem}
            onRemove={() => remove(["emblem"])}
          >
            <ChoiceChips
              options={EMBLEMS}
              labels={EMBLEM_NAME}
              value={p.emblem}
              onChange={(v) => (v ? save({ emblem: v }) : remove(["emblem"]))}
            />
          </Field>
        </Section>
      ) : null}
      <Section
        title="Birthday"
        note="Month and day only, for an optional celebration. Your age is never shown."
      >
        <Field
          title="Birthday"
          hasValue={!!p.birthday}
          onRemove={() => remove(["birthday"], true)}
        >
          <BirthdayFields
            key={`bd${bump}`}
            value={p.birthday}
            onValidityChange={validBirthdaySet}
            onChange={(v) => save({ birthday: v })}
          />
        </Field>
        <Group>
          <SwitchRow
            title="I confirm I am old enough to use this app"
            detail="Separate from your birthday."
            value={p.ageConfirmed === true}
            onChange={(v) =>
              v ? save({ ageConfirmed: true }) : remove(["ageConfirmed"])
            }
          />
        </Group>
      </Section>
      <Section title="Interests" note={`Up to ${MAX_INTERESTS}.`}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {INTEREST_SUGGESTIONS.map((i) => (
            <Chip
              key={i}
              label={i}
              selected={interests.includes(i)}
              disabled={
                !interests.includes(i) && interests.length >= MAX_INTERESTS
              }
              onPress={() =>
                save({
                  interests: interests.includes(i)
                    ? interests.filter((x) => x !== i)
                    : [...interests, i],
                })
              }
            />
          ))}
        </View>
        {interests.length ? (
          <View style={{ alignSelf: "flex-start" }}>
            <Button
              kind="ghost"
              label="Remove interests"
              onPress={() => remove(["interests"])}
            />
          </View>
        ) : null}
      </Section>
      <Section title="Remove information">
        <Notice>
          Your display name is kept. Clear optional fields from this draft, then
          save to update your account. Preserved legacy local records stay
          unchanged.
        </Notice>
        <Button
          label="Remove all optional information"
          onPress={() => setConfirm(true)}
        />
      </Section>
      <Section
        title="Public visibility"
        note="Every medical field is private until you explicitly choose otherwise."
      >
        {(
          [
            "showShield",
            "showShieldNumber",
            "showEmblem",
            "showBirthday",
            "showDiabetesType",
            "showCgm",
            "showDelivery",
          ] as const
        ).map((k) => (
          <SwitchRow
            key={k}
            title={
              {
                showShield: "Show experience shield",
                showShieldNumber: "Show completed years",
                showEmblem: "Show supporter emblem",
                showBirthday: "Celebrate my birthday",
                showDiabetesType: "Show diabetes type",
                showCgm: "Show CGM device",
                showDelivery: "Show insulin delivery",
              }[k]
            }
            value={state.privacy[k]}
            onChange={(value) =>
              set((s) => ({ ...s, privacy: { ...s.privacy, [k]: value } }))
            }
          />
        ))}
        <ProfileSave disabled={!validDate || !validBirthday} />
      </Section>
      <ConfirmSheet
        visible={confirm}
        title="Remove all optional information?"
        body="This clears optional profile fields from your draft. Save profile and privacy to commit the change to your account. Your display name and privacy choices are kept. Preserved legacy local records and exported files stay unchanged."
        confirmLabel="Clear optional fields"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          set((s) => ({
            ...s,
            profile: {
              ...defaultProfile(),
              displayName: s.profile.displayName,
              onboarded: s.profile.onboarded,
            },
          }));
          setBump((b) => b + 1);
          setConfirm(false);
        }}
      />
    </Page>
  );
}
export function ProfileEdit() {
  const { profileStatus, profileVersion } = useDemo();
  return profileStatus === "checking" ? (
    <Page title="Loading your profile">
      <T>Verifying your account…</T>
    </Page>
  ) : (
    <ProfileEditor key={profileVersion} />
  );
}
