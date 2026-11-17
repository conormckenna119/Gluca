import React, { useState, useEffect, useRef } from "react";
import { View, Animated, AccessibilityInfo } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Input,
  Notice,
  Steps,
  SwitchRow,
  T,
  space,
} from "../ui";
import { Page } from "../components/page";
import { useDemo } from "../store";
import { getFlags } from "../flags";
import { PartialDateInput } from "../components/identity/partial-date-input";
import {
  BirthdayFields,
  ChoiceChips,
  ModelInput,
} from "../components/identity/question-fields";
import { ProfileFields } from "../components/identity/profile-fields";
import { UserIdentity } from "../components/identity/user-identity";
import { Shield } from "../components/identity/shield";
import {
  CONNECTIONS,
  connectionChoice,
  chooseConnection,
  validatePublicFields,
  type ConnectionChoice,
} from "../domain/profile-experience";
import {
  DELIVERY_METHODS,
  EMBLEMS,
  sanitizeProfile,
  sanitizePrivacy,
  type Profile,
} from "../domain/profile";
import {
  DELIVERY_LABEL,
  EMBLEM_NAME,
  INTEREST_SUGGESTIONS,
  PUMP_METHODS,
} from "../domain/onboarding";
import { publicView } from "../domain/public-view";
import { localToday, shieldFor, shieldLabel } from "../domain/shield";
import { suggestedFor } from "../domain/communities";

function ExperiencePreview({ profile }: { profile: Profile }) {
  const info = shieldFor(profile.diagnosis, localToday()),
    opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (alive && !reduced) {
        opacity.setValue(0.3);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: false,
        }).start();
      }
    });
    return () => {
      alive = false;
      opacity.stopAnimation();
    };
  }, [info?.years, info?.tier.id, info?.certain]);
  return info ? (
    <Animated.View
      style={{
        opacity,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      }}
    >
      <Shield
        tier={info.tier.id}
        years={info.years}
        certain={info.certain}
        size={64}
      />
      <View style={{ flex: 1 }}>
        <T bold>Your experience, your choice</T>
        <T small>{shieldLabel(info.tier, info.years, info.certain)}</T>
      </View>
    </Animated.View>
  ) : (
    <T small muted>
      Enter only the parts you know. No date means no numeric shield.
    </T>
  );
}
function OnboardingEditor() {
  const { state, saveProfile, profileStatus, reloadProfile } = useDemo();
  const [p, P] = useState<Profile>(() => ({ ...state.profile })),
    [v, V] = useState(() => ({ ...state.privacy }));
  const [at, A] = useState(0),
    [done, D] = useState(false),
    [busy, B] = useState(false),
    [error, E] = useState("");
  const [validDate, validDateSet] = useState(true),
    [validBirthday, validBirthdaySet] = useState(true);
  const [monitorOpen, monitorSet] = useState(false),
    [deliveryOpen, deliverySet] = useState(false);
  const patch = (next: Partial<Profile>) =>
    P((previous) => ({ ...previous, ...next }));
  const living = p.role === "living";
  const steps = living
    ? [
        "Connection",
        "Journey",
        "Technology & interests",
        "Your profile",
        "Welcome",
      ]
    : ["Connection", "Technology & interests", "Your profile", "Welcome"];
  const stage = steps[Math.min(at, steps.length - 1)];
  const view = publicView(p, v, {
    today: localToday(),
    clubs: [],
    clubVisibility: {},
    awards: [],
  });
  const suggestions = suggestedFor(p, localToday(), []).slice(0, 3);
  const finish = async () => {
    E("");
    B(true);
    try {
      const invalid = validatePublicFields(p);
      if (invalid) throw new Error(invalid);
      if (p.diagnosis && !shieldFor(p.diagnosis, localToday()))
        throw new Error(
          "Check your diagnosis date; it cannot be in the future.",
        );
      await saveProfile(
        sanitizeProfile({ ...p, onboarded: true }),
        sanitizePrivacy(v),
      );
      D(true);
    } catch (e) {
      E(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      B(false);
    }
  };
  const skip = () => {
    if (stage === "Connection") {
      P({ ...chooseConnection(p, "private") });
      A(1);
      return;
    }
    if (stage === "Journey") patch({ diagnosis: undefined });
    // Other optional pages retain already-saved values; skipping never destructively erases a profile.
    A((n) => Math.min(n + 1, steps.length - 1));
  };
  if (done)
    return (
      <Page
        title={`Welcome, ${p.displayName === "You" ? "friend" : p.displayName}`}
        subtitle="Your profile is ready."
      >
        <Card>
          <UserIdentity expanded profile={view} />
          <T>
            {living
              ? "Explore the community or connect your glucose data."
              : "Explore the community. No glucose connection is needed."}
          </T>
          <T small muted>
            {profileStatus === "account"
              ? "Your choices were saved to your protected account."
              : "Guest preview: choices last in this open app. Sign in for account storage."}
          </T>
          <Button
            kind="primary"
            label="Explore Gluca"
            onPress={() => router.replace("/explore")}
          />
          {living && getFlags().dexcomApi ? (
            <Button
              label="Connect Dexcom (optional)"
              onPress={() => router.replace("/settings")}
            />
          ) : null}
          <Button
            label="View my profile"
            onPress={() => router.replace("/profile")}
          />
        </Card>
      </Page>
    );
  return (
    <Page
      title="Make yourself at home"
      subtitle="A few choices, all at your pace. Every optional question can be skipped."
    >
      <Steps labels={steps} current={at} />
      {profileStatus === "unavailable" ? (
        <Notice title="Profile service unavailable">
          Your changes remain in memory. Reconnect to your backend before
          saving.
          <Button
            label="Reload saved account profile"
            onPress={() => void reloadProfile()}
          />
        </Notice>
      ) : null}
      <Card>
        {stage === "Connection" ? (
          <>
            <T heading>How are you connected to diabetes?</T>
            <ChoiceChips
              options={Object.keys(CONNECTIONS) as ConnectionChoice[]}
              labels={CONNECTIONS}
              value={connectionChoice(p)}
              onChange={(choice) => P(chooseConnection(p, choice ?? "private"))}
            />
            <T small muted>
              Everyone is welcome. This choice does not grant anyone access to
              private glucose data.
            </T>
          </>
        ) : null}
        {stage === "Journey" ? (
          <>
            <T heading>When were you diagnosed?</T>
            <T muted>
              Year only, month and year, or an exact date—share only what you
              know. Your date stays private. An optional shield can show your
              experience beside your name.
            </T>
            <PartialDateInput
              label="Diagnosis date · enter only what you know"
              value={p.diagnosis}
              onValidityChange={validDateSet}
              onChange={(diagnosis) => patch({ diagnosis })}
            />
            <ExperiencePreview profile={p} />
            <SwitchRow
              title="Show my experience shield publicly"
              detail="Lived experience, never expertise or a competitive rank."
              value={v.showShield}
              onChange={(showShield) =>
                V({ ...v, showShield, showShieldNumber: showShield })
              }
            />
          </>
        ) : null}
        {stage === "Technology & interests" ? (
          <>
            <T heading>
              {living ? "Your everyday setup" : "What brings you here?"}
            </T>
            <T muted>
              {living
                ? "Optional. Device answers are self-reported and private; they do not connect a Dexcom account."
                : "Choose an optional emblem and what you enjoy. No glucose account is needed."}
            </T>
            {living ? (
              <>
                <T bold>Glucose monitoring</T>
                <Button
                  label={
                    monitorOpen
                      ? "Hide monitoring options"
                      : "Add monitoring details (optional)"
                  }
                  onPress={() => monitorSet(!monitorOpen)}
                />
                {monitorOpen ? (
                  <>
                    <View style={{ gap: space.sm }}>
                      {[
                        "Dexcom G7",
                        "Other Dexcom devices",
                        "FreeStyle Libre",
                        "Other CGM",
                        "Fingerstick monitoring",
                        "None",
                        "Prefer not to say",
                      ].map((label) => (
                        <Chip
                          key={label}
                          label={label}
                          selected={
                            label === "Dexcom G7"
                              ? p.cgm?.brand === "dexcom" &&
                                p.cgm.model === "G7"
                              : label === "Other Dexcom devices"
                                ? p.cgm?.brand === "dexcom" &&
                                  p.cgm.model !== "G7"
                                : label === "FreeStyle Libre"
                                  ? p.cgm?.brand === "libre"
                                  : label === "Other CGM"
                                    ? p.cgm?.brand === "other"
                                    : label === "Fingerstick monitoring"
                                      ? p.monitoring === "meter"
                                      : label === "None"
                                        ? p.monitoring === "none"
                                        : p.monitoring === "prefer_not"
                          }
                          onPress={() =>
                            patch(
                              label === "Dexcom G7"
                                ? {
                                    monitoring: "cgm",
                                    cgm: { brand: "dexcom", model: "G7" },
                                  }
                                : label === "Other Dexcom devices"
                                  ? {
                                      monitoring: "cgm",
                                      cgm: { brand: "dexcom" },
                                    }
                                  : label === "FreeStyle Libre"
                                    ? {
                                        monitoring: "cgm",
                                        cgm: { brand: "libre" },
                                      }
                                    : label === "Other CGM"
                                      ? {
                                          monitoring: "cgm",
                                          cgm: { brand: "other" },
                                        }
                                      : {
                                          monitoring:
                                            label === "Fingerstick monitoring"
                                              ? "meter"
                                              : label === "None"
                                                ? "none"
                                                : "prefer_not",
                                          cgm: undefined,
                                        },
                            )
                          }
                        />
                      ))}
                    </View>
                    {p.monitoring === "cgm" && p.cgm ? (
                      <ModelInput
                        label="CGM model (optional)"
                        value={p.cgm.model}
                        onChange={(model) =>
                          patch({ cgm: { brand: p.cgm!.brand, model } })
                        }
                      />
                    ) : null}
                  </>
                ) : null}
                <T bold>Insulin delivery, if any</T>
                <Button
                  label={
                    deliveryOpen
                      ? "Hide insulin delivery options"
                      : "Add insulin delivery (optional)"
                  }
                  onPress={() => deliverySet(!deliveryOpen)}
                />
                {deliveryOpen ? (
                  <>
                    <ChoiceChips
                      options={DELIVERY_METHODS.filter(
                        (x) => x !== "injections",
                      )}
                      labels={DELIVERY_LABEL}
                      value={p.delivery?.method}
                      onChange={(method) =>
                        patch({ delivery: method ? { method } : undefined })
                      }
                    />
                    {p.delivery && PUMP_METHODS.includes(p.delivery.method) ? (
                      <ModelInput
                        label="Pump model (optional)"
                        value={p.delivery.model}
                        onChange={(model) =>
                          patch({
                            delivery: { method: p.delivery!.method, model },
                          })
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <ChoiceChips
                  options={EMBLEMS}
                  labels={EMBLEM_NAME}
                  value={p.emblem}
                  onChange={(emblem) => patch({ emblem })}
                />
                <SwitchRow
                  title="Show my emblem publicly"
                  value={v.showEmblem}
                  onChange={(showEmblem) => V({ ...v, showEmblem })}
                />
              </>
            )}
            <T bold>Interests</T>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
            >
              {INTEREST_SUGGESTIONS.map((i) => (
                <Chip
                  key={i}
                  label={i}
                  selected={p.interests.includes(i)}
                  disabled={
                    !p.interests.includes(i) && p.interests.length >= 12
                  }
                  onPress={() =>
                    patch({
                      interests: p.interests.includes(i)
                        ? p.interests.filter((x) => x !== i)
                        : [...p.interests, i],
                    })
                  }
                />
              ))}
            </View>
            {suggestions.length ? (
              <>
                <T bold>Communities you might enjoy</T>
                {suggestions.map((s) => (
                  <T small key={s.community.id}>
                    {s.community.name}
                  </T>
                ))}
                <T small muted>
                  Suggestions only. You decide whether to join in Explore.
                </T>
              </>
            ) : null}
          </>
        ) : null}
        {stage === "Your profile" ? (
          <>
            <T heading>A little more you</T>
            <ProfileFields profile={p} privacy={v} patch={patch} />
            <T bold>Birthday celebration (optional)</T>
            <BirthdayFields
              value={p.birthday}
              onValidityChange={validBirthdaySet}
              onChange={(birthday) => patch({ birthday })}
            />
            <SwitchRow
              title="Celebrate my birthday publicly"
              detail="Only a celebration on the day, never your birthday date or age. Separate from any account age check."
              value={v.showBirthday}
              onChange={(showBirthday) => V({ ...v, showBirthday })}
            />
            {living ? (
              <SwitchRow
                title="Show experience shield"
                value={v.showShield}
                onChange={(showShield) => V({ ...v, showShield })}
              />
            ) : (
              <SwitchRow
                title="Show supporter emblem"
                value={v.showEmblem}
                onChange={(showEmblem) => V({ ...v, showEmblem })}
              />
            )}
          </>
        ) : null}
        {stage === "Welcome" ? (
          <>
            <T heading>
              You're welcome here,{" "}
              {p.displayName === "You" ? "friend" : p.displayName}.
            </T>
            <UserIdentity expanded profile={view} />
            <Notice title="Your privacy, your pace">
              Diagnosis date, birthday date and age are never public profile
              fields. Your devices stay private unless you explicitly change
              visibility in Edit profile. Nothing is joined, connected or posted
              automatically.
            </Notice>
            <Button
              kind="primary"
              label={busy ? "Saving…" : "Finish setup"}
              disabled={busy || profileStatus === "unavailable"}
              onPress={() => void finish()}
            />
          </>
        ) : null}
      </Card>
      {error ? (
        <Notice title="Check before saving" tone="error">
          {error}
        </Notice>
      ) : null}
      {stage !== "Welcome" ? (
        <>
          <Button
            kind="primary"
            label="Continue"
            disabled={
              (stage === "Journey" && !validDate) ||
              (stage === "Your profile" && !validBirthday)
            }
            onPress={() => {
              E("");
              A((n) => n + 1);
            }}
          />
          <Button label="Skip this step" onPress={skip} />
        </>
      ) : null}
      {at > 0 ? (
        <Button kind="ghost" label="Back" onPress={() => A((n) => n - 1)} />
      ) : (
        <Button
          kind="ghost"
          label="Not now"
          onPress={() => router.replace("/profile")}
        />
      )}
    </Page>
  );
}
export function Onboarding() {
  const { profileStatus, profileVersion, ready } = useDemo();
  if (!getFlags().identity) return <Redirect href="/create" />;
  if (!ready || profileStatus === "checking")
    return (
      <Page title="Your profile">
        <T>Verifying your account…</T>
      </Page>
    );
  return <OnboardingEditor key={profileVersion} />;
}
