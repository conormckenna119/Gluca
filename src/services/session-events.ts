// Metadata-only invalidation. No account IDs, tokens or health values travel through this channel.
export type SessionEvent = "lock" | "check" | "purge";
export type SessionReason = "account" | "provider";
export function parseSessionMessage(
  value: unknown,
): { event: SessionEvent; reason: SessionReason } | null {
  if (value === "lock" || value === "check" || value === "purge")
    return { event: value, reason: "account" };
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return (v.event === "lock" || v.event === "check" || v.event === "purge") &&
    (v.reason === "account" || v.reason === "provider")
    ? { event: v.event, reason: v.reason }
    : null;
}
const listeners = new Set<
  (e: SessionEvent, remote: boolean, reason: SessionReason) => void
>();
export function onSessionEvent(
  fn: (e: SessionEvent, remote: boolean, reason: SessionReason) => void,
) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function sessionEvent(
  e: SessionEvent,
  remote = false,
  reason: SessionReason = "account",
) {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem("gluca-private-locked", e === "check" ? "0" : "1");
  } catch {
    /* metadata-only fallback */
  }
  listeners.forEach((fn) => fn(e, remote, reason));
}
