import React, { useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import {
  Button,
  Chip,
  ConfirmSheet,
  Group,
  Input,
  Notice,
  Section,
  SwitchRow,
  T,
  space,
} from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PartialDateInput } from "../components/identity/partial-date-input";
import { BirthdayFields, ChoiceChips, ModelInput } from "./onboarding";
import { getFlags } from "../flags";
import {
  CGM_BRANDS,
  COMMUNITY_ROLES,
  DELIVERY_METHODS,
  DIABETES_TYPES,
  EMBLEMS,
  MAX_INTERESTS,
  MAX_NAME_LENGTH,
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
  ROLE_LABEL,
  TYPE_LABEL,
  pruneDraft,
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

/** Edit every profile field. Each change is saved as it is made; each optional field can be removed. */
export function ProfileEdit() {
  const { state, set } = useDemo();
  const [confirm, setConfirm] = useState(false);
  const [bump, setBump] = useState(0);
  const [name, setName] = useState(
    state.profile.displayName === "You" ? "" : state.profile.displayName,
  );
  if (!getFlags().identity) return <Redirect href="/create" />;
  const p = state.profile;
  const interests = p.interests;
  // Save a change; answers that no longer apply to the chosen role are dropped.
  const save = (next: Partial<Profile>) =>
    set((s) => {
      const merged = { ...s.profile, ...next };
      const kept = pruneDraft({ profile: merged }).profile;
      return {
        ...s,
        profile: sanitizeProfile({
          ...kept,
          displayName: merged.displayName,
          onboarded: s.profile.onboarded,
        }),
      };
    });
  const remove = (keys: (keyof Profile)[], remount = false) => {
    set((s) => {
      const q: Partial<Profile> = { ...s.profile };
      for (const k of keys) delete q[k];
      const kept = pruneDraft({ profile: q }).profile;
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
  const pump = ["tandem", "omnipod", "twiist", "other_pump"].includes(
    p.delivery?.method ?? "",
  );

  return (
    <Page
      title="Edit profile"
      subtitle="Everything here is optional and private until you switch it on in Settings. Changes save as you make them."
    >
      <Section title="Name">
        <Input
          label="Display name"
          value={name}
          placeholder="You"
          maxLength={MAX_NAME_LENGTH}
          onChange={(v) => {
            setName(v);
            save({ displayName: v.trim() || defaultProfile().displayName });
          }}
        />
      </Section>
      <Section title="About you">
        <ChoiceChips
          options={COMMUNITY_ROLES}
          labels={ROLE_LABEL}
          value={p.role}
          onChange={(v) => (v ? save({ role: v }) : remove(["role"]))}
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
              onChange={(v) => v && save({ diagnosis: v })}
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
            onChange={(v) => v && save({ birthday: v })}
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
          Your display name is kept. Everything else optional is deleted from
          this device.
        </Notice>
        <Button
          label="Remove all optional information"
          onPress={() => setConfirm(true)}
        />
      </Section>
      <ConfirmSheet
        visible={confirm}
        title="Remove all optional information?"
        body="This deletes your role, diabetes details, diagnosis date, devices, emblem, birthday and interests from this device. Your display name and privacy settings are kept. This can't be undone."
        confirmLabel="Yes, remove everything optional"
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
