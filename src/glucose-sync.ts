// Foreground-only synchronization. No timers, logging, telemetry, public sharing or server history writes.
import type { Reading } from "./types";
import {
  DAY_MS,
  validWindow,
  intersectWindow,
  type GlucoseWindow,
  type DexcomRangeResult,
} from "./glucose-window";
import {
  MemoryGlucoseCache,
  mergeGlucose,
  mergeIntervals,
  type GlucoseCache,
  type GlucoseSnapshot,
} from "./glucose-cache";
import { GlucoseDataError } from "./services/dexcom-data";
import type { ConnectionStatus } from "./services/dexcom-oauth";
import { summarize } from "./analytics";
export interface SyncTransport {
  authorization(): Promise<ConnectionStatus>;
  range(): Promise<DexcomRangeResult>;
  readings(start: number, end: number): Promise<Reading[]>;
  cancel(): void;
}
export interface SyncConfig {
  staleMs: number;
  overlapMs: number;
  initialDays: number;
  retentionDays: number;
  minimumDayCoverage: number;
}
export const DEFAULT_SYNC: SyncConfig = {
  staleMs: 5 * 60000,
  overlapMs: DAY_MS,
  initialDays: 7,
  retentionDays: 30,
  minimumDayCoverage: 0.7,
};
export interface SyncState {
  identityVersion: number;
  connection:
    "checking" | "connected" | "disconnected" | "reconnect" | "unavailable";
  busy: boolean;
  error: string | null;
  retryAt: number;
  leaseUntil: number;
  data: GlucoseSnapshot | null;
  cacheProtection: GlucoseCache["protection"];
}
export function preferredStoryDay(
  rows: Reading[],
  now: number,
  coverage = 0.7,
) {
  const days = [
    ...new Set(rows.map((r) => Math.floor(r.timestamp / DAY_MS) * DAY_MS)),
  ].sort((a, b) => b - a);
  const complete = days.filter((d) => d + DAY_MS <= now);
  const chosen =
    complete.find(
      (d) =>
        summarize(rows, d, d + DAY_MS, 70, 180, "utc").coverage >=
        coverage * 100,
    ) ??
    complete[0] ??
    days[0];
  return chosen === undefined
    ? ""
    : new Date(chosen).toISOString().slice(0, 10);
}
export class GlucoseSync {
  private scope: string | null = null;
  private epoch = 0;
  private tail: Promise<void> = Promise.resolve();
  private flight: {
    epoch: number;
    force: boolean;
    promise: Promise<void>;
  } | null = null;
  private connectionRevision: string | null = null;
  private listeners = new Set<() => void>();
  private suspended = false;
  private failures = 0;
  private state: SyncState;
  readonly config: SyncConfig;
  constructor(
    private transport: SyncTransport,
    readonly cache: GlucoseCache = new MemoryGlucoseCache(),
    private now: () => number = Date.now,
    config: Partial<SyncConfig> = {},
  ) {
    this.config = { ...DEFAULT_SYNC, ...config };
    if (
      this.config.staleMs < 1000 ||
      this.config.overlapMs < 0 ||
      this.config.overlapMs > 30 * DAY_MS ||
      ![this.config.initialDays, this.config.retentionDays].every(
        (n) => Number.isInteger(n) && n >= 1 && n <= 30,
      ) ||
      this.config.initialDays > this.config.retentionDays ||
      this.config.minimumDayCoverage <= 0 ||
      this.config.minimumDayCoverage > 1
    )
      throw new Error("Invalid synchronization configuration.");
    this.state = {
      identityVersion: 0,
      connection: "checking",
      busy: false,
      error: null,
      retryAt: 0,
      leaseUntil: 0,
      data: null,
      cacheProtection: cache.protection,
    };
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(p: Partial<SyncState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((fn) => fn());
  }
  private queue(task: () => Promise<void>) {
    const result = this.tail.catch(() => {}).then(task);
    this.tail = result.catch(() => {});
    return result;
  }
  private valid(epoch: number) {
    return epoch === this.epoch && !this.suspended;
  }
  async invalidate() {
    this.suspended = true;
    this.epoch++;
    this.transport.cancel();
    const scope = this.scope;
    this.scope = null;
    this.update({
      identityVersion: this.state.identityVersion + 1,
      data: null,
      connection: "disconnected",
      busy: false,
      error: null,
      retryAt: 0,
      leaseUntil: 0,
    });
    if (scope) await this.cache.clear(scope);
  }
  activate(force = false) {
    this.suspended = false;
    return this.sync(force);
  }
  isPaused() {
    return this.suspended;
  }
  async clearLocal() {
    const previous = this.state.connection;
    await this.invalidate();
    this.update({ connection: previous, error: "cache_deleted" });
  }
  async expire() {
    if (this.state.leaseUntil && this.state.leaseUntil <= this.now()) {
      await this.invalidate();
      this.update({
        connection: "unavailable",
        error: "session_verification_required",
      });
    }
  }
  sync(force = false): Promise<void> {
    if (this.suspended) return Promise.resolve();
    if (this.flight?.epoch === this.epoch) {
      this.flight.force ||= force;
      return this.flight.promise;
    }
    const flight = { epoch: this.epoch, force, promise: Promise.resolve() };
    flight.promise = this.queue(async () => {
      if (!this.valid(flight.epoch)) return;
      if (this.state.retryAt > this.now()) {
        await this.expire();
        return;
      }
      this.update({ busy: true });
      try {
        if (!(await this.authorize(flight.epoch))) return;
        if (
          !flight.force &&
          this.state.data &&
          this.now() - this.state.data.lastSuccess < this.config.staleMs
        ) {
          this.update({ error: null });
          return;
        }
        const range = await this.transport.range();
        if (!this.valid(flight.epoch)) return;
        this.checkRevision(range);
        if (!range.range) {
          await this.commit(flight.epoch, {
            rows: [],
            intervals: [],
            checkpoint: 0,
            lastSuccess: this.now(),
            available: null,
          });
          return;
        }
        const end = range.range.end + 1,
          floor = Math.max(
            range.range.start,
            end - this.config.retentionDays * DAY_MS,
          );
        const previous = this.state.data;
        // Bound by retained history, not the account's entire available lifetime.
        const start = Math.max(
          floor,
          previous?.checkpoint
            ? previous.checkpoint - this.config.overlapMs
            : Math.floor(end / DAY_MS) * DAY_MS -
                (this.config.initialDays - 1) * DAY_MS,
        );
        await this.fetchWindow(
          flight.epoch,
          { start: Math.min(start, end - 1), end },
          range,
          true,
        );
      } catch (e) {
        await this.failed(e, flight.epoch);
      } finally {
        if (flight.epoch === this.epoch) this.update({ busy: false });
      }
    }).finally(() => {
      if (this.flight === flight) this.flight = null;
    });
    this.flight = flight;
    return flight.promise;
  }
  async ensureWindow(window: GlucoseWindow, force = false) {
    if (!validWindow(window)) throw new GlucoseDataError("bad_range");
    await this.sync();
    const epoch = this.epoch;
    return this.queue(async () => {
      if (
        !this.valid(epoch) ||
        this.state.connection !== "connected" ||
        this.state.retryAt > this.now()
      )
        return;
      const available = this.state.data?.available;
      const needed = available ? intersectWindow(window, available) : null;
      if (!needed) return;
      if (
        !force &&
        this.state.data?.intervals.some(
          (w) => w.start <= needed.start && w.end >= needed.end,
        )
      )
        return;
      this.update({ busy: true });
      try {
        if (!(await this.authorize(epoch))) return;
        const range = await this.transport.range();
        if (!this.valid(epoch)) return;
        this.checkRevision(range);
        // Requested historical periods outside rolling retention are fetched only on explicit selection.
        await this.fetchWindow(epoch, window, range, false);
      } catch (e) {
        await this.failed(e, epoch);
      } finally {
        if (epoch === this.epoch) this.update({ busy: false });
      }
    });
  }
  private async authorize(epoch: number) {
    const auth = await this.transport.authorization();
    if (!this.valid(epoch)) return false;
    if (!auth.connected) {
      const reconnect = auth.needsReconnect;
      await this.invalidate();
      this.suspended = false;
      this.update({
        connection: reconnect ? "reconnect" : "disconnected",
        error: reconnect ? "needs_reconnect" : null,
      });
      return false;
    }
    if (
      typeof auth.cacheScope !== "string" ||
      !/^[a-f0-9]{64}$/.test(auth.cacheScope) ||
      typeof auth.cacheValidUntil !== "number" ||
      auth.cacheValidUntil <= this.now()
    )
      throw new GlucoseDataError("unexpected_schema");
    if (typeof auth.connectionRevision !== "string" || !auth.connectionRevision)
      throw new GlucoseDataError("unexpected_schema");
    this.connectionRevision = auth.connectionRevision;
    if (this.scope !== auth.cacheScope) {
      const old = this.scope;
      this.scope = auth.cacheScope;
      this.update({
        identityVersion: this.state.identityVersion + 1,
        data: null,
      });
      if (old) await this.cache.clear(old);
      const e = await this.cache.read(auth.cacheScope);
      if (!this.valid(epoch)) return false;
      this.update({ data: e.snapshot });
    }
    this.update({ connection: "connected", leaseUntil: auth.cacheValidUntil });
    if (auth.temporaryError)
      throw new GlucoseDataError(
        auth.retryAfterSeconds ? "rate_limited" : "unavailable",
        auth.retryAfterSeconds,
      );
    return true;
  }
  private checkRevision(range: DexcomRangeResult) {
    if (range.connectionRevision !== this.connectionRevision)
      throw new GlucoseDataError("needs_reconnect");
  }
  private async fetchWindow(
    epoch: number,
    window: GlucoseWindow,
    range: DexcomRangeResult,
    advance: boolean,
  ) {
    const actual = range.range ? intersectWindow(window, range.range) : null;
    const rows = actual
      ? await this.transport.readings(actual.start, actual.end)
      : [];
    if (!this.valid(epoch)) return;
    if (
      rows.some(
        (r) =>
          r.source !== "dexcom" ||
          !("environment" in r) ||
          r.environment !== "sandbox",
      )
    )
      throw new GlucoseDataError("unexpected_schema");
    const old = this.state.data;
    const end = range.range ? range.range.end + 1 : window.end;
    // A user-selected older day remains usable until the next rolling synchronization.
    const rollingFloor = end - this.config.retentionDays * DAY_MS;
    const floor = advance ? rollingFloor : Math.min(window.start, rollingFloor);
    const merged = mergeGlucose(old?.rows ?? [], rows, floor).filter(
      (r) =>
        r.timestamp >= rollingFloor ||
        (!advance && r.timestamp >= window.start && r.timestamp < window.end),
    );
    const intervals = actual
      ? mergeIntervals(old?.intervals ?? [], actual, floor)
      : (old?.intervals ?? []);
    let kept: GlucoseWindow[] = [];
    const keep = advance
      ? [{ start: rollingFloor, end }]
      : [{ start: rollingFloor, end }, window];
    for (const w of intervals)
      for (const k of keep) {
        const part = {
          start: Math.max(w.start, k.start),
          end: Math.min(w.end, k.end),
        };
        if (part.end > part.start) kept = mergeIntervals(kept, part, floor);
      }
    await this.commit(epoch, {
      rows: merged,
      intervals: kept,
      checkpoint: advance ? end : (old?.checkpoint ?? 0),
      lastSuccess: advance ? this.now() : (old?.lastSuccess ?? 0),
      available: range.range,
    });
  }
  private async commit(epoch: number, data: GlucoseSnapshot) {
    const scope = this.scope;
    if (!scope || !this.valid(epoch)) return;
    const entry = await this.cache.read(scope);
    if (!this.valid(epoch)) return;
    if (!(await this.cache.write(scope, entry.version, data))) return;
    if (!this.valid(epoch)) return;
    this.failures = 0;
    this.update({ data, error: null, retryAt: 0 });
  }
  private async failed(error: unknown, epoch: number) {
    if (!this.valid(epoch)) return;
    const code = error instanceof GlucoseDataError ? error.code : "unavailable";
    if (["no_session", "needs_reconnect", "forbidden"].includes(code)) {
      await this.invalidate();
      this.suspended = false;
      this.update({
        connection: code === "no_session" ? "disconnected" : "reconnect",
        error: code,
      });
      return;
    }
    const wait =
      error instanceof GlucoseDataError && error.retryAfterSeconds
        ? error.retryAfterSeconds * 1000
        : Math.min(300000, 30000 * 2 ** Math.min(this.failures++, 4));
    if (this.state.leaseUntil <= this.now()) {
      const scope = this.scope;
      this.scope = null;
      this.update({ data: null });
      if (scope) await this.cache.clear(scope);
    }
    this.update({
      connection: this.state.data ? "connected" : "unavailable",
      error: code,
      retryAt: this.now() + wait,
    });
  }
}
