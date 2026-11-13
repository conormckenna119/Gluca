import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS, STEP_MS, cleanReadings, computeStats, fromMmol, formatGlucose, gapEdges, parseYmd, percents3,
  periodLabel, dayLabel, segmentsFor, summarizeDays, toMmol, ymd, type Reading,
} from '../src/analytics';

const T0 = Date.UTC(2026, 0, 10, 0, 0, 0);
const MIN = 60_000;
const series = (startMs: number, count: number, value: number | ((i: number) => number), stepMin = 5): Reading[] =>
  Array.from({ length: count }, (_, i) => ({ t: startMs + i * stepMin * MIN, mgdl: typeof value === 'number' ? value : value(i) }));
const close = (a: number | null, b: number, eps = 1e-6) => { assert.ok(a !== null && Math.abs(a - b) < eps, `${a} vs ${b}`); };

test('unit conversion keeps stored mg/dL and formats on display', () => {
  assert.equal(formatGlucose(180, 'mgdl'), '180');
  assert.equal(formatGlucose(180, 'mmol'), '10.0');
  assert.equal(formatGlucose(70, 'mmol'), '3.9');
  close(fromMmol(toMmol(123)), 123);
  assert.equal(formatGlucose(100.4, 'mgdl'), '100');
});

test('constant readings: all time in range, exact average, full coverage', () => {
  const rs = series(T0, 12, 100); // 12 x 5 min = 1 h
  const s = computeStats(cleanReadings(rs).readings, T0, T0 + 60 * MIN);
  assert.equal(s.readings, 12);
  close(s.avg, 100); close(s.tir, 1); close(s.tar, 0); close(s.tbr, 0); close(s.coverage, 1); close(s.sd, 0);
});

test('missing readings are NOT counted as in range and lower coverage', () => {
  const rs = series(T0, 12, 100); // observed 1 h of a 2 h interval
  const s = computeStats(rs, T0, T0 + 120 * MIN);
  close(s.coverage, 0.5);
  close(s.tir, 1);               // percentage of observed time
  assert.equal(s.observedMs, 60 * MIN);
});

test('a long gap contributes at most one 5-minute step', () => {
  const rs: Reading[] = [{ t: T0, mgdl: 100 }, { t: T0 + 5 * MIN, mgdl: 100 }, { t: T0 + 10 * MIN, mgdl: 100 }, { t: T0 + 60 * MIN, mgdl: 100 }];
  const s = computeStats(rs, T0, T0 + 65 * MIN);
  assert.equal(s.observedMs, 20 * MIN); // 5 + 5 + 5 (before the gap) + 5 (last)
});

test('irregular intervals are time-weighted', () => {
  const rs: Reading[] = [{ t: T0, mgdl: 100 }, { t: T0 + 2 * MIN, mgdl: 200 }, { t: T0 + 12 * MIN, mgdl: 100 }];
  const s = computeStats(rs, T0, T0 + 12 * MIN + STEP_MS);
  // 2 min @100, 5 min @200 (capped), 5 min @100
  close(s.avg, (2 * 100 + 5 * 200 + 5 * 100) / 12);
});

test('range edges are inclusive; high and low are separated', () => {
  const rs: Reading[] = [{ t: T0, mgdl: 70 }, { t: T0 + 5 * MIN, mgdl: 180 }, { t: T0 + 10 * MIN, mgdl: 181 }, { t: T0 + 15 * MIN, mgdl: 69 }];
  const s = computeStats(rs, T0, T0 + 20 * MIN);
  close(s.tir, 0.5); close(s.tar, 0.25); close(s.tbr, 0.25);
});

test('SD and CV use time-weighted values', () => {
  const rs: Reading[] = [{ t: T0, mgdl: 100 }, { t: T0 + 5 * MIN, mgdl: 200 }];
  const s = computeStats(rs, T0, T0 + 10 * MIN);
  close(s.avg, 150); close(s.sd, 50); close(s.cv, 1 / 3);
});

test('duplicates: later row wins and is counted; invalid values dropped', () => {
  const r = cleanReadings([{ t: 5, mgdl: 100 }, { t: 1, mgdl: 90 }, { t: 5, mgdl: 140 }, { t: 9, mgdl: 5 }, { t: 10, mgdl: NaN }, { t: 11, mgdl: 700 }]);
  assert.deepEqual(r.readings, [{ t: 1, mgdl: 90 }, { t: 5, mgdl: 140 }]);
  assert.equal(r.duplicates, 1);
  assert.equal(r.invalid, 3);
});

test('readings are clipped at interval boundaries (no double counting across midnight)', () => {
  const rs: Reading[] = [{ t: T0 + DAY_MS - 2 * MIN, mgdl: 100 }, { t: T0 + DAY_MS + 3 * MIN, mgdl: 200 }];
  const day1 = computeStats(rs, T0, T0 + DAY_MS);
  const day2 = computeStats(rs, T0 + DAY_MS, T0 + 2 * DAY_MS);
  // reading 1's 5-minute step is split 2 min / 3 min across midnight; reading 2 contributes a full 5 min to day 2
  assert.equal(day1.observedMs, 2 * MIN);
  assert.equal(day2.observedMs, 3 * MIN + 5 * MIN);
  assert.equal(day1.observedMs + day2.observedMs, 10 * MIN); // equals the unclipped total: nothing counted twice
  assert.equal(day1.readings, 1); assert.equal(day2.readings, 1);
});

test('partial day reports partial coverage and is not presented as complete', () => {
  const rs = series(T0, 12 * 12, 120); // 00:00 to 12:00
  const s = computeStats(rs, T0, T0 + DAY_MS);
  close(s.coverage, 0.5);
  assert.ok(s.coverage < 0.9);
});

test('empty interval returns nulls, not zeros', () => {
  const s = computeStats([], T0, T0 + DAY_MS);
  assert.equal(s.avg, null); assert.equal(s.tir, null); assert.equal(s.coverage, 0); assert.equal(s.readings, 0);
});

test('percents3 always sums to 100', () => {
  for (const [a, b, c] of [[1 / 3, 1 / 3, 1 / 3], [0.045, 0.91, 0.045], [0.004, 0.992, 0.004], [0, 1, 0]] as const) {
    const p = percents3(a, b, c);
    assert.equal(p[0] + p[1] + p[2], 100);
  }
});

test('wall-clock days are always 24 hours, including a US DST change date', () => {
  const rs = series(Date.UTC(2026, 2, 7), 3 * 288, 110);
  const days = summarizeDays(rs);
  assert.deepEqual(days.map((d) => d.date), ['2026-03-07', '2026-03-08', '2026-03-09']);
  for (const d of days) { assert.equal(d.end - d.start, DAY_MS); close(d.stats.coverage, 1); }
});

test('date helpers', () => {
  assert.equal(ymd(Date.UTC(2026, 10, 11)), '2026-11-11');
  assert.equal(parseYmd('2026-02-30'), null);
  assert.equal(parseYmd('2026-11-11'), Date.UTC(2026, 10, 11));
  assert.equal(dayLabel(Date.UTC(2026, 10, 11)), 'WED · NOV 11');
  assert.equal(periodLabel(Date.UTC(2026, 10, 5), Date.UTC(2026, 10, 12)), 'NOV 5 – NOV 11');
});

test('chart segments break on gaps and never bridge them', () => {
  const rs: Reading[] = [...series(T0, 3, 100), ...series(T0 + 60 * MIN, 3, 120)];
  const segs = segmentsFor(rs, T0, T0 + 2 * 60 * MIN);
  assert.equal(segs.length, 2);
  assert.deepEqual(gapEdges(segs), [[T0 + 10 * MIN, T0 + 60 * MIN]]);
  assert.equal(segmentsFor(rs, T0 + 20 * MIN, T0 + 50 * MIN).length, 0);
});
