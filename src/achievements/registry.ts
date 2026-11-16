// Lookup of achievement definitions by id, built from every known rule. Pure TypeScript.
import type { AchievementDef } from "../domain/achievements";
import { ALL_RULES } from "./life";

export const ALL_DEFS: AchievementDef[] = ALL_RULES.map((r) => r.def);

export const getDef = (id: string): AchievementDef | undefined =>
  ALL_DEFS.find((d) => d.id === id);
