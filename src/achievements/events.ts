// Explicit participation facts, never glucose data or inferred demo history.
import { LIFE_RULES, anniversaryHits } from "./life";
import { awardId, type Award } from "../domain/achievements";
import type { Profile } from "../domain/profile";
import { onSessionEvent } from "../services/session-events";
export const EVENT_KINDS = [
  "story_exported",
  "post_published",
  "activity_logged",
  "support_given",
  "comment_added",
  "awareness_confirmed",
  "milestone_confirmed",
  "anniversary_checked",
  "connection_confirmed",
] as const;
export type AchievementEvent = {
  id: string;
  kind: (typeof EVENT_KINDS)[number];
};
export type Cabinet = {
  awards: Award[];
  events: AchievementEvent[];
  public: boolean;
};
export const emptyCabinet = (): Cabinet => ({
  awards: [],
  events: [],
  public: false,
});
export function validEvent(v: unknown): v is AchievementEvent {
  if (!v || typeof v !== "object") return false;
  const e = v as AchievementEvent;
  return (
    typeof e.id === "string" &&
    /^[a-zA-Z0-9:_-]{1,160}$/.test(e.id) &&
    EVENT_KINDS.includes(e.kind)
  );
}
const ids: Partial<Record<AchievementEvent["kind"], string>> = {
  story_exported: "first_story",
  post_published: "first_post",
  activity_logged: "first_activity",
  support_given: "first_support",
  comment_added: "first_support",
  awareness_confirmed: "awareness_contribution",
  milestone_confirmed: "personal_milestone",
  connection_confirmed: "community_connection",
};
/** The browser reports local actions; this is not a claim of third-party verification. */
export function applyEvent(
  c: Cabinet,
  e: AchievementEvent,
  owner: string,
  now: number,
  profile?: Profile,
): Cabinet {
  if (!validEvent(e) || c.events.some((x) => x.id === e.id)) return c;
  const already = (id: string) => c.awards.some((a) => a.achievementId === id);
  // Retain only receipts needed for eligibility; never build an activity/interaction history.
  if (
    e.kind === "anniversary_checked" &&
    (profile?.role !== "living" ||
      !anniversaryHits(profile.diagnosis, now).some(
        (hit) =>
          !c.awards.some(
            (a) =>
              a.achievementId === "diagnosis_anniversary" &&
              a.periodKey === hit.periodKey,
          ),
      ))
  )
    return c;
  if (
    e.kind !== "anniversary_checked" &&
    ids[e.kind] &&
    already(ids[e.kind]!) &&
    (!(e.kind === "post_published" || e.kind === "comment_added") ||
      already("community_participation"))
  )
    return c;
  const events = [...c.events, e];
  const awards = [...c.awards];
  const add = (id: string, period = "") => {
    const def = LIFE_RULES.find((r) => r.def.id === id)?.def;
    const key = awardId(owner, id, period);
    if (!def || def.disabled || awards.some((a) => a.id === key)) return;
    awards.push({
      id: key,
      userId: owner,
      achievementId: id,
      awardedAt: now,
      periodKey: period,
      ruleVersion: def.ruleVersion,
      visibility: "private",
      pinned: false,
      relatedEvent: e.id,
    });
  };
  if (ids[e.kind]) add(ids[e.kind]!);
  // Participation means three distinct posts/comments, not merely joining a group.
  if (
    events.filter(
      (x) => x.kind === "post_published" || x.kind === "comment_added",
    ).length >= 3
  )
    add("community_participation");
  if (e.kind === "anniversary_checked" && profile?.role === "living") {
    for (const hit of anniversaryHits(profile.diagnosis, now))
      add("diagnosis_anniversary", hit.periodKey);
  }
  return { ...c, events, awards };
}
export type CabinetEdit =
  | { type: "pin"; id: string; value: boolean }
  | { type: "visibility"; id: string; value: boolean }
  | { type: "reorder"; ids: string[] }
  | { type: "public"; value: boolean };
export function editCabinet(c: Cabinet, edit: CabinetEdit): Cabinet {
  if (edit.type === "public" && typeof edit.value === "boolean")
    return { ...c, public: edit.value };
  if (edit.type === "reorder") {
    const pins = c.awards.filter((a) => a.pinned);
    if (
      !Array.isArray(edit.ids) ||
      edit.ids.length !== pins.length ||
      new Set(edit.ids).size !== pins.length ||
      edit.ids.some((id) => !pins.some((a) => a.id === id))
    )
      throw new Error("Choose the pinned medals to reorder.");
    return {
      ...c,
      awards: [
        ...edit.ids.map((id) => pins.find((a) => a.id === id)!),
        ...c.awards.filter((a) => !a.pinned),
      ],
    };
  }
  if (
    (edit.type !== "pin" && edit.type !== "visibility") ||
    typeof edit.value !== "boolean" ||
    !c.awards.some((a) => a.id === edit.id && !a.withdrawn)
  )
    throw new Error("Award not found.");
  if (
    edit.type === "pin" &&
    edit.value &&
    !c.awards.find((a) => a.id === edit.id)!.pinned &&
    c.awards.filter((a) => a.pinned).length >= 3
  )
    throw new Error("You can pin up to three medals. Unpin one first.");
  return {
    ...c,
    awards: c.awards.map((a) =>
      a.id !== edit.id
        ? a
        : edit.type === "pin"
          ? { ...a, pinned: edit.value }
          : { ...a, visibility: edit.value ? "public" : "private" },
    ),
  };
}

const listeners = new Set<(e: AchievementEvent) => void>();
export const onAchievementEvent = (fn: (e: AchievementEvent) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
let sequence = 0;
let actionScope = 0;
onSessionEvent((event, _remote, reason) => {
  if (reason === "account" && (event === "lock" || event === "check"))
    actionScope++;
});
export const captureAchievementScope = () => actionScope;
export function recordAchievementEvent(
  kind: AchievementEvent["kind"],
  id?: string,
  initiatingScope = actionScope,
) {
  if (initiatingScope !== actionScope) return;
  const event = {
    kind,
    id:
      id ??
      `${kind}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${++sequence}:${Math.random().toString(36).slice(2)}`}`,
  };
  listeners.forEach((fn) => fn(event));
}
