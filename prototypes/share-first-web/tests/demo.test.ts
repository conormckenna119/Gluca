import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, STEP_MS, cleanReadings, computeStats, summarizeDays } from '../src/analytics';
import { DEMO_LABEL, generateDemo } from '../src/demo';

test('demo data is deterministic, labelled, and valid', () => {
  const a = generateDemo('2026-11-12');
  const b = generateDemo('2026-11-12');
  assert.deepEqual(a, b);
  assert.match(DEMO_LABEL, /synthetic/i);
  const c = cleanReadings(a);
  assert.equal(c.invalid, 0); assert.equal(c.duplicates, 0);
  assert.ok(c.readings.every((r) => Number.isInteger(r.mgdl)));
});

test('30 days on a five-minute grid, with gaps and a partial final day', () => {
  const rs = generateDemo('2026-11-12', 30, 15.5);
  assert.ok(rs.every((r) => r.t % STEP_MS === 0));
  const days = summarizeDays(rs);
  assert.equal(days.length, 30);
  assert.equal(days[0].date, '2026-10-14');
  assert.equal(days[29].date, '2026-11-12');
  const last = days[29].stats;
  assert.ok(last.coverage > 0.6 && last.coverage < 0.7, `partial last day coverage ${last.coverage}`);
  assert.ok(days.slice(0, 29).some((d) => d.stats.coverage < 0.95), 'some days have sensor gaps');
  assert.ok(days.slice(0, 29).some((d) => d.stats.coverage > 0.99), 'some days are complete');
});

test('demo includes calmer and more variable days', () => {
  const days = summarizeDays(generateDemo('2026-11-12')).filter((d) => d.stats.coverage > 0.9);
  const cvs = days.map((d) => d.stats.cv as number);
  assert.ok(Math.max(...cvs) > Math.min(...cvs) * 1.3, 'spread of variability across days');
  assert.ok(days.some((d) => (d.stats.tir as number) > 0.9));
  assert.ok(days.some((d) => (d.stats.tir as number) < 0.8));
});

test('rejects a malformed end date', () => {
  assert.throws(() => generateDemo('11/12/2026'));
  assert.equal(computeStats([], 0, DAY_MS).avg, null);
});
