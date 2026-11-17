// Which routes and links exist for a given set of flags. Pure, so it can be tested without React Native.
// A flagged-off feature has no tab or link (see tabVisible / linkVisible) and its URL redirects (redirectFor).
import type { FlagState } from "./flags";

/** Where a blocked route lands. Create always exists, so it is the fallback and the landing tab without the feed. */
export const FALLBACK_ROUTE = "/create";

export type TabName = "index" | "glucose" | "create" | "explore" | "profile";
export type LinkName = "import" | "post" | "home" | "log";
/** Target the existing navigator keys. Resolving a new URL from a detail route can create another tab group. */
type AppNavigationState = {
  key?: string;
  index?: number;
  routes: readonly {
    name: string;
    params?: object;
    state?: AppNavigationState;
  }[];
};
export function existingTabTarget(
  state: AppNavigationState | undefined,
  name: TabName,
): {
  key: string;
  params?: object;
  pop: { key: string; count: number };
} | null {
  const index = state?.routes.findIndex((r) => r.name === "(tabs)") ?? -1;
  // SDK 58 wraps the application stack in a synthetic __root navigator.
  if (index < 0) {
    for (const route of state?.routes ?? []) {
      const found = existingTabTarget(route.state, name);
      if (found) return found;
    }
    return null;
  }
  const tabs = state?.routes[index]?.state;
  if (!tabs?.key || !state?.key) return null;
  return {
    key: tabs.key,
    params: tabs.routes.find((r) => r.name === name)?.params,
    pop: { key: state.key, count: Math.max(0, (state.index ?? 0) - index) },
  };
}
/** The only route-level exceptions. Each has a shared visible Close action. Sheets have their own Close/Cancel. */
export function primaryNavigationVisible(pathname: string) {
  return !["/account", "/welcome"].includes(
    pathname.split("?")[0].replace(/\/$/, "") || "/",
  );
}
export function primaryTabFor(pathname: string): TabName {
  const p = pathname.split("?")[0];
  if (
    p.startsWith("/profile") ||
    p === "/settings" ||
    p === "/onboarding" ||
    p === "/identity-preview" ||
    p === "/trophies"
  )
    return "profile";
  if (p === "/create") return "create";
  if (p.startsWith("/explore")) return "explore";
  if (["/glucose", "/import", "/log", "/dexcom-data"].includes(p))
    return "glucose";
  return "index";
}

/** Explore holds clubs and community members; it stays while either is on. */
export const exploreHasContent = (f: FlagState) => f.communityFeed || f.clubs;

export function tabVisible(tab: TabName, f: FlagState): boolean {
  if (tab === "index") return f.communityFeed;
  if (tab === "explore") return exploreHasContent(f);
  return true;
}

export function linkVisible(link: LinkName, f: FlagState): boolean {
  if (link === "import") return f.localCsvImport;
  if (link === "log") return f.eventLogging;
  return f.communityFeed; // "post" and "home" belong to the feed
}

/** Redirect target for a pathname, or null when the route may be shown. Query strings are ignored. */
export function redirectFor(pathname: string, f: FlagState): string | null {
  const p = ("/" + pathname.split("?")[0].replace(/^\/+|\/+$/g, "")).replace(
    /^\/index$/,
    "/",
  );
  if (p === "/" && !f.communityFeed) return FALLBACK_ROUTE;
  if ((p === "/post" || p.startsWith("/post/")) && !f.communityFeed)
    return FALLBACK_ROUTE;
  if (p === "/explore" && !exploreHasContent(f)) return FALLBACK_ROUTE;
  if (p === "/import" && !f.localCsvImport) return FALLBACK_ROUTE;
  if (p === "/log" && !f.eventLogging) return FALLBACK_ROUTE;
  return null;
}
