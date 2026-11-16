// Pulls glucose readings for one user. No scheduler: runs after connect and on explicit request.
import type { DatabaseSync } from "node:sqlite";
import type { AppDeps } from "../http";
import { dexcomFetch } from "./client";
import { DexcomError, ReconnectRequired, UnexpectedSchema } from "./errors";
import {
  normalizeEgvs,
  parseSystemTime,
  type NormalizedEgv,
} from "./normalize";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_WINDOW_MS = 30 * DAY_MS;
export const OVERLAP_MS = 6 * 60 * 60 * 1000;
export const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const FORCE_SYNC_INTERVAL_MS = 60 * 1000;
const MAX_WINDOWS = 40;

export interface SyncResult {
  fetched: number;
  stored: number;
  rejected: number;
  latestDataAt: number | null;
  windowStart: number | null;
  windowEnd: number | null;
  skipped?: boolean;
}

/** Formats as the docs' examples do: ISO 8601 UTC without a zone designator or milliseconds. */
export function formatDexcomTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export function upsertEgvs(
  db: DatabaseSync,
  userId: string,
  rows: NormalizedEgv[],
  environment: string,
  ingestedAt: number,
): void {
  if (rows.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO egvs (user_id, record_id, system_time_ms, display_time, mgdl, original_value,
       original_unit, trend, status, device, environment, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, record_id) DO UPDATE SET system_time_ms = excluded.system_time_ms,
       display_time = excluded.display_time, mgdl = excluded.mgdl, original_value = excluded.original_value,
       original_unit = excluded.original_unit, trend = excluded.trend, status = excluded.status,
       device = excluded.device, environment = excluded.environment, ingested_at = excluded.ingested_at`,
  );
  db.exec("BEGIN");
  try {
    for (const r of rows)
      stmt.run(
        userId,
        r.recordId,
        r.systemTimeMs,
        r.displayTime,
        r.mgdl,
        r.originalValue,
        r.originalUnit,
        r.trend,
        r.status,
        r.device,
        environment,
        ingestedAt,
      );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Reads egvs start/end from dataRange. The schema is NOT VERIFIED, so anything else is an error. */
export function readDataRange(body: unknown): { start: number; end: number } {
  const egvs = (body as { egvs?: unknown } | null)?.egvs as
    | { start?: { systemTime?: unknown }; end?: { systemTime?: unknown } }
    | null
    | undefined;
  const start = parseSystemTime(egvs?.start?.systemTime);
  const end = parseSystemTime(egvs?.end?.systemTime);
  if (start === null || end === null || end < start)
    throw new UnexpectedSchema();
  return { start, end };
}

/** Windows of at most 30 days, oldest first, covering [from, to). */
export function planWindows(from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  for (let s = from; s < to && out.length < MAX_WINDOWS; s += MAX_WINDOW_MS)
    out.push([s, Math.min(s + MAX_WINDOW_MS, to)]);
  return out;
}

interface SyncState {
  running: Map<string, Promise<SyncResult>>;
  last: Map<string, SyncResult>;
  forced: Map<string, number>;
}
const states = new WeakMap<DatabaseSync, SyncState>();
function stateOf(deps: AppDeps): SyncState {
  let s = states.get(deps.db);
  if (!s)
    states.set(
      deps.db,
      (s = { running: new Map(), last: new Map(), forced: new Map() }),
    );
  return s;
}

/** The sync in progress for this user, if any (lets tests and callers wait for it). */
export function syncInFlight(
  deps: AppDeps,
  userId: string,
): Promise<SyncResult> | undefined {
  return stateOf(deps).running.get(userId);
}

/** Seconds until another forced sync is allowed, or 0. Records the attempt when allowed. */
export function takeForceSlot(deps: AppDeps, userId: string): number {
  const s = stateOf(deps);
  const wait =
    (s.forced.get(userId) ?? -Infinity) + FORCE_SYNC_INTERVAL_MS - deps.now();
  if (wait > 0) return Math.ceil(wait / 1000);
  s.forced.set(userId, deps.now());
  return 0;
}

function setError(deps: AppDeps, userId: string, code: string | null): void {
  deps.db
    .prepare("UPDATE dexcom_connections SET last_error = ? WHERE user_id = ?")
    .run(code, userId);
}

export function syncUser(
  deps: AppDeps,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<SyncResult> {
  const s = stateOf(deps);
  const running = s.running.get(userId);
  if (running) return running;
  const row = deps.db
    .prepare(
      "SELECT last_sync_at, latest_data_at FROM dexcom_connections WHERE user_id = ?",
    )
    .get(userId) as
    { last_sync_at: number | null; latest_data_at: number | null } | undefined;
  if (
    !opts.force &&
    row?.last_sync_at != null &&
    deps.now() - row.last_sync_at < MIN_SYNC_INTERVAL_MS
  ) {
    const prev = s.last.get(userId) ?? {
      fetched: 0,
      stored: 0,
      rejected: 0,
      latestDataAt: row.latest_data_at,
      windowStart: null,
      windowEnd: null,
    };
    return Promise.resolve({ ...prev, skipped: true });
  }
  const p = run(deps, userId, row?.latest_data_at ?? null)
    .then((r) => {
      s.last.set(userId, r);
      return r;
    })
    .catch((e: unknown) => {
      setError(deps, userId, e instanceof DexcomError ? e.code : "sync_failed");
      throw e;
    })
    .finally(() => s.running.delete(userId));
  s.running.set(userId, p);
  return p;
}

async function run(
  deps: AppDeps,
  userId: string,
  latestDataAt: number | null,
): Promise<SyncResult> {
  const range = readDataRange(
    await dexcomFetch(deps, userId, "/v3/users/self/dataRange"),
  );
  // The range end is exclusive in egvs queries, so reach one second past the last reading.
  const end = (Math.floor(range.end / 1000) + 1) * 1000;
  const from =
    latestDataAt === null
      ? Math.max(range.start, end - MAX_WINDOW_MS)
      : Math.max(range.start, latestDataAt - OVERLAP_MS);
  const result: SyncResult = {
    fetched: 0,
    stored: 0,
    rejected: 0,
    latestDataAt,
    windowStart: null,
    windowEnd: null,
  };
  let newest = latestDataAt;
  for (const [ws, we] of planWindows(Math.floor(from / 1000) * 1000, end)) {
    const body = (await dexcomFetch(deps, userId, "/v3/users/self/egvs", {
      startDate: formatDexcomTime(ws),
      endDate: formatDexcomTime(we),
    })) as { records?: unknown } | null;
    if (
      body === null ||
      typeof body !== "object" ||
      !Array.isArray(body.records)
    )
      throw new UnexpectedSchema();
    const n = normalizeEgvs(body.records, deps.now());
    // Disconnected (and maybe wiped) while we were fetching: store nothing.
    if (
      !deps.db
        .prepare("SELECT 1 FROM dexcom_connections WHERE user_id = ?")
        .get(userId)
    )
      throw new ReconnectRequired();
    upsertEgvs(deps.db, userId, n.rows, deps.config.environment, deps.now());
    result.fetched += body.records.length;
    result.stored += n.rows.length;
    result.rejected += n.rejectedTotal;
    result.windowStart ??= ws;
    result.windowEnd = we;
    for (const r of n.rows)
      if (newest === null || r.systemTimeMs > newest) newest = r.systemTimeMs;
  }
  result.latestDataAt = newest;
  deps.db
    .prepare(
      "UPDATE dexcom_connections SET last_sync_at = ?, latest_data_at = ?, last_error = NULL WHERE user_id = ?",
    )
    .run(deps.now(), newest, userId);
  return result;
}
