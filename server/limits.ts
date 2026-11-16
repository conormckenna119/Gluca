import type { IncomingMessage } from "node:http";
import type { AppDeps } from "./http";
import { HttpError } from "./http";
const buckets = new WeakMap<
  AppDeps,
  Map<string, { count: number; until: number }>
>();
/** Single-instance limiter. Never trust a caller's forwarded IP or store supplied credentials. */
export function limit(
  deps: AppDeps,
  req: IncomingMessage,
  category: string,
  count = 30,
  duration = 900000,
) {
  let map = buckets.get(deps);
  if (!map) buckets.set(deps, (map = new Map()));
  const now = deps.now();
  for (const [k, v] of map) if (v.until <= now) map.delete(k);
  const key = `${category}:${req.socket.remoteAddress ?? "unknown"}`;
  let slot = map.get(key);
  if (!slot) {
    if (map.size >= 5000)
      throw new HttpError(429, "rate_limited", "Try again later.");
    map.set(key, (slot = { count: 0, until: now + duration }));
  }
  if (++slot.count > count)
    throw new HttpError(
      429,
      "rate_limited",
      "Too many attempts. Try again later.",
    );
}
