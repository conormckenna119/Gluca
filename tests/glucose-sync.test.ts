import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GlucoseSync,
  preferredStoryDay,
  type SyncTransport,
} from "../src/glucose-sync";
import {
  MemoryGlucoseCache,
  mergeGlucose,
  type GlucoseSnapshot,
} from "../src/glucose-cache";
import { GlucoseDataError } from "../src/services/dexcom-data";
import { DAY_MS, type GlucoseWindow } from "../src/glucose-window";
import type { DexcomReading } from "../src/types";
import { sandboxStory } from "../src/create-source";
const initial = Date.parse("2025-01-10T12:00:00Z"),
  scope = "a".repeat(64);
function row(
  t: number,
  id = String(t),
  value = 100,
  ingestedAt = initial,
): DexcomReading {
  return {
    source: "dexcom",
    environment: "sandbox",
    timestamp: t,
    mgdl: value,
    recordId: id,
    sourceId: id,
    originalValue: value,
    originalUnit: "mg/dL",
    sourceSystemTime: new Date(t).toISOString(),
    sourceDisplayTime: null,
    trend: "flat",
    trendRate: 0,
    rateUnit: "mg/dL/min",
    status: null,
    device: "iOS/G7",
    deviceGeneration: "g7",
    ingestedAt,
  };
}
function setup() {
  const clock = { now: initial },
    remote = {
      scope,
      revision: "r1",
      connected: true,
      reconnect: false,
      error: null as GlucoseDataError | null,
      rangeError: false,
      hold: null as Promise<void> | null,
    };
  const calls = {
    auth: 0,
    range: 0,
    windows: [] as GlucoseWindow[],
    cancel: 0,
  };
  const rows = Array.from({ length: 12 * 288 }, (_, i) =>
    row(initial - 12 * DAY_MS + i * 300000),
  );
  const transport: SyncTransport = {
    authorization: async () => {
      calls.auth++;
      if (remote.rangeError) throw new GlucoseDataError("unavailable");
      return {
        mode: "dexcom",
        environment: "sandbox",
        connected: remote.connected,
        needsReconnect: remote.reconnect,
        temporaryError: false,
        cacheScope: remote.scope,
        cacheValidUntil: clock.now + 900000,
        connectionRevision: remote.revision,
      };
    },
    range: async () => {
      calls.range++;
      return {
        source: "dexcom",
        environment: "sandbox",
        connectionRevision: remote.revision,
        range: {
          start: initial - 365 * DAY_MS,
          end: clock.now,
          sourceStart: "",
          sourceEnd: "",
        },
      };
    },
    readings: async (start, end) => {
      calls.windows.push({ start, end });
      if (remote.hold) await remote.hold;
      if (remote.error) throw remote.error;
      return rows
        .filter((r) => r.timestamp >= start && r.timestamp < end)
        .map((r) => ({ ...r, ingestedAt: clock.now }));
    },
    cancel: () => {
      calls.cancel++;
    },
  };
  const cache = new MemoryGlucoseCache(),
    engine = new GlucoseSync(transport, cache, () => clock.now, {
      staleMs: 1000,
    });
  return { clock, remote, calls, rows, transport, cache, engine };
}
test("initial sync is bounded, cache appears before revalidation, fresh foreground checks avoid EGV downloads", async () => {
  const h = setup();
  await h.engine.activate();
  assert.equal(h.calls.windows.length, 1);
  assert.ok(h.calls.windows[0].end - h.calls.windows[0].start <= 7 * DAY_MS);
  assert.ok(h.engine.snapshot().data!.rows.length > 1000);
  const old = h.engine.snapshot().data;
  await h.engine.sync();
  assert.equal(h.calls.windows.length, 1);
  assert.equal(h.engine.snapshot().data, old);
  assert.equal(h.calls.auth, 2);
});
test("incremental sync overlaps the checkpoint and upserts late arrivals and corrected record IDs", async () => {
  const h = setup();
  const late = row(initial - 3600000, "late", 110);
  await h.engine.activate();
  const checkpoint = h.engine.snapshot().data!.checkpoint;
  const corrected = h.rows.at(-3)!;
  h.rows[h.rows.length - 3] = { ...corrected, mgdl: 150, originalValue: 150 };
  h.rows.push(late);
  h.clock.now += 360000;
  await h.engine.sync();
  assert.equal(h.calls.windows[1].start, checkpoint - DAY_MS);
  const rows = h.engine.snapshot().data!.rows;
  assert.equal(rows.filter((r) => r.timestamp === late.timestamp).length, 1);
  assert.equal(
    rows.find((r) => "sourceId" in r && r.sourceId === corrected.sourceId)!
      .mgdl,
    150,
  );
  assert.equal(new Set(rows.map((r) => r.timestamp)).size, rows.length);
});
test("stable source corrections can move an instant; duplicate instants keep latest ingestion; invalid values do not fabricate samples", () => {
  const r = mergeGlucose(
    [row(100, "a"), row(200, "b")],
    [
      row(300, "a", 110, initial + 1),
      row(200, "c", 120, initial + 1),
      row(400, "bad", NaN),
    ],
    0,
  );
  assert.deepEqual(
    r.map((r) => r.timestamp),
    [200, 300],
  );
  assert.equal(r[0].mgdl, 120);
});
test("simultaneous sync calls share one operation, including manual refresh", async () => {
  const h = setup();
  await Promise.all([h.engine.sync(), h.engine.sync(true), h.engine.sync()]);
  assert.equal(h.calls.auth, 1);
  assert.equal(h.calls.windows.length, 1);
});
test("delayed uploads behind dataRange end are recovered from the overlap without re-downloading the entire history", async () => {
  const h = setup();
  h.rows.splice(h.rows.length - 12);
  await h.engine.activate();
  h.rows.push(row(initial - 300000, "delayed"));
  h.clock.now += 2000;
  await h.engine.sync();
  assert.ok(
    h.engine
      .snapshot()
      .data!.rows.some((r) => "sourceId" in r && r.sourceId === "delayed"),
  );
  assert.ok(h.calls.windows[1].end - h.calls.windows[1].start < 2 * DAY_MS);
});
test("429 backoff is respected by manual and automatic checks; a later request recovers", async () => {
  const h = setup();
  await h.engine.activate();
  const old = h.engine.snapshot().data;
  h.remote.error = new GlucoseDataError("rate_limited", 120);
  h.clock.now += 2000;
  await h.engine.sync();
  assert.equal(h.engine.snapshot().data, old);
  assert.equal(h.engine.snapshot().retryAt, h.clock.now + 120000);
  const n = h.calls.windows.length;
  await h.engine.sync(true);
  assert.equal(h.calls.windows.length, n);
  h.remote.error = null;
  h.clock.now += 120001;
  await h.engine.sync(true);
  assert.equal(h.engine.snapshot().error, null);
  assert.equal(h.engine.snapshot().retryAt, 0);
});
test("temporary offline failure retains authorized in-memory data; expired session lease purges it", async () => {
  const h = setup();
  await h.engine.activate();
  h.remote.rangeError = true;
  h.clock.now += 2000;
  await h.engine.sync();
  assert.ok(h.engine.snapshot().data?.rows.length);
  h.clock.now += 900000;
  await h.engine.expire();
  assert.equal(h.engine.snapshot().data, null);
  assert.equal((await h.cache.read(scope)).snapshot, null);
});
test("account scopes are isolated and changing accounts deletes the previous namespace", async () => {
  const h = setup();
  await h.engine.activate();
  const version = h.engine.snapshot().identityVersion;
  h.remote.scope = "b".repeat(64);
  h.remote.revision = "r2";
  h.rows.splice(0, h.rows.length, row(initial - 300000, "second-account", 180));
  h.clock.now += 2000;
  await h.engine.sync();
  assert.equal((await h.cache.read(scope)).snapshot, null);
  assert.equal(h.engine.snapshot().data!.rows.length, 1);
  assert.ok(h.engine.snapshot().identityVersion > version);
});
test("logout/disconnect invalidation wins an in-flight data response and stops future synchronization", async () => {
  const h = setup();
  let release!: () => void;
  h.remote.hold = new Promise<void>((r) => (release = r));
  const promise = h.engine.activate();
  while (!h.calls.windows.length) await new Promise((r) => setTimeout(r, 0));
  await h.engine.invalidate();
  release();
  await promise;
  assert.equal(h.engine.snapshot().data, null);
  assert.equal((await h.cache.read(scope)).snapshot, null);
  const n = h.calls.auth;
  await h.engine.sync(true);
  assert.equal(h.calls.auth, n);
});
test("revoked authorization clears private data and shows reconnect instead of mock data", async () => {
  const h = setup();
  await h.engine.activate();
  h.remote.connected = false;
  h.remote.reconnect = true;
  h.clock.now += 2000;
  await h.engine.sync();
  assert.equal(h.engine.snapshot().connection, "reconnect");
  assert.equal(h.engine.snapshot().data, null);
  assert.equal((await h.cache.read(scope)).snapshot, null);
});
test("delete history pauses automatic synchronization; explicit Sync Now can resume the valid connection", async () => {
  const h = setup();
  await h.engine.activate();
  await h.engine.clearLocal();
  assert.equal(h.engine.snapshot().error, "cache_deleted");
  assert.equal(h.engine.snapshot().data, null);
  const n = h.calls.windows.length;
  await h.engine.sync();
  assert.equal(h.calls.windows.length, n);
  await h.engine.activate(true);
  assert.ok(h.engine.snapshot().data!.rows.length);
});
test("cache compare-and-swap prevents a stale write resurrecting deleted data and survives adapter reuse", async () => {
  const cache = new MemoryGlucoseCache();
  const s: GlucoseSnapshot = {
    rows: [row(initial)],
    checkpoint: initial,
    lastSuccess: initial,
    intervals: [],
    available: null,
  };
  const e = await cache.read(scope);
  await cache.clear(scope);
  assert.equal(await cache.write(scope, e.version, s), false);
  const current = await cache.read(scope);
  assert.equal(await cache.write(scope, current.version, s), true);
  const read = await cache.read(scope);
  read.snapshot!.rows[0].mgdl = 999;
  assert.equal((await cache.read(scope)).snapshot!.rows[0].mgdl, 100);
  assert.equal((await new MemoryGlucoseCache().read(scope)).snapshot, null);
});
test("historical views reuse covered windows and limit retained extra history to the selected day", async () => {
  const h = setup();
  await h.engine.activate();
  const n = h.calls.windows.length;
  await h.engine.ensureWindow({ start: initial - DAY_MS, end: initial });
  assert.equal(h.calls.windows.length, n);
  const historic = initial - 100 * DAY_MS;
  h.rows.push(row(historic + 300000, "old-day"));
  await h.engine.ensureWindow({ start: historic, end: historic + DAY_MS });
  assert.ok(
    h.engine
      .snapshot()
      .data!.rows.some((r) => r.timestamp === historic + 300000),
  );
  await h.engine.ensureWindow({ start: historic - DAY_MS, end: historic });
  assert.ok(
    !h.engine
      .snapshot()
      .data!.rows.some((r) => r.timestamp === historic + 300000),
  );
  assert.ok(h.calls.windows.every((w) => w.end - w.start <= 30 * DAY_MS));
});
test("Create selects the latest completed adequately covered UTC day from the synchronized cache", async () => {
  const h = setup();
  await h.engine.activate();
  const data = h.engine.snapshot().data!.rows;
  const day = preferredStoryDay(data, h.clock.now);
  assert.equal(day, "2025-01-09");
  const story = sandboxStory(data, day);
  assert.ok(story.artwork.hasData);
  assert.ok(story.artwork.svg.includes("DEXCOM SANDBOX"));
  assert.ok(story.stats.count > 200);
});
test("unexpected source data never silently becomes glucose mock data", async () => {
  const h = setup();
  h.transport.readings = async () => [
    { timestamp: initial - 1000, mgdl: 100, source: "mock" },
  ];
  await h.engine.activate();
  assert.equal(h.engine.snapshot().data, null);
  assert.equal(h.engine.snapshot().error, "unexpected_schema");
});

test("restored scoped cache skips a fresh EGV request after authoritative session verification", async () => {
  const h = setup();
  await h.engine.activate();
  const downloads = h.calls.windows.length;
  const reopened = new GlucoseSync(h.transport, h.cache, () => h.clock.now);
  await reopened.activate();
  assert.ok(reopened.snapshot().data!.rows.length);
  assert.equal(h.calls.windows.length, downloads);
  assert.equal(h.calls.auth, 2);
});

test("a connection revision changed between authorization and dataRange clears the old cache", async () => {
  const h = setup();
  await h.engine.activate();
  const original = h.transport.range;
  h.transport.range = async () => ({
    ...(await original()),
    connectionRevision: "another-connection",
  });
  await h.engine.sync(true);
  assert.equal(h.engine.snapshot().connection, "reconnect");
  assert.equal(h.engine.snapshot().data, null);
  assert.equal((await h.cache.read(scope)).snapshot, null);
});

test("long offline gaps are bounded to retention and invalid configuration is rejected", async () => {
  const h = setup();
  await h.engine.activate();
  h.clock.now += 90 * DAY_MS;
  await h.engine.sync();
  const w = h.calls.windows.at(-1)!;
  assert.equal(w.end - w.start, 30 * DAY_MS);
  assert.throws(
    () =>
      new GlucoseSync(h.transport, h.cache, Date.now, { retentionDays: 31 }),
  );
  assert.throws(
    () =>
      new GlucoseSync(h.transport, h.cache, Date.now, {
        overlapMs: 31 * DAY_MS,
      }),
  );
});

test("resume after a lease expires verifies authorization before restoring private data", async () => {
  const h = setup();
  await h.engine.activate();
  h.clock.now += 900001;
  await h.engine.expire();
  assert.equal(h.engine.snapshot().data, null);
  const before = h.calls.auth;
  await h.engine.activate();
  assert.equal(h.calls.auth, before + 1);
  assert.ok(h.engine.snapshot().data!.rows.length);
});
