import { test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startApp, tokenOk } from "../server/testkit";
import { verifySandbox } from "../server/dexcom/sandbox-verification";
import { validateDevices } from "../server/dexcom/devices";
import {
  latestHistoricalDay,
  providerDay,
  sandboxStory,
  utcDayWindow,
} from "../src/create-source";
import { normalizeEgvs, toReading } from "../server/dexcom/normalize";
import { CsvGlucoseProvider, MockGlucoseProvider } from "../src/providers";
import {
  defaultOptions,
  storyArtwork,
  switchTemplate,
  templateIds,
  formats,
} from "../src/story";
const start = Date.parse("2025-01-01T00:00:00Z"),
  now = Date.parse("2026-11-16T12:00:00Z");
const records = Array.from({ length: 6 }, (_, i) => ({
  recordId: `synthetic-${i}`,
  systemTime: new Date(start + i * 300000).toISOString(),
  displayTime: new Date(start + i * 300000 - 18000000).toISOString(),
  unit: "mg/dL",
  value: [50, 100, 200, 100, 100, 50][i],
  status: null,
  trend: "flat",
  displayDevice: "iOS",
  displayApp: "G7",
  transmitterGeneration: "g7",
}));
const device = {
  recordType: "device",
  recordVersion: "3.0",
  userId: "synthetic",
  records: [
    {
      lastUploadDate: "2025-01-02T00:00:00",
      transmitterGeneration: "g7",
      displayApp: "G7",
      displayDevice: "iOS",
      alertSchedules: [],
      transmitterId: "never-return-this",
    },
  ],
};
const range = {
  recordType: "dataRange",
  recordVersion: "3.0",
  userId: "synthetic",
  egvs: {
    start: { systemTime: "2025-01-01T00:00:00" },
    end: { systemTime: "2025-01-02T12:00:00" },
  },
};
const json = (x: unknown) => new Response(JSON.stringify(x));
test("device verification validates envelope and owner, returns only minimal G7 evidence", () => {
  const d = validateDevices(device, "synthetic");
  assert.equal(d.g7, true);
  assert.equal(d.count, 1);
  assert.ok(!JSON.stringify(d).includes("never-return-this"));
  assert.ok(!JSON.stringify(d).includes("synthetic"));
  for (const bad of [
    { ...device, userId: "other" },
    { ...device, recordVersion: "2.0" },
    { ...device, records: null },
    { ...device, records: [{ ...device.records[0], lastUploadDate: "bad" }] },
  ])
    assert.throws(() => validateDevices(bad, "synthetic"));
});
test("historical day chooses completed UTC history, not the computer date, and rejects malformed dates", () => {
  assert.equal(
    latestHistoricalDay({
      start,
      end: start + 86400000 + 3600000,
      sourceStart: "",
      sourceEnd: "",
    }),
    "2025-01-01",
  );
  assert.deepEqual(utcDayWindow("2025-01-01"), {
    start,
    end: start + 86400000,
  });
  for (const d of ["2025-02-30", "2025-1-1", "today"])
    assert.throws(() => utcDayWindow(d));
});
test("the same provider-day interface accepts demo and CSV without mixing sources", async () => {
  const rows = normalizeEgvs(records, now).rows.map(toReading);
  const mock = await providerDay(
    new MockGlucoseProvider(rows.map((r) => ({ ...r, source: "mock" }))),
    "2025-01-01",
  );
  const csv = await providerDay(
    new CsvGlucoseProvider(rows.map((r) => ({ ...r, source: "csv" }))),
    "2025-01-01",
  );
  assert.equal(mock.readings.length, 6);
  assert.equal(csv.readings.length, 6);
  assert.ok(mock.readings.every((r) => r.source === "mock"));
  assert.ok(csv.readings.every((r) => r.source === "csv"));
  assert.ok(
    !storyArtwork([], start + 43200000, {
      ...defaultOptions("daily_recap"),
      provenance: "csv",
    }).svg.includes("DEMO DATA"),
  );
  assert.ok(
    storyArtwork(
      mock.readings,
      start + 43200000,
      defaultOptions("daily_recap"),
    ).svg.includes("DEMO DATA"),
  );
  assert.ok(
    !storyArtwork(
      csv.readings,
      start + 43200000,
      defaultOptions("daily_recap"),
    ).svg.includes("DEXCOM SANDBOX"),
  );
});
test("sandbox Create summary uses retrieved rows, UTC, user ranges and units; gaps reduce coverage", () => {
  const rows = normalizeEgvs(records, now).rows.map(toReading);
  const options = {
    ...defaultOptions("daily_recap", "mmol/L"),
    range: { low: 80, high: 160 },
  };
  const story = sandboxStory(rows, "2025-01-01", options);
  assert.equal(story.stats.count, 6);
  assert.equal(story.stats.average, 100);
  assert.equal(story.stats.tir, 50);
  assert.ok(Math.abs(story.stats.coverage - (30 / 1440) * 100) < 1e-10);
  assert.ok(story.artwork.svg.includes("mmol/L"));
  assert.ok(story.artwork.svg.includes("DEXCOM SANDBOX"));
  assert.ok(
    story.artwork.contents.some((s) =>
      s.toLowerCase().includes("dexcom sandbox"),
    ),
  );
  assert.equal(story.artwork.overflow, 0);
  assert.throws(() => sandboxStory([], "2025-01-01"));
  assert.throws(() =>
    sandboxStory(
      rows.map((r) => ({ ...r, source: "mock" })),
      "2025-01-01",
    ),
  );
});
test("all existing template sizes retain mandatory sandbox provenance after switching templates", () => {
  const rows = normalizeEgvs(records, now).rows.map(toReading);
  for (const t of templateIds)
    for (const format of Object.keys(formats) as (keyof typeof formats)[]) {
      const o = switchTemplate(
        {
          ...defaultOptions("daily_recap", "mg/dL", format),
          provenance: "dexcom-sandbox",
        },
        t,
      );
      const a = storyArtwork(rows, start + 43200000, o);
      assert.equal(a.width, formats[format][0]);
      assert.equal(a.height, formats[format][1]);
      assert.equal(a.overflow, 0);
      assert.ok(a.svg.includes("DEXCOM SANDBOX · SIMULATED"));
    }
});
test("UTC story analytics keep repeated DST instants distinct", () => {
  const rows = normalizeEgvs(
    records.slice(0, 2).map((r, i) => ({
      ...r,
      systemTime: i ? "2024-11-03T01:30:00-05:00" : "2024-11-03T01:30:00-04:00",
    })),
    now,
  ).rows.map(toReading);
  const result = sandboxStory(rows, "2024-11-03");
  assert.equal(result.stats.count, 2);
  assert.equal(result.stats.covered, 600000);
  assert.equal(result.paths.length, 2);
});
test("MOCK PASS: authorized backend → devices/EGVs → provider → analytics → actual Create artwork", async () => {
  const calls: string[] = [];
  const a = await startApp({ diagnosticsEnabled: true }, (url) => {
    calls.push(new URL(url).pathname);
    return url.includes("/token")
      ? tokenOk()
      : json(
          url.includes("/dataRange")
            ? range
            : url.includes("/devices")
              ? device
              : {
                  recordType: "egv",
                  recordVersion: "3.0",
                  userId: "synthetic",
                  records,
                },
        );
  });
  try {
    const cookie = await a.login();
    const begin = await a.call("POST", "/api/dexcom/connect", {
      cookie,
      headers: { "X-Gluca-Request": "1" },
    });
    const state = new URL(begin.json.authorizationUrl).searchParams.get(
      "state",
    );
    assert.equal(
      (
        await a.call(
          "GET",
          `/api/dexcom/callback?state=${state}&code=${FAKE.code}`,
          { cookie },
        )
      ).status,
      302,
    );
    const owner = (
      a.app.deps.db
        .prepare("SELECT user_id FROM account_credentials")
        .get() as { user_id: string }
    ).user_id;
    const result = await verifySandbox(a.app.deps, owner);
    assert.equal(result.summary.normalizedCount, 6);
    assert.equal(result.summary.csvUsed, false);
    assert.equal(result.summary.glucaMockUsed, false);
    assert.equal(result.summary.createDataAccepted, true);
    assert.ok(result.svg.includes("DEXCOM SANDBOX"));
    assert.ok(calls.includes("/v3/users/self/devices"));
    assert.equal(
      (
        a.app.deps.db.prepare("SELECT COUNT(*) AS n FROM egvs").get() as {
          n: number;
        }
      ).n,
      0,
    );
    await assert.rejects(verifySandbox(a.app.deps, "another-owner"));
    const history = JSON.stringify(result.summary);
    for (const secret of [
      FAKE.access,
      FAKE.refresh,
      FAKE.clientSecret,
      "never-return-this",
      owner,
      "synthetic",
    ])
      assert.ok(!history.includes(secret));
  } finally {
    await a.close();
  }
});
