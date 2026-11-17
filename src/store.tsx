import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { Platform, AppState } from "react-native";
import { getFlags } from "./flags";
import { profileRequest } from "./services/profile";
import type { Profile, PrivacySettings } from "./domain/profile";
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
  profileStatus: "checking" | "local" | "account" | "unavailable";
  saveProfile: (profile: Profile, privacy: PrivacySettings) => Promise<void>;
  reloadProfile: () => Promise<void>;
  profileVersion: number;
  hasLegacyProfile: boolean;
  reviewLegacyProfile: () => void;
}>({
  state: seed(),
  set: () => {},
  ready: false,
  storageError: "",
  privacyNotice: "",
  profileStatus: "local",
  saveProfile: async () => {},
  reloadProfile: async () => {},
  profileVersion: 0,
  hasLegacyProfile: false,
  reviewLegacyProfile: () => {},
});
export function DemoStore({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(seed);
  const [ready, setReady] = useState(false);
  const [storageError, setError] = useState("");
  const [privacyNotice, setPrivacyNotice] = useState("");
  const profileEnabled = getFlags().identity && Platform.OS === "web";
  const [profileStatus, profileStatusSet] = useState<
    "checking" | "local" | "account" | "unavailable"
  >(profileEnabled ? "checking" : "local");
  const legacy = useRef({
    profile: defaultProfile(),
    privacy: defaultPrivacy(),
  });
  const revision = useRef(0),
    epoch = useRef(0);
  const [profileVersion, versionSet] = useState(0);
  const [, calendarTick] = useState(0);
  useEffect(() => {
    if (!getFlags().identity) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      calendarTick((n) => n + 1);
      clearTimeout(timer);
      const now = new Date(),
        next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(tick, next.getTime() - now.getTime() + 100);
    };
    tick();
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") tick();
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, []);
  const reloadProfile = async () => {
    if (!profileEnabled) return;
    const version = ++epoch.current;
    versionSet((n) => n + 1);
    profileStatusSet("checking");
    try {
      const data = await profileRequest();
      if (version !== epoch.current) return;
      revision.current = data?.revision ?? 0;
      setState((s) => ({
        ...s,
        profile: data?.profile ?? defaultProfile(),
        privacy: data?.privacy ?? defaultPrivacy(),
      }));
      profileStatusSet(data ? "account" : "local");
    } catch {
      if (version === epoch.current) {
        setState((s) => ({
          ...s,
          profile: defaultProfile(),
          privacy: defaultPrivacy(),
        }));
        profileStatusSet("unavailable");
      }
    }
  };
  const saveProfile = async (profile: Profile, privacy: PrivacySettings) => {
    if (profileStatus === "checking" || profileStatus === "unavailable")
      throw new Error("Verify your account connection before saving.");
    if (profileStatus === "local") {
      setState((s) => ({ ...s, profile, privacy }));
      return;
    }
    const version = epoch.current;
    const data = await profileRequest({
      profile,
      privacy,
      revision: revision.current,
    });
    if (version !== epoch.current)
      throw new Error("Account changed. Reopen the profile editor.");
    if (data) {
      revision.current = data.revision;
      setState((s) => ({ ...s, profile: data.profile, privacy: data.privacy }));
    }
  };
  useEffect(
    () =>
      onSessionEvent((e, _remote, reason) => {
        if (e !== "check") {
          if (e === "lock" && reason === "account") {
            epoch.current++;
            revision.current = 0;
            versionSet((n) => n + 1);
            profileStatusSet("local");
          }
          setState((s) => ({
            ...s,
            imported: [],
            ...(e === "lock" && reason === "account"
              ? { profile: defaultProfile(), privacy: defaultPrivacy() }
              : {}),
          }));
        } else void reloadProfile();
      }),
    [],
  );
  useEffect(() => {
    AsyncStorage.getItem("gluca-demo-v1")
      .then((raw) => {
        if (raw) {
          const cleaned = removeLegacyPlaintextHistory(raw);
          const loaded = loadState(cleaned.raw, seed());
          legacy.current = { profile: loaded.profile, privacy: loaded.privacy };
          setState(loaded);
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
    if (ready && profileEnabled) void reloadProfile();
  }, [ready, profileEnabled]);
  useEffect(() => {
    if (ready)
      AsyncStorage.setItem(
        "gluca-demo-v1",
        JSON.stringify(persistableState(state, legacy.current)),
      ).catch(() => setError("Changes could not be saved to this device."));
  }, [state, ready]);
  return (
    <Context.Provider
      value={{
        state:
          profileStatus === "checking"
            ? { ...state, profile: defaultProfile(), privacy: defaultPrivacy() }
            : state,
        set: setState,
        ready,
        storageError,
        privacyNotice,
        profileStatus,
        saveProfile,
        reloadProfile,
        profileVersion,
        hasLegacyProfile:
          JSON.stringify(legacy.current.profile) !==
          JSON.stringify(defaultProfile()),
        reviewLegacyProfile: () => {
          setState((s) => ({
            ...s,
            profile: { ...legacy.current.profile },
            privacy: defaultPrivacy(),
          }));
          versionSet((n) => n + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useDemo = () => useContext(Context);
