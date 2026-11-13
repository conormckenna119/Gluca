// Which routes and links exist for a given set of flags. Pure, so it can be tested without React Native.
// A flagged-off feature has no tab or link (see tabVisible / linkVisible) and its URL redirects (redirectFor).
import type { FlagState } from "./flags";

/** Where a blocked route lands. Create always exists, so it is the fallback and the landing tab without the feed. */
export const FALLBACK_ROUTE = "/create";

export type TabName = "index" | "glucose" | "create" | "explore" | "profile";
export type LinkName = "import" | "post" | "home";

/** Explore holds clubs and community members; it stays while either is on. */
export const exploreHasContent = (f: FlagState) => f.communityFeed || f.clubs;

export function tabVisible(tab: TabName, f: FlagState): boolean {
  if (tab === "index") return f.communityFeed;
  if (tab === "explore") return exploreHasContent(f);
  return true;
}

export function linkVisible(link: LinkName, f: FlagState): boolean {
  if (link === "import") return f.localCsvImport;
  return f.communityFeed; // "post" and "home" belong to the feed
}

/** Redirect target for a pathname, or null when the route may be shown. Query strings are ignored. */
export function redirectFor(pathname: string, f: FlagState): string | null {
  const p = ("/" + pathname.split("?")[0].replace(/^\/+|\/+$/g, "")).replace(/^\/index$/, "/");
  if (p === "/" && !f.communityFeed) return FALLBACK_ROUTE;
  if ((p === "/post" || p.startsWith("/post/")) && !f.communityFeed) return FALLBACK_ROUTE;
  if (p === "/explore" && !exploreHasContent(f)) return FALLBACK_ROUTE;
  if (p === "/import" && !f.localCsvImport) return FALLBACK_ROUTE;
  return null;
}
