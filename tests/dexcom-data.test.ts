import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEgvs,
  toReading,
  parseSystemTime,
} from "../server/dexcom/normalize";
import { parseAvailableRange, retrieveReadings } from "../server/dexcom/relay";
import {
  dexcomFetch,
  retryDelay,
  loadConnection,
} from "../server/dexcom/client";
import { FAKE, startApp, tokenOk } from "../server/testkit";
import {
  DAY_MS,
  latestWindow,
  validWindow,
  intersectWindow,
} from "../src/glucose-window";
import { DexcomGlucoseProvider } from "../src/services/dexcom-data";
import { summarize, segments, toUtcEngine } from "../src/analytics";
import { periodSummaries } from "../src/glucose-periods";
const start = Date.parse("2025-01-01T00:00:00Z"),
  now = Date.parse("2026-11-16T00:00:00Z");
const iso = (t: number) => new Date(t).toISOString().replace("Z", "");
const egv = (
  id = "synthetic-1",
  t = start,
  value: unknown = 100,
  extra: Record<string, unknown> = {},
) => ({
  recordId: id,
  systemTime: iso(t),
  displayTime: iso(t - 5 * 3600000),
  value,
  unit: "mg/dL",
  status: null,
  trend: "flat",
  trendRate: 0,
  rateUnit: "mg/dL/min",
  displayDevice: "iOS",
  displayApp: "G7",
  transmitterGeneration: "g7",
  ...extra,
});
const rangeBody = (end = start + 23 * 3600000) => ({
  recordType: "dataRange",
  recordVersion: "3.0",
  userId: "synthetic-subject",
  egvs: {
    start: { systemTime: iso(start), displayTime: iso(start) },
    end: { systemTime: iso(end), displayTime: iso(end) },
  },
  calibrations: null,
  events: null,
});
const envelope = (records: unknown) => ({
  recordType: "egv",
  recordVersion: "3.0",
  userId: "synthetic-subject",
  records,
});
const json = (b: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers });
const H = { "X-Gluca-Request": "1" };
type App = Awaited<ReturnType<typeof startApp>>;
async function authorize(a: App, cookie: string) {
  const begin = await a.call("POST", "/api/dexcom/connect", {
    cookie,
    headers: H,
  });
  const state = new URL(begin.json.authorizationUrl).searchParams.get("state");
  const r = await a.call(
    "GET",
    `/api/dexcom/callback?state=${state}&code=${FAKE.code}`,
    { cookie },
  );
  assert.equal(r.status, 302);
}
const owner = (a: App) =>
  (
    a.app.deps.db
      .prepare("SELECT user_id FROM account_credentials LIMIT 1")
      .get() as { user_id: string }
  ).user_id;
const dbCount = (a: App, table: string) =>
  Number(
    (
      a.app.deps.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
        n: number;
      }
    ).n,
  );
async function data(
  a: App,
  cookie: string,
  window = { start, end: start + DAY_MS },
) {
  const r = await a.call("GET", "/api/dexcom/data-range", { cookie });
  return a.call("POST", "/api/dexcom/egvs", {
    cookie,
    headers: H,
    body: { ...window, connectionRevision: r.json.connectionRevision },
  });
}

test("V3 normalization preserves original metadata, canonical precision and stable identifiers", () => {
  const n = normalizeEgvs(
    [egv("synthetic-1", start, 5.5, { unit: "mmol/L" })],
    now,
  );
  assert.equal(n.rows.length, 1);
  const r = toReading(n.rows[0]);
  assert.equal(r.mgdl, 5.5 * 18.0182);
  assert.equal(r.timestamp, start);
  assert.equal(r.originalValue, 5.5);
  assert.equal(r.originalUnit, "mmol/L");
  assert.equal(r.sourceSystemTime, iso(start));
  assert.equal(r.sourceDisplayTime, iso(start - 5 * 3600000));
  assert.equal(r.sourceId, "dexcom:sandbox:synthetic-1");
  assert.equal(r.ingestedAt, now);
  assert.equal(r.device, "iOS/G7");
  assert.equal(r.trend, "flat");
  assert.equal(r.deviceGeneration, "g7");
  assert.equal(r.source, "dexcom");
});
test("duplicates keep last valid record; out of order input is UTC sorted", () => {
  const n = normalizeEgvs(
    [
      egv("b", start + 300000),
      egv("a", start, 90),
      egv("a", start, 110),
      egv("a", start, null),
    ],
    now,
  );
  assert.deepEqual(
    n.rows.map((r) => r.recordId),
    ["a", "b"],
  );
  assert.equal(n.rows[0].mgdl, 110);
  assert.equal(n.duplicates, 1);
  assert.equal(n.rejectedTotal, 1);
});
test("missing/invalid values, units, timestamps, identifiers and status never become fabricated samples", () => {
  const bad = [
    egv("a", start, null),
    egv("b", start, NaN),
    egv("c", start, "100"),
    egv("d", start, 0),
    egv("e", start, 402),
    egv("f", start, 100, { unit: "unknown" }),
    egv("g", start, 100, { systemTime: "2025-02-30T00:00:00" }),
    egv("h", start, 100, { status: "high" }),
    egv("", start),
    null,
    [],
    egv("future", now + 600001),
  ];
  const n = normalizeEgvs(bad, now);
  assert.equal(n.rows.length, 0);
  assert.equal(n.rejectedTotal, bad.length);
  const limits = normalizeEgvs(
    [
      egv("lo", start, 39, { status: "low" }),
      egv("hi", start + 1, 401, { status: "high" }),
    ],
    now,
  );
  assert.deepEqual(
    limits.rows.map((r) => r.status),
    ["low", "high"],
  );
});
test("timestamp parsing handles device UTC, explicit offsets and both DST transitions without folding", () => {
  assert.equal(parseSystemTime("2025-01-01T00:00:00"), start);
  assert.equal(
    parseSystemTime("2024-11-03T01:30:00-04:00"),
    Date.parse("2024-11-03T05:30:00Z"),
  );
  assert.equal(
    parseSystemTime("2024-11-03T01:30:00-05:00"),
    Date.parse("2024-11-03T06:30:00Z"),
  );
  assert.equal(
    parseSystemTime("2025-03-09T01:55:00-05:00")! + 300000,
    parseSystemTime("2025-03-09T03:00:00-04:00"),
  );
  for (const s of [
    "2025-13-01T00:00:00",
    "2025-01-01",
    "2025-01-01T24:00:00",
    "junk",
    "2025-01-01T00:00:00+99:99",
  ])
    assert.equal(parseSystemTime(s), null);
});
test("historical ranges validate envelope and null history without assuming today", () => {
  const r = parseAvailableRange(rangeBody());
  assert.equal(r.range!.start, start);
  assert.ok(latestWindow(r.range!, 1).end < now);
  assert.equal(latestWindow(r.range!, 1).end, r.range!.end + 1);
  assert.equal(parseAvailableRange({ ...rangeBody(), egvs: null }).range, null);
  for (const b of [
    {},
    null,
    { ...rangeBody(), recordType: "egv" },
    { ...rangeBody(), recordVersion: "2.0" },
    {
      ...rangeBody(),
      egvs: { start: { systemTime: "bad" }, end: { systemTime: iso(start) } },
    },
  ])
    assert.throws(() => parseAvailableRange(b), /shape/);
});
test("query windows enforce positive intervals, 30-day cap and exclusive end including last sample", () => {
  assert.ok(validWindow({ start, end: start + 30 * DAY_MS }));
  for (const end of [start, start - 1, start + 30 * DAY_MS + 1, NaN, Infinity])
    assert.equal(validWindow({ start, end }), false);
  const range = parseAvailableRange(rangeBody()).range!;
  assert.deepEqual(
    intersectWindow({ start: start - 100, end: start + 1 }, range),
    { start, end: start + 1 },
  );
  assert.equal(
    intersectWindow({ start: start - DAY_MS, end: start }, range),
    null,
  );
  assert.throws(() => latestWindow(range, 31));
});
test("authenticated relay retrieves historical V3 data, filters partial input, reuses analytics and never persists raw readings", async () => {
  const a = await startApp({ diagnosticsEnabled: true }, (url) =>
    url.includes("/token")
      ? tokenOk()
      : json(
          url.includes("/dataRange")
            ? rangeBody()
            : envelope([
                egv("b", start + 300000, 200),
                egv("a", start, 50),
                egv("a", start, 100),
                egv("null", start, null),
                egv("outside", start - DAY_MS),
              ]),
        ),
  );
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    const r = await data(a, cookie);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(r.json.readings.length, 2);
    assert.equal(r.json.rejectedCount, 1);
    assert.equal(r.json.duplicateCount, 1);
    assert.equal(r.json.outsideWindowCount, 1);
    assert.equal(r.json.window.end, start + DAY_MS);
    const stats = summarize(
      r.json.readings,
      start,
      start + DAY_MS,
      70,
      180,
      "utc",
    );
    assert.equal(stats.average, 150);
    assert.equal(stats.tir, 50);
    assert.equal(stats.above, 50);
    assert.equal(stats.below, 0);
    assert.equal(stats.count, 2);
    assert.equal(stats.covered, 600000);
    assert.ok(stats.coverage < 1);
    assert.equal(dbCount(a, "egvs"), 0);
    assert.equal(dbCount(a, "dexcom_connections"), 1);
    const text = r.text + a.logs.join("");
    for (const secret of [
      FAKE.access,
      FAKE.refresh,
      FAKE.clientSecret,
      "synthetic-subject",
      "synthetic-1",
    ])
      assert.ok(!text.includes(secret));
    const req = new URL(a.calls.find((c) => c.url.includes("/egvs"))!.url);
    assert.equal(req.searchParams.get("startDate"), "2025-01-01T00:00:00.000");
    assert.equal(
      req.searchParams.get("endDate"),
      new Date(start + 23 * 3600000 + 1).toISOString().slice(0,-1),
    );
    assert.ok(
      a.calls
        .filter((c) => c.url.includes("/users/"))
        .every((c) => c.auth === `Bearer ${FAKE.access}`),
    );
  } finally {
    await a.close();
  }
});
test("unauthenticated, other owner, stale revision and CSRF requests cannot access a connection", async () => {
  const a = await startApp({ diagnosticsEnabled: true }, (url) =>
    url.includes("/token") ? tokenOk() : json(rangeBody()),
  );
  try {
    assert.equal((await a.call("GET", "/api/dexcom/data-range")).status, 401);
    const alice = await a.login();
    await authorize(a, alice);
    const r = await a.call("GET", "/api/dexcom/data-range", { cookie: alice });
    const bob = await a.login();
    const n = a.calls.length;
    assert.equal(
      (await a.call("GET", "/api/dexcom/data-range", { cookie: bob })).status,
      409,
    );
    assert.equal(a.calls.length, n);
    for (const cookie of [alice, bob]) {
      assert.equal(
        (
          await a.call("POST", "/api/dexcom/egvs", {
            cookie,
            headers: H,
            body: {
              start,
              end: start + DAY_MS,
              connectionRevision:
                cookie === alice ? "stale" : r.json.connectionRevision,
            },
          })
        ).status,
        409,
      );
    }
    assert.equal(
      (await a.call("POST", "/api/dexcom/egvs", { cookie: alice, body: {} }))
        .status,
      403,
    );
    assert.equal(
      (
        await a.call("POST", "/api/dexcom/egvs", {
          cookie: alice,
          headers: { ...H, Origin: "https://evil.test" },
          body: {},
        })
      ).status,
      403,
    );
    for (const end of [start, start + 31 * DAY_MS])
      assert.equal(
        (
          await a.call("POST", "/api/dexcom/egvs", {
            cookie: alice,
            headers: H,
            body: { start, end, connectionRevision: r.json.connectionRevision },
          })
        ).status,
        400,
      );
  } finally {
    await a.close();
  }
});
test("diagnostics are default-off and refused in production, including the viewer URL", async () => {
  for (const config of [
    {},
    { diagnosticsEnabled: true, nodeEnvironment: "production" },
  ]) {
    const a = await startApp(config);
    try {
      const cookie = await a.login();
      for (const route of ["/api/dexcom/data-range", "/dexcom-data"])
        assert.equal((await a.call("GET", route, { cookie })).status, 404);
      assert.equal(a.calls.length, 0);
    } finally {
      await a.close();
    }
  }
});
test("empty account and nonoverlapping period return empty data without an EGV request", async () => {
  for (const absent of [false, true]) {
    const a = await startApp({ diagnosticsEnabled: true }, (url) =>
      url.includes("/token")
        ? tokenOk()
        : json({ ...rangeBody(), ...(absent ? { egvs: null } : {}) }),
    );
    try {
      const cookie = await a.login();
      await authorize(a, cookie);
      const r = await data(a, cookie, {
        start: start - 2 * DAY_MS,
        end: start - DAY_MS,
      });
      assert.equal(r.status, 200);
      assert.equal(r.json.readings.length, 0);
      assert.ok(!a.calls.some((c) => c.url.includes("/egvs")));
    } finally {
      await a.close();
    }
  }
});
test("expired access token refreshes securely and rotates before any data request", async () => {
  const a = await startApp({ diagnosticsEnabled: true }, (url, init) =>
    url.includes("/token")
      ? String(init?.body).includes("refresh_token=")
        ? json({
            access_token: "rotated-access",
            refresh_token: "rotated-refresh",
            token_type: "Bearer",
            expires_in: 7200,
          })
        : tokenOk()
      : json(rangeBody()),
  );
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    a.app.deps.db
      .prepare("UPDATE dexcom_connections SET access_expires_at=0")
      .run();
    assert.equal(
      (await a.call("GET", "/api/dexcom/data-range", { cookie })).status,
      200,
    );
    assert.equal(a.calls.filter((c) => c.url.includes("/token")).length, 2);
    assert.equal(a.calls.at(-1)!.auth, "Bearer rotated-access");
    assert.ok(
      !JSON.stringify(loadConnection(a.app.deps, owner(a))).includes(
        "rotated-refresh",
      ),
    );
  } finally {
    await a.close();
  }
});
test("upstream 401 retries once after refresh; repeated rejection requires reconnect", async () => {
  for (const revoked of [false, true]) {
    let reads = 0;
    const a = await startApp({ diagnosticsEnabled: true }, (url, init) =>
      url.includes("/token")
        ? String(init?.body).includes("refresh_token=")
          ? json({
              access_token: "new-access",
              refresh_token: "new-refresh",
              token_type: "Bearer",
              expires_in: 7200,
            })
          : tokenOk()
        : ++reads === 1 || revoked
          ? json({ private: "never forward" }, 401)
          : json(rangeBody()),
    );
    try {
      const cookie = await a.login();
      await authorize(a, cookie);
      const r = await a.call("GET", "/api/dexcom/data-range", { cookie });
      assert.equal(r.status, revoked ? 409 : 200);
      assert.equal(reads, 2);
      if (revoked) {
        assert.equal(r.json.error, "needs_reconnect");
        assert.equal(
          loadConnection(a.app.deps, owner(a))!.access_token_enc,
          "",
        );
      }
    } finally {
      await a.close();
    }
  }
});
test("429 honors Retry-After, backs off and never forwards private upstream errors", async () => {
  const a = await startApp({ diagnosticsEnabled: true }, (url) =>
    url.includes("/token")
      ? tokenOk()
      : json({ secret: "sensitive upstream" }, 429, { "Retry-After": "120" }),
  );
  try {
    const cookie = await a.login();
    await authorize(a, cookie);
    const r = await a.call("GET", "/api/dexcom/data-range", { cookie });
    assert.equal(r.status, 429);
    assert.equal(r.headers.get("retry-after"), "120");
    assert.equal(r.json.retryAfterSeconds, 120);
    const n = a.calls.length;
    assert.equal(
      (await a.call("GET", "/api/dexcom/data-range", { cookie })).status,
      429,
    );
    assert.equal(a.calls.length, n);
    assert.ok(!r.text.includes("sensitive"));
    assert.equal(
      retryDelay(
        json({}, 429, {
          "Retry-After": new Date(a.clock.now + 120000).toUTCString(),
        }),
        a.clock.now,
      ),
      120,
    );
  } finally {
    await a.close();
  }
});
test("malformed envelopes, mismatched subjects, invalid JSON and API failures are safe errors", async () => {
  const cases = [
    { body: envelope([]), status: 200, expected: 502, atRange: true },
    {
      body: { ...envelope([]), userId: "someone-else" },
      status: 200,
      expected: 502,
    },
    { body: { ...envelope([]), records: null }, status: 200, expected: 502 },
    { body: "not-json", status: 200, expected: 502 },
    { body: { secret: "private" }, status: 403, expected: 403 },
    { body: { secret: "private" }, status: 500, expected: 503 },
  ];
  for (const c of cases) {
    const a = await startApp({ diagnosticsEnabled: true }, (url) =>
      url.includes("/token")
        ? tokenOk()
        : url.includes("/dataRange") && !c.atRange
          ? json(rangeBody())
          : typeof c.body === "string"
            ? new Response(c.body)
            : json(c.body, c.status),
    );
    try {
      const cookie = await a.login();
      await authorize(a, cookie);
      const r = c.atRange
        ? await a.call("GET", "/api/dexcom/data-range", { cookie })
        : await data(a, cookie);
      assert.equal(r.status, c.expected);
      assert.ok(!r.text.includes("private"));
      assert.equal(dbCount(a, "egvs"), 0);
    } finally {
      await a.close();
    }
  }
});
test("disconnect or logout while awaiting upstream data prevents releasing the response", async () => {
  for (const action of ["disconnect", "logout"]) {
    let release!: () => void;
    let entered!: () => void;
    const pending = new Promise<void>((r) => (entered = r));
    const wait = new Promise<void>((r) => (release = r));
    const a = await startApp({ diagnosticsEnabled: true }, async (url) => {
      if (url.includes("/token")) return tokenOk();
      entered();
      await wait;
      return json(rangeBody());
    });
    try {
      const cookie = await a.login();
      await authorize(a, cookie);
      const request = a.call("GET", "/api/dexcom/data-range", { cookie });
      await pending;
      await a.call(
        "POST",
        action === "disconnect"
          ? "/api/dexcom/disconnect"
          : "/api/session/logout",
        { cookie, headers: H },
      );
      release();
      const r = await request;
      assert.ok([401, 409].includes(r.status));
      assert.ok(!r.text.includes("2025"));
    } finally {
      release();
      await a.close();
    }
  }
});
test("direct data client refuses arbitrary paths, extra parameters and overlong windows", async () => {
  const a = await startApp({ diagnosticsEnabled: true });
  try {
    for (const [path, params] of [
      ["https://evil.test", {}],
      ["/v3/users/self/dataRange", { x: "1" }],
      [
        "/v3/users/self/egvs",
        { startDate: iso(start), endDate: iso(start + 31 * DAY_MS) },
      ],
    ] as [string, Record<string, string>][]) {
      await assert.rejects(dexcomFetch(a.app.deps, "absent", path, params));
    }
    assert.equal(a.calls.length, 0);
  } finally {
    await a.close();
  }
});
test("UTC analytics preserve repeated fall-back instants and real spring-forward duration", () => {
  const fall = ["2024-11-03T01:30:00-04:00", "2024-11-03T01:30:00-05:00"].map(
    (t) =>
      toReading(
        normalizeEgvs(
          [egv(t.includes("-04:00") ? "a" : "b", Date.parse(t))],
          now,
        ).rows[0],
      ),
  );
  assert.equal(toUtcEngine(fall).length, 2);
  assert.equal(
    summarize(
      fall,
      fall[0].timestamp,
      fall[1].timestamp + 300000,
      70,
      180,
      "utc",
    ).covered,
    600000,
  );
  assert.equal(
    segments(
      fall,
      fall[0].timestamp,
      fall[1].timestamp + 300000,
      900,
      300,
      "utc",
    ).length,
    2,
  );
  const s = Date.parse("2025-03-09T01:55:00-05:00");
  const spring = [
    toReading(normalizeEgvs([egv("a", s)], now).rows[0]),
    toReading(normalizeEgvs([egv("b", s + 300000)], now).rows[0]),
  ];
  assert.equal(summarize(spring, s, s + 600000, 70, 180, "utc").coverage, 100);
});
test("daily and weekly partial periods use full UTC calendar denominators, missing data is not in range", () => {
  const rows = normalizeEgvs(
    [egv("a", start), egv("b", start + 300000, 200)],
    now,
  ).rows.map(toReading);
  const w = { start, end: start + 3600000 };
  const d = periodSummaries(rows, w, "day")[0],
    week = periodSummaries(rows, w, "week")[0];
  assert.equal(d.fullyRequested, false);
  assert.equal(d.stats.covered, 600000);
  assert.ok(Math.abs(d.stats.coverage - (600000 / DAY_MS) * 100) < 1e-9);
  assert.ok(week.stats.coverage < d.stats.coverage);
  assert.equal(new Date(week.start).getUTCDay(), 1);
  assert.equal(summarize([], start, start + DAY_MS, 70, 180, "utc").tir, 0);
});
test("provider uses authenticated relay, remains memory-only and clears data on session changes/errors", async () => {
  let failure = false;
  const calls: { url: string; init?: RequestInit }[] = [];
  const r = parseAvailableRange(rangeBody()).range!;
  const p = new DexcomGlucoseProvider((async (url, init) => {
    calls.push({ url: String(url), init });
    if (failure) return json({ error: "no_session" }, 401);
    return json(
      String(url).endsWith("data-range")
        ? {
            source: "dexcom",
            environment: "sandbox",
            range: r,
            connectionRevision: "revision",
          }
        : {
            source: "dexcom",
            environment: "sandbox",
            range: r,
            connectionRevision: "revision",
            window: JSON.parse(String(init?.body)),
            readings: normalizeEgvs([egv()], now).rows.map(toReading),
            retrievedAt: now,
            receivedCount: 1,
            rejectedCount: 0,
            duplicateCount: 0,
            outsideWindowCount: 0,
          },
    );
  }) as typeof fetch);
  assert.equal(calls.length, 0);
  const result = await p.loadLatest(1);
  assert.equal(result!.readings.length, 1);
  assert.ok(p.connected);
  assert.ok(
    calls.every(
      (c) =>
        c.init?.credentials === "include" &&
        c.init?.cache === "no-store" &&
        !JSON.stringify(c.init).includes("Bearer"),
    ),
  );
  failure = true;
  await assert.rejects(p.loadLatest(1), /no_session/);
  assert.equal(p.lastResult, null);
  p.clear();
  assert.equal(p.availableRange, null);
  assert.equal(p.connected, false);
});
test("clearing provider while a response is pending discards late private data", async () => {
  let release!: (r: Response) => void;
  const p = new DexcomGlucoseProvider(
    (() => new Promise<Response>((r) => (release = r))) as typeof fetch,
  );
  const request = p.getAvailableRange();
  p.clear();
  release(
    json({
      source: "dexcom",
      environment: "sandbox",
      range: parseAvailableRange(rangeBody()).range,
      connectionRevision: "r",
    }),
  );
  await assert.rejects(request, /no_session/);
  assert.equal(p.lastResult, null);
  assert.equal(p.availableRange, null);
});

test("network failures and oversized upstream responses fail closed without raw persistence", async () => {
  for (const oversized of [false, true]) {
    const a = await startApp({ diagnosticsEnabled: true }, (url) => {
      if (url.includes("/token")) return tokenOk();
      if (!oversized) throw new Error("private network details");
      return new Response(" ".repeat(8 * 1024 * 1024 + 1));
    });
    try {
      const cookie = await a.login();
      await authorize(a, cookie);
      const r = await a.call("GET", "/api/dexcom/data-range", { cookie });
      assert.equal(r.status, oversized ? 502 : 503);
      assert.ok(!r.text.includes("private"));
      assert.equal(dbCount(a, "egvs"), 0);
    } finally {
      await a.close();
    }
  }
});

test("provider validates backend schema, canonical measurements and requested interval before returning data", async () => {
  const range = parseAvailableRange(rangeBody()).range;
  for (const bad of [
    null,
    {
      source: "dexcom",
      environment: "production",
      range,
      connectionRevision: "r",
    },
    {
      source: "dexcom",
      environment: "sandbox",
      range: { start: 10, end: 0 },
      connectionRevision: "r",
    },
  ]) {
    const p = new DexcomGlucoseProvider((async () =>
      json(bad)) as typeof fetch);
    await assert.rejects(p.getAvailableRange(), /unexpected_schema/);
    assert.equal(p.lastResult, null);
  }
  let n = 0;
  const p = new DexcomGlucoseProvider((async () => {
    n++;
    return json({
      source: "dexcom",
      environment: "sandbox",
      range,
      connectionRevision: "r",
    });
  }) as typeof fetch);
  await assert.rejects(p.getReadings(start, start + 31 * DAY_MS), /bad_range/);
  assert.equal(n, 0);
  await assert.rejects(
    p.getReadings(start, start + DAY_MS),
    /unexpected_schema/,
  );
  assert.equal(p.lastResult, null);
});

test("partial calendar coverage never extrapolates a final reading beyond the retrieved end", () => {
  const rows = normalizeEgvs([egv()], now).rows.map(toReading);
  const p = periodSummaries(rows, { start, end: start + 1 }, "day")[0];
  assert.equal(p.stats.covered, 1);
  assert.equal(p.stats.coverage, 100 / DAY_MS);
  assert.equal(p.fullyRequested, false);
});

test("default browser fetch is called without binding it to the provider instance", async () => {
  const original = globalThis.fetch;
  let provider: DexcomGlucoseProvider;
  globalThis.fetch = async function (this: unknown) {
    assert.notEqual(this, provider);
    return json({
      source: "dexcom",
      environment: "sandbox",
      range: parseAvailableRange(rangeBody()).range,
      connectionRevision: "r",
    });
  } as typeof fetch;
  try {
    provider = new DexcomGlucoseProvider();
    assert.equal((await provider.getAvailableRange()).range!.start, start);
  } finally {
    globalThis.fetch = original;
  }
});
