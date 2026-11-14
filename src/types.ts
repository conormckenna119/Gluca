export type Reading = {
  timestamp: number;
  mgdl: number;
  source: "mock" | "csv";
};
export type Visibility = "private" | "followers" | "public";
export type Post = {
  id: string;
  author: string;
  title: string;
  caption: string;
  visibility: Visibility;
  kudos: number;
  liked: boolean;
  saved: boolean;
  comments: string[];
  /** Parallel to `comments`; missing on older saved state. */
  commentAuthors?: string[];
  /** Epoch ms; missing on posts saved before times existed. */
  createdAt?: number;
  snapshot?: { average: number; tir: number; coverage: number; label: string };
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
};
