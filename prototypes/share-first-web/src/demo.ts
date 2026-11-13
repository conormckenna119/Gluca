// Synthetic demo data. Entirely fictional: generated from a seeded random generator, never derived from a real person.
// Everything exported from here must be presented to users as demo data.

import { DAY_MS, STEP_MS, parseYmd, type Reading } from './analytics';

export const DEMO_LABEL = 'Demo data · synthetic';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scenario = 'steady' | 'meals' | 'active' | 'variable';
const SCENARIOS: Scenario[] = ['steady', 'meals', 'active', 'steady', 'variable', 'meals', 'active'];

interface Meal { t: number; amp: number }

function simulateDay(dayStartMs: number, seed: number, scenario: Scenario, gapHours: [number, number] | null, endHour: number): Reading[] {
  const rnd = mulberry32(seed);
  const base = 108 + Math.floor(rnd() * 26);
  const amps: Record<Scenario, number> = { steady: 48, meals: 72, active: 56, variable: 118 };
  const jitter = () => 0.85 + rnd() * 0.3;
  const meals: Meal[] = [
    { t: 7 + rnd() * 1.2, amp: amps[scenario] * jitter() },
    { t: 12 + rnd() * 1.2, amp: amps[scenario] * 0.85 * jitter() },
    { t: 18.6 + rnd() * 1.4, amp: amps[scenario] * 1.05 * jitter() },
  ];
  const run = scenario === 'active' ? { t0: 16.5 + rnd(), len: 0.75, drop: 28 + rnd() * 14 } : null;
  const dips: Array<{ t: number; d: number; w: number }> = [];
  if (scenario === 'variable') dips.push({ t: 3 + rnd() * 1.5, d: 55 + rnd() * 25, w: 0.6 }, { t: 15 + rnd() * 2, d: 45 + rnd() * 20, w: 0.7 });

  const out: Reading[] = [];
  let noise = 0;
  for (let i = 0; i < 288; i++) {
    const hour = (i * 5) / 60;
    if (hour >= endHour) break;
    let g = base + 6 * Math.sin(((hour - 3) / 24) * 2 * Math.PI);
    for (const m of meals) if (hour >= m.t) { const x = (hour - m.t) / 1.0; g += m.amp * x * x * Math.exp(2 - 2 * x); }
    if (run) {
      if (hour >= run.t0 && hour <= run.t0 + run.len) g -= (run.drop * (hour - run.t0)) / run.len;
      else if (hour > run.t0 + run.len) g -= run.drop * Math.exp(-(hour - run.t0 - run.len) / 1.2);
    }
    for (const d of dips) g -= d.d * Math.exp(-Math.pow((hour - d.t) / d.w, 2));
    noise = 0.85 * noise + (rnd() - 0.5) * 7;
    g = Math.max(42, Math.min(380, Math.round(g + noise)));
    if (gapHours && hour >= gapHours[0] && hour < gapHours[1]) continue; // sensor change / missing data: no readings at all
    out.push({ t: dayStartMs + i * STEP_MS, mgdl: g });
  }
  return out;
}

/**
 * `days` full days ending on `endDate` (YYYY-MM-DD), at five-minute intervals.
 * The final day is partial (ends at `lastDayEndHour`) so the app is exercised with incomplete data.
 */
export function generateDemo(endDate = '2026-11-12', days = 30, lastDayEndHour = 15.5): Reading[] {
  const end = parseYmd(endDate);
  if (end === null) throw new Error('endDate must be YYYY-MM-DD');
  const all: Reading[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const start = end - k * DAY_MS;
    const idx = days - 1 - k;
    const scenario = SCENARIOS[(idx * 3 + 1) % SCENARIOS.length];
    // roughly one day in six has a ~1h20m gap; a few have a longer sensor-warm-up style gap
    const gap: [number, number] | null = idx % 6 === 2 ? [13.5 + (idx % 3) * 0.4, 14.9 + (idx % 3) * 0.4] : idx % 11 === 7 ? [9, 11.1] : null;
    // the final day is partial but gap-free, so "partial day" is the only kind of incompleteness it demonstrates
    all.push(...simulateDay(start, 1000 + idx * 7919, scenario, k === 0 ? null : gap, k === 0 ? lastDayEndHour : 24));
  }
  return all;
}
