// Community catalogue, suggestions and membership changes. Pure TypeScript (no React Native).
// Suggestions use only what the person volunteered. Nobody is enrolled automatically: joining is an explicit tap,
// and membership is private until the person makes a club visible. Nothing here ranks or counts members.
import type { Profile } from "./profile";
import { shieldFor, type LocalDate } from "./shield";
import type { Counters } from "./achievements";

export type Community = {
  id: string;
  name: string;
  blurb: string;
  /** The reason sentence when the profile matches, or null. Uses volunteered fields only. */
  suggestWhen: (profile: Profile, today: LocalDate) => string | null;
};

export type CommunitySlice = {
  clubs: string[];
  clubVisibility: Record<string, boolean>;
  counters: Counters;
};

const living = (p: Profile) =>
  p.role !== "supporting" && p.role !== "awareness";
const years = (p: Profile, today: LocalDate) =>
  shieldFor(p.diagnosis, today)?.years;
const likes = (p: Profile, word: string) =>
  p.interests.some((i) => i.toLowerCase().includes(word));
const device = (p: Profile, method: string, label: string) =>
  living(p) && p.delivery?.method === method
    ? `Because your profile says you use ${label}`
    : null;
const interest = (p: Profile, word: string, label: string) =>
  likes(p, word) ? `Because you listed ${label} as an interest` : null;

export const COMMUNITIES: Community[] = [
  {
    id: "tandem",
    name: "Tandem users",
    blurb: "Fictional community for people who use Tandem pumps.",
    suggestWhen: (p) => device(p, "tandem", "Tandem"),
  },
  {
    id: "omnipod",
    name: "Omnipod users",
    blurb: "Fictional community for people who use Omnipod.",
    suggestWhen: (p) => device(p, "omnipod", "Omnipod"),
  },
  {
    id: "twiist",
    name: "twiist users",
    blurb: "Fictional community for people who use twiist.",
    suggestWhen: (p) => device(p, "twiist", "twiist"),
  },
  {
    id: "mdi",
    name: "Multiple daily injection users",
    blurb: "Fictional community for people who use injections or pens.",
    suggestWhen: (p) =>
      living(p) &&
      (p.delivery?.method === "injections" || p.delivery?.method === "pens")
        ? "Because your profile says you use injections or pens"
        : null,
  },
  {
    id: "dexcom-g7",
    name: "Dexcom G7 users",
    blurb: "Fictional community for people who use a Dexcom G7.",
    suggestWhen: (p) =>
      living(p) && p.cgm?.brand === "dexcom" && /g\s?7/i.test(p.cgm.model ?? "")
        ? "Because your profile says you use a Dexcom G7"
        : null,
  },
  {
    id: "newly-diagnosed-t1d",
    name: "Newly diagnosed T1Ds",
    blurb: "Fictional community for the first year with type 1.",
    suggestWhen: (p, today) => {
      const y = years(p, today);
      return living(p) && p.diabetesType === "type1" && y !== undefined && y < 1
        ? "Because your profile says type 1, diagnosed under a year ago"
        : null;
    },
  },
  {
    id: "long-term-t1d",
    name: "Long-term T1Ds",
    blurb: "Fictional community for people with many years of type 1.",
    suggestWhen: (p, today) => {
      const y = years(p, today);
      return living(p) &&
        p.diabetesType === "type1" &&
        y !== undefined &&
        y >= 20
        ? "Because your profile says type 1, diagnosed 20 or more years ago"
        : null;
    },
  },
  {
    id: "diabetic-runners",
    name: "Diabetic runners",
    blurb: "Fictional community for easy runs and shared routes.",
    suggestWhen: (p) => (living(p) ? interest(p, "run", "running") : null),
  },
  {
    id: "supporters",
    name: "Diabetes supporters",
    blurb: "Fictional community for people who support someone with diabetes.",
    suggestWhen: (p) =>
      p.role === "supporting"
        ? "Because your profile says you are supporting someone"
        : null,
  },
  {
    id: "parents-caregivers",
    name: "Parents and caregivers",
    blurb: "Fictional community for people who care for someone with diabetes.",
    suggestWhen: (p) =>
      p.emblem === "caregiver"
        ? "Because your profile says you are a caregiver"
        : null,
  },
  {
    id: "club-runners",
    name: "Type 1 Runners",
    blurb: "Fictional club for easy runs and shared routes.",
    suggestWhen: (p) => (living(p) ? interest(p, "run", "running") : null),
  },
  {
    id: "club-golf",
    name: "Diabetic Golfers",
    blurb: "Fictional club for slow rounds and good company.",
    suggestWhen: (p) => (living(p) ? interest(p, "golf", "golf") : null),
  },
  {
    id: "club-new",
    name: "Newly Diagnosed Community",
    blurb: "Fictional club for first-weeks questions and kindness.",
    suggestWhen: () => null,
  },
  {
    id: "club-tech",
    name: "Diabetes Tech Enthusiasts",
    blurb: "Fictional club for swapping gadget stories.",
    suggestWhen: (p) => (living(p) ? interest(p, "tech", "tech") : null),
  },
  {
    id: "club-strength",
    name: "T1D Strength Training",
    blurb: "Fictional club for lifting and gentle progress.",
    suggestWhen: (p) =>
      living(p) && (likes(p, "strength") || likes(p, "lifting"))
        ? "Because you listed strength training as an interest"
        : null,
  },
];

export const MAX_SUGGESTIONS = 4;
export type Suggestion = { community: Community; reason: string };

/** Pure: never changes state. At most four, in catalogue order, none already joined. */
export function suggestedFor(
  profile: Profile,
  today: LocalDate,
  joined: string[],
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const community of COMMUNITIES) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (joined.includes(community.name)) continue;
    const reason = community.suggestWhen(profile, today);
    if (reason) out.push({ community, reason });
  }
  return out;
}

/** Joining is private: visibility stays off. The counter goes up only when the club was not already joined. */
export function joinCommunity<S extends CommunitySlice>(
  state: S,
  name: string,
): S {
  if (state.clubs.includes(name)) return state;
  return {
    ...state,
    clubs: [...state.clubs, name],
    counters: {
      ...state.counters,
      communitiesJoined: state.counters.communitiesJoined + 1,
    },
    clubVisibility: { ...state.clubVisibility, [name]: false },
  };
}

/** Leaving removes the club and its visibility entry. The counter never goes down. */
export function leaveCommunity<S extends CommunitySlice>(
  state: S,
  name: string,
): S {
  const { [name]: _gone, ...rest } = state.clubVisibility;
  return {
    ...state,
    clubs: state.clubs.filter((c) => c !== name),
    clubVisibility: rest,
  };
}

/** Only a joined club can be made visible. */
export function setCommunityVisible<S extends CommunitySlice>(
  state: S,
  name: string,
  visible: boolean,
): S {
  if (!state.clubs.includes(name)) return state;
  return {
    ...state,
    clubVisibility: { ...state.clubVisibility, [name]: visible },
  };
}
