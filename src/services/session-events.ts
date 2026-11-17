// Metadata-only invalidation. No account IDs, tokens or health values travel through this channel.
export type SessionEvent = "lock" | "check" | "purge";
const listeners = new Set<(e: SessionEvent, remote: boolean) => void>();
export function onSessionEvent(fn: (e: SessionEvent, remote: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function sessionEvent(e: SessionEvent, remote = false) {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem("gluca-private-locked", e === "check" ? "0" : "1");
  } catch {
    /* metadata-only fallback */
  }
  listeners.forEach((fn) => fn(e, remote));
}
