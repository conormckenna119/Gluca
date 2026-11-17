// Provider-independent private cache contract. No server I/O or browser persistence.
import type { Reading } from "./types";
import type { AvailableGlucoseRange, GlucoseWindow } from "./glucose-window";
export interface GlucoseSnapshot {
  rows: Reading[];
  intervals: GlucoseWindow[];
  checkpoint: number;
  lastSuccess: number;
  available: AvailableGlucoseRange | null;
}
export interface CacheEntry {
  version: number;
  snapshot: GlucoseSnapshot | null;
}
export interface GlucoseCache {
  readonly protection: "ephemeral" | "encrypted-native";
  read(scope: string): Promise<CacheEntry>;
  write(
    scope: string,
    version: number,
    snapshot: GlucoseSnapshot,
  ): Promise<boolean>;
  clear(scope: string): Promise<void>;
}
export const copySnapshot = (s: GlucoseSnapshot): GlucoseSnapshot => ({
  ...s,
  rows: s.rows.map((r) => ({ ...r })),
  intervals: s.intervals.map((w) => ({ ...w })),
  available: s.available ? { ...s.available } : null,
});
export class MemoryGlucoseCache implements GlucoseCache {
  readonly protection = "ephemeral" as const;
  private entries = new Map<string, CacheEntry>();
  async read(scope: string) {
    const e = this.entries.get(scope);
    return {
      version: e?.version ?? 0,
      snapshot: e?.snapshot ? copySnapshot(e.snapshot) : null,
    };
  }
  async write(scope: string, version: number, snapshot: GlucoseSnapshot) {
    if ((this.entries.get(scope)?.version ?? 0) !== version) return false;
    this.entries.set(scope, {
      version: version + 1,
      snapshot: copySnapshot(snapshot),
    });
    return true;
  }
  async clear(scope: string) {
    this.entries.set(scope, {
      version: (this.entries.get(scope)?.version ?? 0) + 1,
      snapshot: null,
    });
  }
}
/** Stable source IDs allow a correction to move timestamp. Equal instants keep the newest ingested record. */
export function mergeGlucose(
  old: Reading[],
  incoming: Reading[],
  floor: number,
) {
  const id = (r: Reading) =>
    "sourceId" in r && typeof r.sourceId === "string"
      ? r.source + ":" + r.sourceId
      : r.source + ":" + r.timestamp;
  const ids = new Map<string, Reading>();
  for (const r of [...old, ...incoming])
    if (
      Number.isFinite(r.timestamp) &&
      r.timestamp >= floor &&
      Number.isFinite(r.mgdl) &&
      r.mgdl >= 20 &&
      r.mgdl <= 600
    )
      ids.set(id(r), { ...r });
  const instants = new Map<number, Reading>();
  for (const r of ids.values()) {
    const previous = instants.get(r.timestamp);
    const ingestion = (x: Reading) =>
      "ingestedAt" in x && typeof x.ingestedAt === "number" ? x.ingestedAt : 0;
    if (!previous || ingestion(r) >= ingestion(previous))
      instants.set(r.timestamp, r);
  }
  return [...instants.values()].sort((a, b) => a.timestamp - b.timestamp);
}
export function mergeIntervals(
  old: GlucoseWindow[],
  incoming: GlucoseWindow,
  floor: number,
) {
  const sorted = [...old, incoming]
    .map((w) => ({ start: Math.max(floor, w.start), end: w.end }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);
  const result: GlucoseWindow[] = [];
  for (const w of sorted) {
    const last = result.at(-1);
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else result.push({ ...w });
  }
  return result;
}
