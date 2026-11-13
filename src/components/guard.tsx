import React from "react";
import { Redirect } from "expo-router";
import { getFlags } from "../flags";
import { redirectFor } from "../nav";

/**
 * Wraps a flagged route. `route` is the screen's own path, not the current URL: a tab that stays mounted behind
 * another tab must still stay blocked. With the flag off the feature never mounts and the person lands on Create.
 */
export function Guard({ route, children }: { route: "/" | "/explore" | "/import" | "/post"; children: React.ReactNode }) {
  const to = redirectFor(route, getFlags());
  return to ? <Redirect href={to as "/create"} /> : <>{children}</>;
}
