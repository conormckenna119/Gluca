// Lookup of achievement definitions by id, built from every known rule. Pure TypeScript.
import type { AchievementDef } from "../domain/achievements";
import { ALL_RULES } from "./life";

export const ALL_DEFS: (AchievementDef & {
  eligibility: string;
  medalDesign: {
    renderer: string;
    icon: AchievementDef["icon"];
    category: AchievementDef["category"];
  };
})[] = ALL_RULES.map((r) => ({
  ...r.def,
  eligibility: r.def.description,
  medalDesign: {
    renderer: "Medal",
    icon: r.def.icon,
    category: r.def.category,
  },
}));

export const getDef = (id: string): AchievementDef | undefined =>
  ALL_DEFS.find((d) => d.id === id);
