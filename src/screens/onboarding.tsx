import React, { useState } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Button,
  Chip,
  Group,
  Input,
  ListRow,
  Notice,
  Steps,
  SwitchRow,
  T,
  space,
} from "../ui";
import { useDemo } from "../store";
import { Page } from "../components/page";
import { PartialDateInput } from "../components/identity/partial-date-input";
import { getFlags } from "../flags";
import {
  CGM_BRANDS,
  COMMUNITY_ROLES,
  DELIVERY_METHODS,
  DIABETES_TYPES,
  EMBLEMS,
  MAX_INTERESTS,
  MAX_MODEL_LENGTH,
  MAX_NAME_LENGTH,
  MONITORING,
  isValidBirthday,
  type Birthday,
  type PartialDate,
  type Profile,
} from "../domain/profile";
import {
  CGM_LABEL,
  DELIVERY_LABEL,
  EMBLEM_NAME,
  INTEREST_SUGGESTIONS,
  MONITORING_LABEL,
  ROLE_LABEL,
  STEP_LABEL,
  STEP_TITLE,
  TYPE_LABEL,
  birthdayFrom,
  completeOnboarding,
  monthName,
  nextSteps,
  summaryLines,
  type OnboardingDraft,
  type StepId,
} from "../domain/onboarding";

/** Single choice. Tapping the chosen option again clears it, so every answer can be taken back. */
export function ChoiceChips<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value?: T;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <View style={{ gap: space.sm, alignItems: "flex-start" }}>
      {options.map((o) => (
        <Chip
          key={o}
          label={labels[o]}
          selected={value === o}
          onPress={() => onChange(value === o ? undefined : o)}
        />
      ))}
    </View>
  );
}

export function ModelInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Input
      label={label}
      value={value ?? ""}
      maxLength={MAX_MODEL_LENGTH}
      placeholder="Optional"
      onChange={(v) => onChange(v || undefined)}
    />
  );
}

/** Month and day only. No year is asked for or stored. */
export function BirthdayFields({
  value,
  onChange,
}: {
  value?: Birthday;
  onChange: (v: Birthday | undefined) => void;
}) {
  const [m, setM] = useState(value?.month ? String(value.month) : "");
  const [d, setD] = useState(value?.day ? String(value.day) : "");
  const [error, setError] = useState<string | undefined>();
  const update = (nm: string, nd: string) => {
    setM(nm);
    setD(nd);
    if (!nm && !nd) {
      setError(undefined);
      return onChange(undefined);
    }
    const date = nm && nd ? birthdayFrom(Number(nm), Number(nd)) : undefined;
    if (date && isValidBirthday(date)) {
      setError(undefined);
      return onChange(date);
    }
    setError(
      nm && nd
        ? "That is not a real date."
        : "Enter both the month and the day.",
    );
    onChange(undefined);
  };
  const digits = (s: string) => s.replace(/\D/g, "");
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Month"
            value={m}
            placeholder="1 to 12"
            maxLength={2}
            onChange={(v) => update(digits(v), d)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Day"
            value={d}
            placeholder="1 to 31"
            maxLength={2}
            onChange={(v) => update(m, digits(v))}
          />
        </View>
      </View>
      {value?.month ? (
        <T small muted>{`${value.day} ${monthName(value.month)}`}</T>
      ) : null}
      {error ? (
        <T small bold>
          {error}
        </T>
      ) : null}
    </View>
  );
}

type Patch = (p: Partial<Profile>) => void;

/** What skipping a step leaves behind: nothing for that question. */
function cleared(id: StepId, p: Partial<Profile>): Partial<Profile> {
  const q = { ...p };
  if (id === "role") delete q.role;
  if (id === "diabetesType") delete q.diabetesType;
  if (id === "diagnosis") delete q.diagnosis;
  if (id === "monitoring") {
    delete q.monitoring;
    delete q.cgm;
  }
  if (id === "cgm") delete q.cgm;
  if (id === "delivery") delete q.delivery;
  if (id === "deliveryModel" && q.delivery)
    q.delivery = { method: q.delivery.method };
  if (id === "emblem") delete q.emblem;
  if (id === "birthday") {
    delete q.birthday;
    delete q.ageConfirmed;
  }
  if (id === "interests") q.interests = [];
  return q;
}

function StepBody({
  id,
  draft,
  patch,
  setDraft,
  name,
  setName,
}: {
  id: StepId;
  draft: OnboardingDraft;
  patch: Patch;
  setDraft: (d: OnboardingDraft) => void;
  name: string;
  setName: (v: string) => void;
}) {
  const p = draft.profile;
  const interests = p.interests ?? [];
  switch (id) {
    case "role":
      return (
        <View style={{ gap: space.lg }}>
          <Input
            label="Display name (the only thing needed)"
            value={name}
            placeholder="You"
            maxLength={MAX_NAME_LENGTH}
            onChange={setName}
          />
          <ChoiceChips
            options={COMMUNITY_ROLES}
            labels={ROLE_LABEL}
            value={p.role}
            onChange={(v) => patch({ role: v })}
          />
        </View>
      );
    case "diabetesType":
      return (
        <ChoiceChips
          options={DIABETES_TYPES}
          labels={TYPE_LABEL}
          value={p.diabetesType}
          onChange={(v) => patch({ diabetesType: v })}
        />
      );
    case "diagnosis":
      return (
        <PartialDateInput
          label="Month and day are optional. Enter what you know."
          value={p.diagnosis}
          onChange={(v) => patch({ diagnosis: v })}
        />
      );
    case "monitoring":
      return (
        <ChoiceChips
          options={MONITORING}
          labels={MONITORING_LABEL}
          value={p.monitoring}
          onChange={(v) => patch({ monitoring: v })}
        />
      );
    case "cgm":
      return (
        <View style={{ gap: space.lg }}>
          <ChoiceChips
            options={CGM_BRANDS}
            labels={CGM_LABEL}
            value={p.cgm?.brand}
            onChange={(v) =>
              patch({ cgm: v ? { brand: v, model: p.cgm?.model } : undefined })
            }
          />
          {p.cgm ? (
            <ModelInput
              label="Model (optional)"
              value={p.cgm.model}
              onChange={(m) =>
                patch({ cgm: { brand: p.cgm!.brand, model: m } })
              }
            />
          ) : null}
        </View>
      );
    case "delivery":
      return (
        <ChoiceChips
          options={DELIVERY_METHODS}
          labels={DELIVERY_LABEL}
          value={p.delivery?.method}
          onChange={(v) =>
            patch({
              delivery: v ? { method: v, model: p.delivery?.model } : undefined,
            })
          }
        />
      );
    case "deliveryModel":
      return (
        <ModelInput
          label="Pump model (optional)"
          value={p.delivery?.model}
          onChange={(m) =>
            p.delivery &&
            patch({ delivery: { method: p.delivery.method, model: m } })
          }
        />
      );
    case "emblem":
      return (
        <View style={{ gap: space.lg }}>
          <T muted>
            An emblem says how you take part. It says nothing medical, and stays
            private until you switch it on.
          </T>
          <ChoiceChips
            options={EMBLEMS}
            labels={EMBLEM_NAME}
            value={p.emblem}
            onChange={(v) => patch({ emblem: v })}
          />
        </View>
      );
    case "birthday":
      return (
        <View style={{ gap: space.lg }}>
          <T muted>
            Only the month and day, for an optional birthday celebration. Your
            age is never shown.
          </T>
          <BirthdayFields
            value={p.birthday}
            onChange={(v) => patch({ birthday: v })}
          />
          <Group>
            <SwitchRow
              title="I confirm I am old enough to use this app"
              detail="Separate from your birthday. You can confirm without giving a date."
              value={p.ageConfirmed === true}
              onChange={(v) => patch({ ageConfirmed: v || undefined })}
            />
          </Group>
        </View>
      );
    case "units":
      return (
        <View style={{ gap: space.sm, alignItems: "flex-start" }}>
          {(["mg/dL", "mmol/L"] as const).map((u) => (
            <Chip
              key={u}
              label={u}
              selected={draft.unit === u}
              accessibilityLabel={`Show glucose in ${u}`}
              onPress={() =>
                setDraft({ ...draft, unit: draft.unit === u ? undefined : u })
              }
            />
          ))}
        </View>
      );
    case "interests":
      return (
        <View style={{ gap: space.lg }}>
          <T
            muted
          >{`Pick up to ${MAX_INTERESTS}. These are never used to look at your glucose.`}</T>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            {INTEREST_SUGGESTIONS.map((i) => (
              <Chip
                key={i}
                label={i}
                selected={interests.includes(i)}
                disabled={
                  !interests.includes(i) && interests.length >= MAX_INTERESTS
                }
                onPress={() =>
                  patch({
                    interests: interests.includes(i)
                      ? interests.filter((x) => x !== i)
                      : [...interests, i],
                  })
                }
              />
            ))}
          </View>
        </View>
      );
    case "healthAchievements":
      return (
        <View style={{ gap: space.lg }}>
          <T muted>
            Optional and off by default. These achievements are private and
            retrospective: they look back at your own data, and they are not
            medical advice.
          </T>
          <Group>
            <SwitchRow
              title="Turn on health achievements"
              detail="Only you can see them."
              value={draft.healthAchievements === true}
              onChange={(v) => setDraft({ ...draft, healthAchievements: v })}
            />
          </Group>
        </View>
      );
  }
}

/** Optional profile questions, one at a time. Offered from Profile; nothing here is shared until Settings says so. */
export function Onboarding() {
  const { state, set } = useDemo();
  const flags = getFlags();
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    profile: { ...state.profile },
  }));
  const [name, setName] = useState(
    state.profile.displayName === "You" ? "" : state.profile.displayName,
  );
  const [index, setIndex] = useState(0);
  if (!flags.identity) return <Redirect href="/create" />;

  const steps = nextSteps(draft.profile).filter(
    (s) => s !== "healthAchievements" || flags.healthAchievements,
  );
  const at = Math.min(index, steps.length);
  const onSummary = at >= steps.length;
  const id = steps[at];
  const labels = [...steps.map((s) => STEP_LABEL[s]), "Summary"];
  const patch: Patch = (p) =>
    setDraft((d) => ({ ...d, profile: { ...d.profile, ...p } }));
  const withName: OnboardingDraft = {
    ...draft,
    profile: { ...draft.profile, displayName: name.trim() },
  };
  const go = (n: number) => setIndex(Math.max(0, n));
  const skip = () => {
    if (id === "units") setDraft({ ...draft, unit: undefined });
    else if (id === "healthAchievements")
      setDraft({ ...draft, healthAchievements: undefined });
    else setDraft({ ...draft, profile: cleared(id, draft.profile) });
    go(at + 1);
  };
  const save = () => {
    const r = completeOnboarding(withName, state.profile);
    const asked = steps.includes("healthAchievements");
    set((s) => ({
      ...s,
      profile: r.profile,
      unit: r.unit ?? s.unit,
      privacy: asked
        ? { ...s.privacy, healthAchievements: r.healthAchievements }
        : s.privacy,
    }));
    router.replace("/profile");
  };
  const lines = summaryLines(withName);
  const shownName = name.trim() || "You";

  return (
    <Page
      title="Set up your profile"
      subtitle="Only a display name is needed. Every question is optional and you can skip any of them."
    >
      <Steps labels={labels} current={at} />
      {onSummary ? (
        <View style={{ gap: space.lg }}>
          <T heading>Your profile</T>
          <Group>
            <ListRow title="Display name" value={shownName} />
            {lines.map((l) => (
              <ListRow key={l.label} title={l.label} detail={l.value} />
            ))}
          </Group>
          {lines.length === 0 ? (
            <T muted>You skipped the optional questions. That is fine.</T>
          ) : null}
          <Notice title="Private until you switch it on">
            Everything above is private. Nothing is shared with anyone, and
            nothing is sent anywhere, until you turn it on in Settings under
            Profile and privacy.
          </Notice>
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
          <T heading>{STEP_TITLE[id]}</T>
          <StepBody
            id={id}
            draft={draft}
            patch={patch}
            setDraft={setDraft}
            name={name}
            setName={setName}
          />
        </View>
      )}
      <View style={{ gap: space.sm }}>
        {onSummary ? (
          <Button kind="primary" label="Save profile" onPress={save} />
        ) : (
          <Button kind="primary" label="Next" onPress={() => go(at + 1)} />
        )}
        {!onSummary ? <Button label="Skip" onPress={skip} /> : null}
        <Button
          kind="ghost"
          label={at === 0 ? "Not now" : "Back"}
          onPress={() => (at === 0 ? router.back() : go(at - 1))}
        />
      </View>
    </Page>
  );
}
