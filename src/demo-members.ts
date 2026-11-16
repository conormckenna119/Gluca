// Fictional demo members, already in the shape other people would see (a `PublicProfile`): no diagnosis dates,
// nothing the person did not choose to share. All of it is invented demo information, not real health data.
import type { PublicProfile } from "./domain/profile";
import { tierForYears } from "./domain/shield";

/** A shield that shows its number, or the shield alone when `hide` is set. */
const shield = (years: number, hide = false): PublicProfile["shield"] => {
  const tier = tierForYears(years).id;
  return hide ? { tier } : { tier, years, certain: true };
};
const base = (
  name: string,
  rest: Partial<PublicProfile> = {},
): PublicProfile => ({
  name,
  pinnedAchievements: [],
  ...rest,
});

const MEMBERS: Record<string, PublicProfile> = {
  "Alex Morgan": base("Alex Morgan", {
    shield: shield(0),
    diabetesType: "type1",
    cgm: { brand: "dexcom", model: "G7" },
    delivery: { method: "omnipod" },
  }),
  "Sam Rivera": base("Sam Rivera"),
  "Priya Shah": base("Priya Shah", {
    shield: shield(2, true),
    delivery: { method: "tandem" },
  }),
  "Jordan Lee": base("Jordan Lee", {
    shield: shield(7),
    cgm: { brand: "libre" },
    delivery: { method: "injections" },
  }),
  "Taylor Brooks": base("Taylor Brooks"),
  "Nia Williams": base("Nia Williams", {
    shield: shield(12),
    emblem: "advocate",
    delivery: { method: "twiist" },
  }),
  "Leo Chen": base("Leo Chen", {
    shield: shield(22, true),
    cgm: { brand: "dexcom" },
  }),
  "Amara Okafor": base("Amara Okafor", {
    shield: shield(33),
    diabetesType: "type1",
  }),
  "Morgan Ellis": base("Morgan Ellis", { emblem: "supporter" }),
  "Jamie Patel": base("Jamie Patel", { emblem: "caregiver" }),
};

/** Deterministic. A name that is not a demo person gets a profile that shares nothing. */
export function demoMember(name: string): PublicProfile {
  const m = MEMBERS[name];
  return m ? { ...m, pinnedAchievements: [] } : base(name);
}
