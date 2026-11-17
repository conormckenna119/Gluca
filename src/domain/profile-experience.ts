import type { Profile } from "./profile";
import { completedYears, localToday } from "./shield";
export const CONNECTIONS = {
  type1: "I live with Type 1 diabetes.",
  type2: "I live with Type 2 diabetes.",
  other: "I live with another type of diabetes.",
  supporter: "I'm a friend or family supporter.",
  caregiver: "I'm a caregiver.",
  awareness: "I'm interested in diabetes awareness.",
  private: "Prefer not to say.",
} as const;
export type ConnectionChoice = keyof typeof CONNECTIONS;
export function connectionChoice(p: Profile): ConnectionChoice {
  if (p.role === "living")
    return p.diabetesType === "type1"
      ? "type1"
      : p.diabetesType === "type2"
        ? "type2"
        : "other";
  return p.role === "awareness"
    ? "awareness"
    : p.role === "supporting"
      ? p.emblem === "caregiver"
        ? "caregiver"
        : "supporter"
      : "private";
}
export function chooseConnection(
  p: Profile,
  choice: ConnectionChoice,
): Profile {
  // Preserve previously entered private medical attributes; role controls whether they can be displayed.
  if (["type1", "type2", "other"].includes(choice))
    return {
      ...p,
      role: "living",
      diabetesType: choice as "type1" | "type2" | "other",
    };
  if (choice === "private")
    return {
      ...p,
      role: undefined,
      diabetesType: "prefer_not",
      emblem: undefined,
    };
  return {
    ...p,
    role: choice === "awareness" ? "awareness" : "supporting",
    emblem:
      choice === "awareness"
        ? "advocate"
        : choice === "caregiver"
          ? "caregiver"
          : "supporter",
  };
}
export function validatePublicFields(p: Profile) {
  if (p.diagnosis && !completedYears(p.diagnosis, localToday()))
    return "Choose a valid diagnosis date that is not in the future.";
  return p.username && !/^[a-z0-9_.-]{3,30}$/.test(p.username)
    ? "Use a public username of 3–30 letters, numbers, dots, dashes or underscores."
    : null;
}
