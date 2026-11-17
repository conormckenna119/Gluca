// The optional profile questions as data. Pure TypeScript so every branch can be tested.
// Only a display name is ever needed. Every step can be skipped. Supporters are never asked anything medical.
import {
  MAX_INTERESTS,
  sanitizeProfile,
  type CgmBrand,
  type CommunityRole,
  type DeliveryMethod,
  type DiabetesType,
  type Emblem,
  type Monitoring,
  type Birthday,
  type PartialDate,
  type Profile,
} from "./profile";

export type GlucoseUnit = "mg/dL" | "mmol/L";

export type StepId =
  | "role"
  | "diabetesType"
  | "diagnosis"
  | "monitoring"
  | "cgm"
  | "delivery"
  | "deliveryModel"
  | "emblem"
  | "birthday"
  | "units"
  | "interests"
  | "healthAchievements";

/** Everything the questions can set. `unit` and `healthAchievements` live outside `Profile`. */
export type OnboardingDraft = {
  profile: Partial<Profile>;
  unit?: GlucoseUnit;
  healthAchievements?: boolean;
};

export const PUMP_METHODS: readonly DeliveryMethod[] = [
  "tandem",
  "omnipod",
  "twiist",
  "medtronic",
  "other_pump",
];
const usesCgm = (m?: Monitoring) => m === "cgm" || m === "both";
const usesPump = (m?: DeliveryMethod) => !!m && PUMP_METHODS.includes(m);

/** The steps that apply to this draft, in order. With no role chosen, nothing medical is asked. */
export function nextSteps(draft: Partial<Profile>): StepId[] {
  const steps: StepId[] = ["role"];
  if (draft.role === "living") {
    steps.push("diabetesType", "diagnosis", "monitoring");
    if (usesCgm(draft.monitoring)) steps.push("cgm");
    steps.push("delivery");
    if (usesPump(draft.delivery?.method)) steps.push("deliveryModel");
  } else if (draft.role === "supporting" || draft.role === "awareness") {
    steps.push("emblem");
  }
  steps.push("birthday");
  if (draft.role === "living") steps.push("units");
  steps.push("interests");
  if (draft.role === "living") steps.push("healthAchievements");
  return steps;
}

export const STEP_TITLE: Record<StepId, string> = {
  role: "How do you connect with diabetes?",
  diabetesType: "Which type of diabetes?",
  diagnosis: "When were you diagnosed?",
  monitoring: "How do you check glucose?",
  cgm: "Which CGM do you use?",
  delivery: "How do you take insulin?",
  deliveryModel: "Which pump model?",
  emblem: "Would you like a supporter emblem?",
  birthday: "Your birthday",
  units: "Which glucose units?",
  interests: "What are you into?",
  healthAchievements: "Health achievements",
};
export const STEP_LABEL: Record<StepId, string> = {
  role: "About you",
  diabetesType: "Type",
  diagnosis: "Diagnosis",
  monitoring: "Monitoring",
  cgm: "CGM",
  delivery: "Insulin",
  deliveryModel: "Pump",
  emblem: "Emblem",
  birthday: "Birthday",
  units: "Units",
  interests: "Interests",
  healthAchievements: "Achievements",
};

export const ROLE_LABEL: Record<CommunityRole, string> = {
  living: "I live with diabetes",
  supporting: "I support someone with diabetes",
  awareness: "I am interested in diabetes awareness",
};
export const TYPE_LABEL: Record<DiabetesType, string> = {
  type1: "Type 1",
  type2: "Type 2",
  lada: "LADA",
  mody: "MODY",
  gestational: "Gestational",
  other: "Other",
  prefer_not: "Prefer not to say",
};
export const MONITORING_LABEL: Record<Monitoring, string> = {
  cgm: "CGM",
  meter: "Meter and strips",
  both: "CGM and meter",
  none: "Neither",
  prefer_not: "Prefer not to say",
};
export const CGM_LABEL: Record<CgmBrand, string> = {
  dexcom: "Dexcom",
  libre: "FreeStyle Libre",
  other: "Other",
  prefer_not: "Prefer not to say",
};
export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  medtronic: "Medtronic",
  syringes: "Syringes",
  none: "None",
  tandem: "Tandem pump",
  omnipod: "Omnipod",
  twiist: "twiist pump",
  other_pump: "Other pump",
  injections: "Injections",
  pens: "Pens",
  other: "Other",
  prefer_not: "Prefer not to say",
};
export const EMBLEM_NAME: Record<Emblem, string> = {
  supporter: "Supporter",
  caregiver: "Caregiver",
  advocate: "Advocate",
};

export const INTEREST_SUGGESTIONS = [
  "Running",
  "Cycling",
  "Cooking",
  "Hiking",
  "Gaming",
  "Music",
  "Art",
  "Travel",
  "Gardening",
  "Reading",
  "Swimming",
  "Photography",
].slice(0, MAX_INTERESTS);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const monthName = (m: number): string => MONTH_NAMES[m - 1] ?? "";

/** "4 March 2010", "March 2010", "2010", or "around 2010". Never adds a part that was not given. */
export function formatPartialDate(d: PartialDate): string {
  const parts = [
    d.day,
    d.month !== undefined ? monthName(d.month) : undefined,
    d.year,
  ].filter((p) => p !== undefined);
  const text = parts.join(" ");
  return d.approximate ? `around ${text}` : text;
}

export const birthdayFrom = (month: number, day: number): Birthday => ({
  month,
  day,
});
export const formatBirthday = (d: Birthday): string =>
  `${d.day} ${monthName(d.month)}`;

/** Remove answers that belong to steps the draft no longer reaches (for example after changing role). */
export function pruneDraft(draft: OnboardingDraft): OnboardingDraft {
  const steps = nextSteps(draft.profile);
  const has = (s: StepId) => steps.includes(s);
  const p: Partial<Profile> = { ...draft.profile };
  if (!has("diabetesType")) delete p.diabetesType;
  if (!has("diagnosis")) delete p.diagnosis;
  if (!has("monitoring")) delete p.monitoring;
  if (!has("cgm")) delete p.cgm;
  if (!has("delivery")) delete p.delivery;
  else if (p.delivery && !has("deliveryModel"))
    p.delivery = { method: p.delivery.method };
  if (!has("emblem")) delete p.emblem;
  const out: OnboardingDraft = { profile: p };
  if (has("units") && draft.unit) out.unit = draft.unit;
  if (has("healthAchievements") && draft.healthAchievements !== undefined) {
    out.healthAchievements = draft.healthAchievements;
  }
  return out;
}

export type OnboardingResult = {
  profile: Profile;
  unit?: GlucoseUnit;
  healthAchievements: boolean;
};

/** The saved result. Skipping everything gives a valid profile with `onboarded: true`. Health achievements stay off unless chosen. */
export function completeOnboarding(
  draft: OnboardingDraft,
  current: Profile,
): OnboardingResult {
  const pruned = pruneDraft(draft);
  const profile = sanitizeProfile({
    ...current,
    ...pruned.profile,
    displayName: pruned.profile.displayName ?? current.displayName,
    onboarded: true,
  });
  return {
    profile,
    unit: pruned.unit,
    healthAchievements: pruned.healthAchievements === true,
  };
}

/** One line per answer given, for the final summary. Skipped questions are left out. */
export function summaryLines(
  draft: OnboardingDraft,
): { label: string; value: string }[] {
  const p = pruneDraft(draft);
  const q = p.profile;
  const out: { label: string; value: string }[] = [];
  if (q.role) out.push({ label: "Connection", value: ROLE_LABEL[q.role] });
  if (q.diabetesType)
    out.push({ label: "Type", value: TYPE_LABEL[q.diabetesType] });
  if (q.diagnosis)
    out.push({ label: "Diagnosed", value: formatPartialDate(q.diagnosis) });
  if (q.monitoring)
    out.push({ label: "Monitoring", value: MONITORING_LABEL[q.monitoring] });
  if (q.cgm) {
    out.push({
      label: "CGM",
      value: [CGM_LABEL[q.cgm.brand], q.cgm.model].filter(Boolean).join(" "),
    });
  }
  if (q.delivery) {
    out.push({
      label: "Insulin",
      value: [DELIVERY_LABEL[q.delivery.method], q.delivery.model]
        .filter(Boolean)
        .join(" "),
    });
  }
  if (q.emblem) out.push({ label: "Emblem", value: EMBLEM_NAME[q.emblem] });
  if (q.birthday)
    out.push({ label: "Birthday", value: formatBirthday(q.birthday) });
  if (q.ageConfirmed) out.push({ label: "Age", value: "Confirmed" });
  if (p.unit) out.push({ label: "Units", value: p.unit });
  if (q.interests?.length)
    out.push({ label: "Interests", value: q.interests.join(", ") });
  if (p.healthAchievements !== undefined) {
    out.push({
      label: "Health achievements",
      value: p.healthAchievements ? "On" : "Off",
    });
  }
  return out;
}
