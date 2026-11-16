// What other people may see of a profile. Pure TypeScript. Every field is included only when its own
// switch is on; nothing is shown because information merely exists. Never includes the diagnosis date,
// the birthday date, age or interests.
import type { Award } from "./achievements";
import type { PrivacySettings, Profile, PublicProfile } from "./profile";
import { shieldFor, type LocalDate } from "./shield";

export type PublicViewExtras = {
  clubs: string[];
  clubVisibility: Record<string, boolean>;
  awards: Award[];
  today: LocalDate;
};

export function publicView(
  profile: Profile,
  privacy: PrivacySettings,
  extras: PublicViewExtras,
): PublicProfile {
  const out: PublicProfile = {
    name: profile.displayName,
    pinnedAchievements: [],
  };

  if (privacy.showShield) {
    const s = shieldFor(profile.diagnosis, extras.today);
    if (s) {
      out.shield = { tier: s.tier.id, certain: s.certain };
      if (privacy.showShieldNumber) out.shield.years = s.years;
    }
  }
  if (privacy.showEmblem && profile.emblem) out.emblem = profile.emblem;
  if (
    privacy.showDiabetesType &&
    profile.diabetesType &&
    profile.diabetesType !== "prefer_not"
  ) {
    out.diabetesType = profile.diabetesType;
  }
  if (
    privacy.showDelivery &&
    profile.delivery &&
    profile.delivery.method !== "prefer_not"
  ) {
    out.delivery = { ...profile.delivery };
  }
  if (privacy.showCgm && profile.cgm && profile.cgm.brand !== "prefer_not") {
    out.cgm = { ...profile.cgm };
  }
  const b = profile.birthday;
  if (
    privacy.showBirthday &&
    b?.month !== undefined &&
    b.day !== undefined &&
    b.month === extras.today.month &&
    b.day === extras.today.day
  ) {
    out.birthdayToday = true;
  }
  if (privacy.showMemberships) {
    const shared = extras.clubs.filter(
      (c) => extras.clubVisibility[c] === true,
    );
    if (shared.length) out.communities = shared;
  }
  out.pinnedAchievements = extras.awards
    .filter((a) => a.pinned && a.visibility === "public" && !a.withdrawn)
    .map((a) => a.id);
  return out;
}
