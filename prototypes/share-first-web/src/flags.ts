// Feature flags for the share-first MVP.
// Unfinished or advanced features stay in the codebase but are off by default and never appear in primary navigation.
// Flags are not secrets: they may be set with a public env value, e.g. EXPO_PUBLIC_FLAGS="communityFeed,clubs=false".

export const DEFAULT_FLAGS = {
  // On: the share-first MVP
  shareFirstMvp: true,
  localCsvImport: true,
  // Off: everything beyond the MVP (see docs/FEATURE_ROADMAP.md)
  eventLogging: false,
  accounts: false,
  dexcomApi: false,
  appleHealth: false,
  glucoseTimeline: false,
  communityFeed: false,
  clubs: false,
  activities: false,
  wrapped: false,
  vizGallery: false,
} as const;

export type FlagName = keyof typeof DEFAULT_FLAGS;
export type FlagState = Record<FlagName, boolean>;

const NAMES = Object.keys(DEFAULT_FLAGS) as FlagName[];
const isFlagName = (s: string): s is FlagName => (NAMES as string[]).includes(s);

/** Parse "a,b=false,c=true". Unknown names and malformed entries are ignored. */
export function parseOverrides(raw: string | undefined): Partial<FlagState> {
  const out: Partial<FlagState> = {};
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const [name, value] = part.trim().split('=');
    if (!name || !isFlagName(name)) continue;
    if (value === undefined || value === 'true') out[name] = true;
    else if (value === 'false') out[name] = false;
  }
  return out;
}

export function resolveFlags(raw?: string): FlagState {
  return { ...DEFAULT_FLAGS, ...parseOverrides(raw) };
}

let current: FlagState = resolveFlags(undefined);

/** Call once at startup: configureFlags(process.env.EXPO_PUBLIC_FLAGS). Expo only inlines literal env accesses, so the app passes the value in. */
export function configureFlags(raw?: string): FlagState {
  current = resolveFlags(raw);
  return current;
}

export const isEnabled = (name: FlagName): boolean => current[name];
