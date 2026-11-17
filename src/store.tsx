import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post, State } from "./types";
import { DEFAULT_RANGE, loadState } from "./state";
import { defaultPrivacy, defaultProfile } from "./domain/profile";
import { emptyCounters } from "./domain/achievements";
import {
  persistableState,
  removeLegacyPlaintextHistory,
} from "./private-persistence";
import { onSessionEvent } from "./services/session-events";
export const people = [
  "Alex Morgan",
  "Sam Rivera",
  "Priya Shah",
  "Jordan Lee",
  "Taylor Brooks",
  "Nia Williams",
  "Leo Chen",
  "Amara Okafor",
  "Morgan Ellis",
  "Jamie Patel",
];
export const clubNames = [
  "Type 1 Runners",
  "Diabetic Golfers",
  "Newly Diagnosed Community",
  "Diabetes Tech Enthusiasts",
  "T1D Strength Training",
];
const titles = [
  "A walk before work",
  "A win is a win",
  "Some days are just like this",
  "What you did not see",
  "Showing up for myself",
  "A new route with friends",
];
// Minutes before app start for the first posts; later ones step back roughly 9 hours at a time.
const SEED_AGES_MIN = [40, 180, 1500, 2100, 3000, 4400, 5900, 7300];
const seedAge = (i: number) =>
  (SEED_AGES_MIN[i] ??
    SEED_AGES_MIN[SEED_AGES_MIN.length - 1] + (i - 7) * 540) * 60_000;
export const seed = (): State => {
  const start = Date.now();
  return {
    posts: Array.from({ length: 24 }, (_, i): Post => ({
      id: `seed-${i}`,
      createdAt: start - seedAge(i),
      author: people[i % 10],
      title: titles[i % 6],
      caption: [
        "Made time for a walk and a conversation.",
        "Today was a lot. Grateful for this community.",
        "Celebrating a personal moment, one day at a time.",
      ][i % 3],
      visibility: "public",
      reactions: { counts: { boost: 3 + i }, mine: null },
      saved: false,
      comments: i % 3 ? ["Thanks for sharing this."] : [],
    })),
    following: [],
    clubs: [],
    blocked: [],
    reports: [],
    unit: "mg/dL",
    range: { ...DEFAULT_RANGE },
    dark: true,
    imported: [],
    seenWelcome: false,
    events: [],
    profile: defaultProfile(),
    privacy: defaultPrivacy(),
    awards: [],
    counters: emptyCounters(),
    challenges: [],
    clubVisibility: {},
  };
};
const Context = createContext<{
  state: State;
  set: (fn: (s: State) => State) => void;
  ready: boolean;
  storageError: string;
  privacyNotice: string;
}>({
  state: seed(),
  set: () => {},
  ready: false,
  storageError: "",
  privacyNotice: "",
});
export function DemoStore({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [storageError, setError] = useState("");
  const [privacyNotice, setPrivacyNotice] = useState("");
  useEffect(
    () =>
      onSessionEvent((e) => {
        if (e !== "check") setState((s) => ({ ...s, imported: [] }));
      }),
    [],
  );
  useEffect(() => {
    AsyncStorage.getItem("gluca-demo-v1")
      .then((raw) => {
        if (raw) {
          const cleaned = removeLegacyPlaintextHistory(raw);
          setState(loadState(cleaned.raw, seed()));
          if (cleaned.removed) {
            setPrivacyNotice(
              "For privacy, an older plaintext glucose cache was cleared. Re-import your CSV for this session; your original file was not changed.",
            );
            return AsyncStorage.setItem("gluca-demo-v1", cleaned.raw);
          }
        }
      })
      .catch(() => setError("Local storage could not be loaded."))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready)
      AsyncStorage.setItem(
        "gluca-demo-v1",
        JSON.stringify(persistableState(state)),
      ).catch(() => setError("Changes could not be saved to this device."));
  }, [state, ready]);
  return (
    <Context.Provider
      value={{ state, set: setState, ready, storageError, privacyNotice }}
    >
      {children}
    </Context.Provider>
  );
}
export const useDemo = () => useContext(Context);
