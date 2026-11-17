// Participation challenges. Every one can be done by anyone, including supporters, whatever their glucose does.
// No deadlines, no streaks, nothing lost for not doing one. Pure TypeScript.
import type { ChallengeCompletion, Counters } from "../domain/achievements";
import type { State } from "../types";

export type Challenge = {
  id: string;
  title: string;
  prompt: string;
  howToComplete: string;
};

export const CHALLENGES: Challenge[] = [
  {
    id: "share_moment",
    title: "Share a moment",
    prompt: "Share a moment from your day, if you choose.",
    howToComplete:
      "Mark it done once you have shared something you are happy to share, in your own words.",
  },
  {
    id: "awareness_event",
    title: "Take part in an awareness event",
    prompt: "Join a diabetes awareness event, in person or online.",
    howToComplete:
      "Mark it done after you have taken part in any awareness event, big or small.",
  },
  {
    id: "activity_of_choice",
    title: "An activity you choose",
    prompt:
      "Do an activity you enjoy, at a pace that suits you and your care team's guidance.",
    howToComplete:
      "Mark it done after you have done something you chose. A walk, a stretch or a dance all count.",
  },
  {
    id: "personal_milestone",
    title: "Add a personal milestone",
    prompt: "Add a date or moment that matters to you.",
    howToComplete: "Mark it done after adding your milestone.",
  },
  {
    id: "helpful_experience",
    title: "Share something that helped",
    prompt: "Share a helpful experience with the community.",
    howToComplete:
      "Mark it done after you have shared a tip or a story that might help someone else.",
  },
];

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
