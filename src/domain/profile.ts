// Identity and profile model. Pure TypeScript (no React Native) so it can be tested.
// Everything except `displayName` is optional, self-reported and private by default.

/** A date the person may only know partly. Never fill in a missing month or day. */
export type PartialDate = {
  year: number;
  month?: number; // 1-12
  day?: number; // 1-31, only with a month
  /** The person said they are not sure, e.g. "around 2009". */
  approximate?: boolean;
};

/** A birthday without a year. 29 February is allowed. */
export type Birthday = { month: number; day: number };

export type CommunityRole = "living" | "supporting" | "awareness";
export type DiabetesType = "type1" | "type2" | "lada" | "mody" | "gestational" | "other" | "prefer_not";
export type Emblem = "supporter" | "caregiver" | "advocate";
export type Monitoring = "cgm" | "meter" | "both" | "none" | "prefer_not";
export type CgmBrand = "dexcom" | "libre" | "other" | "prefer_not";
export type DeliveryMethod = "tandem" | "omnipod" | "twiist" | "other_pump" | "injections" | "pens" | "other" | "prefer_not";

export const COMMUNITY_ROLES: CommunityRole[] = ["living", "supporting", "awareness"];
export const DIABETES_TYPES: DiabetesType[] = ["type1", "type2", "lada", "mody", "gestational", "other", "prefer_not"];
export const EMBLEMS: Emblem[] = ["supporter", "caregiver", "advocate"];
export const MONITORING: Monitoring[] = ["cgm", "meter", "both", "none", "prefer_not"];
export const CGM_BRANDS: CgmBrand[] = ["dexcom", "libre", "other", "prefer_not"];
export const DELIVERY_METHODS: DeliveryMethod[] = ["tandem", "omnipod", "twiist", "other_pump", "injections", "pens", "other", "prefer_not"];

export const MAX_MODEL_LENGTH = 40;
export const MAX_NAME_LENGTH = 40;
export const MAX_INTERESTS = 12;

export type Profile = {
  displayName: string;
  /** False until the optional onboarding questions have been answered or skipped. */
  onboarded: boolean;
  role?: CommunityRole;
  diabetesType?: DiabetesType;
  diagnosis?: PartialDate;
  /** Month and day only, for an optional birthday celebration. No year is asked for or stored, so no age can be derived. */
  birthday?: Birthday;
  /** The person confirmed they meet the minimum age. Kept apart from `birthday` so neither needs the other. */
  ageConfirmed?: boolean;
  monitoring?: Monitoring;
  cgm?: { brand: CgmBrand; model?: string };
  delivery?: { method: DeliveryMethod; model?: string };
  emblem?: Emblem;
  interests: string[];
};

/** What the person lets other people see or lets the app do. Every switch starts off. */
export type PrivacySettings = {
  showShield: boolean;
  /** Only matters while `showShield` is on: show the number of years, or the shield alone. */
  showShieldNumber: boolean;
  showEmblem: boolean;
  showBirthday: boolean;
  showDiabetesType: boolean;
  showDelivery: boolean;
  showCgm: boolean;
  showMemberships: boolean;
  healthAchievements: boolean;
  achievementNotifications: boolean;
};
export const PRIVACY_KEYS: (keyof PrivacySettings)[] = [
  "showShield", "showShieldNumber", "showEmblem", "showBirthday", "showDiabetesType",
  "showDelivery", "showCgm", "showMemberships", "healthAchievements", "achievementNotifications",
];

export const defaultProfile = (): Profile => ({ displayName: "You", onboarded: false, interests: [] });
export const defaultPrivacy = (): PrivacySettings => ({
  showShield: false, showShieldNumber: false, showEmblem: false, showBirthday: false, showDiabetesType: false,
  showDelivery: false, showCgm: false, showMemberships: false, healthAchievements: false, achievementNotifications: false,
});

/** What another person may see of a profile once privacy settings are applied. Built by `publicView` (task 2.4). */
export type PublicProfile = {
  name: string;
  /** `certain` is false when the count comes from an approximate or partial date; the label then says "about". */
  shield?: { tier: string; years?: number; certain?: boolean };
  emblem?: Emblem;
  diabetesType?: DiabetesType;
  cgm?: { brand: CgmBrand; model?: string };
  delivery?: { method: DeliveryMethod; model?: string };
  birthdayToday?: boolean;
  communities?: string[];
  pinnedAchievements: string[];
};

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** A partial date is valid when the parts that are present make a real calendar date. A day needs a month. */
export function isValidPartialDate(d: unknown, minYear = 1900, maxYear = 2100): d is PartialDate {
  if (!d || typeof d !== "object") return false;
  const { year, month, day, approximate } = d as Record<string, unknown>;
  if (!isInt(year) || year < minYear || year > maxYear) return false;
  if (month !== undefined && (!isInt(month) || month < 1 || month > 12)) return false;
  if (day !== undefined && (month === undefined || !isInt(day) || day < 1 || day > daysIn(year, month as number))) return false;
  return approximate === undefined || typeof approximate === "boolean";
}
/** Month 1-12 and a day that exists in that month in a leap year. Any year in saved data is ignored. */
export function isValidBirthday(b: unknown): b is Birthday {
  if (!b || typeof b !== "object") return false;
  const { month, day } = b as Record<string, unknown>;
  return isInt(month) && month >= 1 && month <= 12 && isInt(day) && day >= 1 && day <= daysIn(2000, month);
}
const cleanDate = (d: unknown): PartialDate | undefined => {
  if (!isValidPartialDate(d)) return undefined;
  const out: PartialDate = { year: d.year };
  if (d.month !== undefined) out.month = d.month;
  if (d.day !== undefined) out.day = d.day;
  if (d.approximate) out.approximate = true;
  return out;
};
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};

/** Keep only well-formed fields from saved or typed data. Anything unexpected is dropped, never guessed. */
export function sanitizeProfile(raw: unknown): Profile {
  const p = defaultProfile();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return p;
  const r = raw as Record<string, unknown>;
  p.displayName = text(r.displayName, MAX_NAME_LENGTH) ?? p.displayName;
  p.onboarded = r.onboarded === true;
  const role = oneOf(COMMUNITY_ROLES, r.role);
  if (role) p.role = role;
  const type = oneOf(DIABETES_TYPES, r.diabetesType);
  if (type) p.diabetesType = type;
  const diagnosis = cleanDate(r.diagnosis);
  if (diagnosis) p.diagnosis = diagnosis;
  if (isValidBirthday(r.birthday)) p.birthday = { month: r.birthday.month, day: r.birthday.day };
  if (r.ageConfirmed === true) p.ageConfirmed = true;
  const monitoring = oneOf(MONITORING, r.monitoring);
  if (monitoring) p.monitoring = monitoring;
  const cgm = r.cgm as Record<string, unknown> | undefined;
  const brand = cgm && typeof cgm === "object" ? oneOf(CGM_BRANDS, cgm.brand) : undefined;
  if (brand) {
    const model = text(cgm!.model, MAX_MODEL_LENGTH);
    p.cgm = model ? { brand, model } : { brand };
  }
  const delivery = r.delivery as Record<string, unknown> | undefined;
  const method = delivery && typeof delivery === "object" ? oneOf(DELIVERY_METHODS, delivery.method) : undefined;
  if (method) {
    const model = text(delivery!.model, MAX_MODEL_LENGTH);
    p.delivery = model ? { method, model } : { method };
  }
  const emblem = oneOf(EMBLEMS, r.emblem);
  if (emblem) p.emblem = emblem;
  if (Array.isArray(r.interests)) {
    const seen = new Set<string>();
    for (const i of r.interests) {
      const t = text(i, MAX_MODEL_LENGTH);
      if (t && !seen.has(t) && seen.size < MAX_INTERESTS) seen.add(t);
    }
    p.interests = [...seen];
  }
  return p;
}

/** Anything that is not exactly `true` is off, so a corrupt or missing value can never publish something. */
export function sanitizePrivacy(raw: unknown): PrivacySettings {
  const out = defaultPrivacy();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const k of PRIVACY_KEYS) out[k] = (raw as Record<string, unknown>)[k] === true;
  return out;
}
