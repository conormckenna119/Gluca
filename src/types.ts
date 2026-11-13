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
  snapshot?: { average: number; tir: number; coverage: number; label: string };
};
export type State = {
  posts: Post[];
  following: string[];
  clubs: string[];
  blocked: string[];
  reports: string[];
  unit: "mg/dL" | "mmol/L";
  dark: boolean;
  imported: Reading[];
};
