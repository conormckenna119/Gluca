import type { State } from "./types";
/** Only explicit social snapshots/preferences persist. Raw imported CGM history remains session memory. */
export function persistableState(
  state: State,
  legacyProfile?: Pick<State, "profile" | "privacy">,
) {
  return { ...state, imported: [], ...legacyProfile };
}
export function removeLegacyPlaintextHistory(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return { raw, removed: false };
    const removed =
      Array.isArray(parsed.imported) && parsed.imported.length > 0;
    return { raw: JSON.stringify({ ...parsed, imported: [] }), removed };
  } catch {
    return { raw, removed: false };
  }
}
