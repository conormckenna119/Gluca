import { COMMUNITIES } from "./communities";
import type { Profile } from "./profile";
import { shieldFor, type LocalDate } from "./shield";
export const COMMUNITY_CATEGORIES = [
  "All",
  "Devices",
  "Experience",
  "Activity",
  "Support",
] as const;
export type CommunityCategory = Exclude<
  (typeof COMMUNITY_CATEGORIES)[number],
  "All"
>;
export type CommunityDefinition = {
  id: string;
  name: string;
  blurb: string;
  category: CommunityCategory;
};
// Reuse existing stable catalogue IDs. Legacy fictional/local memberships are never uploaded.
const config: {
  id: string;
  category: CommunityCategory;
  name?: string;
  blurb?: string;
}[] = [
  { id: "dexcom-g7", category: "Devices" },
  { id: "tandem", category: "Devices" },
  { id: "omnipod", category: "Devices" },
  { id: "twiist", category: "Devices" },
  {
    id: "libre",
    category: "Devices",
    name: "Libre users",
    blurb: "Experiences with FreeStyle Libre and everyday life.",
  },
  { id: "mdi", category: "Devices" },
  {
    id: "newly-diagnosed-t1d",
    category: "Experience",
    name: "Newly diagnosed with T1D",
    blurb: "A place for first-year experiences and everyday questions.",
  },
  {
    id: "long-term-t1d",
    category: "Experience",
    name: "Long-term diabetes community",
    blurb: "Life with diabetes over the years, across diabetes types.",
  },
  {
    id: "diabetic-runners",
    category: "Activity",
    name: "Running and fitness",
    blurb:
      "Routes, movement and activities at your own pace. Supporters welcome.",
  },
  {
    id: "supporters",
    category: "Support",
    name: "Caregivers and supporters",
    blurb: "Connecting with people who support someone living with diabetes.",
  },
  { id: "parents-caregivers", category: "Support" },
  {
    id: "advocacy",
    category: "Support",
    name: "Awareness and advocacy",
    blurb: "Ideas and experiences from voluntary awareness activities.",
  },
];
export const COMMUNITY_CATALOGUE: CommunityDefinition[] = config.map((c) => {
  const existing = COMMUNITIES.find((x) => x.id === c.id);
  return {
    id: c.id,
    category: c.category,
    name: c.name ?? existing!.name,
    blurb:
      c.blurb ?? existing!.blurb.replace(/^Fictional community/, "A community"),
  };
});
export const getCommunity = (id: unknown) =>
  COMMUNITY_CATALOGUE.find((c) => c.id === id);
export function discoverCommunities(query: string, category: string = "All") {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return COMMUNITY_CATALOGUE.filter(
    (c) =>
      (category === "All" || c.category === category) &&
      terms.every((t) =>
        `${c.name} ${c.blurb} ${c.id}`.toLowerCase().includes(t),
      ),
  );
}
/** Owner-only computation. No reasons, profile attributes or glucose data leave the device. */
export function recommendedCommunityIds(
  p: Profile,
  today: LocalDate,
  joined: string[] = [],
) {
  const ids = new Set<string>(),
    interest = p.interests.join(" ").toLowerCase();
  if (p.role === "living") {
    if (p.cgm?.brand === "dexcom" && /^g\s?7$/i.test(p.cgm.model?.trim() ?? ""))
      ids.add("dexcom-g7");
    if (p.cgm?.brand === "libre") ids.add("libre");
    if (["tandem", "omnipod", "twiist"].includes(p.delivery?.method ?? ""))
      ids.add(p.delivery!.method);
    if (["injections", "pens", "syringes"].includes(p.delivery?.method ?? ""))
      ids.add("mdi");
    const years = shieldFor(p.diagnosis, today)?.years;
    if (
      p.diabetesType === "type1" &&
      p.diagnosis?.day &&
      p.diagnosis.month &&
      !p.diagnosis.approximate &&
      years === 0
    )
      ids.add("newly-diagnosed-t1d");
    if (
      p.diabetesType &&
      p.diabetesType !== "prefer_not" &&
      years !== undefined &&
      years >= 20
    )
      ids.add("long-term-t1d");
  }
  if (/run|fitness|walking|cycling|strength|swim/.test(interest))
    ids.add("diabetic-runners");
  if (p.role === "supporting") ids.add("supporters");
  if (p.emblem === "caregiver") ids.add("parents-caregivers");
  if (
    p.role === "awareness" ||
    p.emblem === "advocate" ||
    /advoca|awareness/.test(interest)
  )
    ids.add("advocacy");
  return COMMUNITY_CATALOGUE.filter(
    (c) => ids.has(c.id) && !joined.includes(c.id),
  )
    .map((c) => c.id)
    .slice(0, 4);
}
