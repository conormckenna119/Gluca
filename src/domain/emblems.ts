import type { Emblem } from "./profile";

export type EmblemInfo = {
  id: Emblem;
  label: string;
  /** One short line shown under the label. */
  line: string;
  /** One sentence for the explanation sheet. */
  description: string;
  /** Spoken label for the badge. */
  a11y: string;
};

// An emblem is self-chosen and says how someone relates to diabetes. It never gives anyone
// access to another person's data, and nobody verifies it.
export const EMBLEM_TABLE: Record<Emblem, EmblemInfo> = {
  supporter: {
    id: "supporter",
    label: "Supporter",
    line: "Friends and loved ones",
    description:
      "This person chose it to say they support someone who lives with diabetes.",
    a11y: "Supporter emblem, a heart",
  },
  caregiver: {
    id: "caregiver",
    label: "Caregiver",
    line: "Parents and caregivers",
    description:
      "This person chose it to say they care for someone who lives with diabetes.",
    a11y: "Caregiver emblem, a helping hand and heart",
  },
  advocate: {
    id: "advocate",
    label: "Advocate",
    line: "Awareness and education",
    description:
      "This person chose it to say they speak up for people who live with diabetes.",
    a11y: "Advocate emblem, an awareness ribbon",
  },
};

export const EMBLEM_NONE_LABEL = "No emblem";

export const EMBLEM_NOTE =
  "An emblem is self-chosen. It does not share anyone's glucose data and it does not connect two people.";

export function emblemInfo(e: Emblem): EmblemInfo {
  return EMBLEM_TABLE[e];
}
