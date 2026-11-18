import type { Profile, PrivacySettings } from "./domain/profile";
import type { PostReactions } from "./domain/reactions";
import type {
  Award,
  ChallengeCompletion,
  Counters,
} from "./domain/achievements";
export type Reading = {
  timestamp: number;
  mgdl: number;
  source: "mock" | "csv" | "dexcom";
};
/** Private, memory-only provider metadata. Never attach this object to a social post or telemetry. */
export type DexcomReading = Reading & {
  source: "dexcom";
  environment: "sandbox";
  sourceId: string;
  recordId: string;
  originalValue: number;
  originalUnit: "mg/dL" | "mmol/L";
  sourceSystemTime: string;
  sourceDisplayTime: string | null;
  trend: string | null;
  trendRate: number | null;
  rateUnit: string | null;
  status: "low" | "high" | null;
  device: string | null;
  deviceGeneration: string | null;
  ingestedAt: number;
};
export type Visibility = "private" | "followers" | "public";
export type Post = {
  moderated?: boolean;
  communityId?: string;
  communityName?: string;
  authorId?: string;
  isFollowing?: boolean;
  commentCount?: number;
  remote?: boolean;
  owned?: boolean;
  authorProfile?: import("./domain/profile").PublicProfile;
  media?: { uri: string; width: number; height: number; alt: string };
  id: string;
  author: string;
  title: string;
  caption: string;
  visibility: Visibility;
  /** Boosts and any later reaction kinds. Older saved posts had `kudos` and `liked`; `loadState` converts them. */
  reactions: PostReactions;
  saved: boolean;
  comments: string[];
  /** Parallel to `comments`; missing on older saved state. */
  commentAuthors?: string[];
  /** Epoch ms; missing on posts saved before times existed. */
  createdAt?: number;
  snapshot?: { average: number; tir: number; coverage: number; label: string };
};
/** A meal, activity or note the person marked after the fact. Never holds carbohydrate, insulin or dose amounts. */
export type GlucaEvent = {
  id: string;
  kind: "meal" | "activity" | "note";
  start: number; // epoch ms
  durationMin: number; // 0 for a point in time
  label?: string;
};
export type State = {
  posts: Post[];
  following: string[];
  clubs: string[];
  blocked: string[];
  reports: string[];
  unit: "mg/dL" | "mmol/L";
  range: { low: number; high: number }; // mg/dL
  dark: boolean;
  imported: Reading[];
  seenWelcome: boolean; // false only on a brand-new install, until a Welcome action is taken
  events: GlucaEvent[];
  /** Self-reported identity. Optional fields are absent until the person fills them in. */
  profile: Profile;
  /** Visibility and opt-in switches. All off until the person turns one on. */
  privacy: PrivacySettings;
  /** Earned achievements, including withdrawn ones (kept for the record, hidden in the interface). */
  awards: Award[];
  counters: Counters;
  challenges: ChallengeCompletion[];
  /** Club name to "others may see I am a member". A club that is absent is private. */
  clubVisibility: Record<string, boolean>;
};
