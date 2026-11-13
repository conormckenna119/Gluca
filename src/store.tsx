import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post, State } from "./types";
import { DEFAULT_RANGE, loadState } from "./state";
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
export const seed = (): State => ({
  posts: Array.from({ length: 24 }, (_, i): Post => ({
    id: `seed-${i}`,
    author: people[i % 10],
    title: titles[i % 6],
    caption: [
      "Made time for a walk and a conversation.",
      "Today was a lot. Grateful for this community.",
      "Celebrating a personal moment, one day at a time.",
    ][i % 3],
    visibility: "public",
    kudos: 3 + i,
    liked: false,
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
});
const Context = createContext<{
  state: State;
  set: (fn: (s: State) => State) => void;
  ready: boolean;
  storageError: string;
}>({ state: seed(), set: () => {}, ready: false, storageError: "" });
export function DemoStore({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [storageError, setError] = useState("");
  useEffect(() => {
    AsyncStorage.getItem("gluca-demo-v1")
      .then((raw) => {
        if (raw) setState(loadState(raw, seed()));
      })
      .catch(() => setError("Local storage could not be loaded."))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready)
      AsyncStorage.setItem("gluca-demo-v1", JSON.stringify(state)).catch(() =>
        setError("Changes could not be saved to this device."),
      );
  }, [state, ready]);
  return (
    <Context.Provider value={{ state, set: setState, ready, storageError }}>
      {children}
    </Context.Provider>
  );
}
export const useDemo = () => useContext(Context);
