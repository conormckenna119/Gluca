// Participation challenges. Every one can be done by anyone, including supporters, whatever their glucose does.
// No deadlines, no streaks, nothing lost for not doing one. Pure TypeScript.
import type { ChallengeCompletion, Counters } from "../domain/achievements";
import type { State } from "../types";

export type Challenge = {
  id: string;
  title: string;
  prompt: string;
  howToComplete: string;
  description: string;
  artwork: {
    icon: import("../domain/achievements").MedalIcon;
    category: "life" | "community";
  };
  eligibility: "all_accounts";
  criterion:
    "public_post" | "activity" | "awareness" | "connection" | "milestone";
  medalId: string;
  visibility: "private";
  repeatable: "once";
  flag: "communityChallenges";
  startsAt: number | null;
  endsAt: number | null;
  disabled?: boolean;
  ruleVersion: number;
};
const define = (
  d: Omit<
    Challenge,
    | "eligibility"
    | "visibility"
    | "repeatable"
    | "flag"
    | "startsAt"
    | "endsAt"
    | "ruleVersion"
    | "description"
  >,
): Challenge => ({
  ...d,
  description: d.prompt,
  eligibility: "all_accounts",
  visibility: "private",
  repeatable: "once",
  flag: "communityChallenges",
  startsAt: null,
  endsAt: null,
  ruleVersion: 1,
});
export const CHALLENGES: Challenge[] = [
  define({
    id: "share_moment",
    title: "Share a Moment",
    prompt:
      "Share a photo or story with the community. Glucose data is optional.",
    howToComplete:
      "Join, then publish a new Public post to Gluca. Private posts and exports alone do not count.",
    criterion: "public_post",
    medalId: "first_post",
    artwork: { icon: "post", category: "community" },
  }),
  define({
    id: "activity_of_choice",
    title: "Get Moving",
    prompt:
      "Choose an activity that suits you. No targets or time requirements.",
    howToComplete:
      "Join, then save an activity through Log or confirm an activity you completed. No health or activity details are needed.",
    criterion: "activity",
    medalId: "first_activity",
    artwork: { icon: "activity", category: "life" },
  }),
  define({
    id: "awareness_event",
    title: "Spread Awareness",
    prompt: "Take part in a diabetes awareness activity, in person or online.",
    howToComplete:
      "Confirm that you took part. This is self-reported, not independently verified.",
    criterion: "awareness",
    medalId: "awareness_contribution",
    artwork: { icon: "awareness", category: "community" },
  }),
  define({
    id: "helpful_experience",
    title: "Make a Connection",
    prompt:
      "Join an existing community and take part in a thoughtful exchange.",
    howToComplete:
      "Confirm you joined an existing community outside Gluca and had a meaningful exchange. Joining a group or giving a Boost alone does not establish a meaningful exchange. No group name or conversation is collected.",
    criterion: "connection",
    medalId: "community_connection",
    artwork: { icon: "community", category: "community" },
  }),
  define({
    id: "personal_milestone",
    title: "Celebrate a Milestone",
    prompt: "Mark a personal moment. You can keep it completely private.",
    howToComplete:
      "Confirm a meaningful event you chose to mark. No medical information, date or public post is required.",
    criterion: "milestone",
    medalId: "personal_milestone",
    artwork: { icon: "milestone", category: "life" },
  }),
];
export type Participation = {
  challengeId: string;
  enrollmentId: string;
  status: "joined" | "left" | "completed";
  joinedAt: number;
  leftAt?: number;
  completedAt?: number;
  visibility: "private";
  ruleVersion: number;
  source?: "verified_post" | "self_reported" | "self_reported_activity_log";
  sourceId?: string;
  communityId?: string;
  awardId?: string;
};
export function challengeAvailable(c: Challenge, now: number) {
  return (
    !c.disabled &&
    (c.startsAt === null || now >= c.startsAt) &&
    (c.endsAt === null || now < c.endsAt)
  );
}
export function enroll(
  c: Challenge,
  previous: Participation | undefined,
  now: number,
  id: string,
): Participation {
  if (!challengeAvailable(c, now))
    throw new Error("This challenge is not currently available.");
  if (previous?.status === "joined" || previous?.status === "completed")
    return previous;
  return {
    challengeId: c.id,
    enrollmentId: id,
    status: "joined",
    joinedAt: now,
    visibility: "private",
    ruleVersion: c.ruleVersion,
  };
}
export function leaveParticipation(
  p: Participation,
  enrollmentId: string,
  now: number,
): Participation {
  if (p.enrollmentId !== enrollmentId)
    throw new Error("This enrollment changed. Reload before continuing.");
  return p.status !== "joined" ? p : { ...p, status: "left", leftAt: now };
}

export const getChallenge = (id: string) => CHALLENGES.find((c) => c.id === id);

export const isChallengeDone = (state: Pick<State, "challenges">, id: string) =>
  state.challenges.some((c) => c.id === id);

/** New slice of state. Idempotent: an unknown or already completed challenge returns the same slice unchanged. */
export function completeChallenge(
  state: Pick<State, "challenges" | "counters">,
  id: string,
  now: number,
): { challenges: ChallengeCompletion[]; counters: Counters } {
  if (!getChallenge(id) || isChallengeDone(state, id))
    return { challenges: state.challenges, counters: state.counters };
  return {
    challenges: [...state.challenges, { id, completedAt: now }],
    counters: {
      ...state.counters,
      challengesCompleted: state.counters.challengesCompleted + 1,
    },
  };
}
