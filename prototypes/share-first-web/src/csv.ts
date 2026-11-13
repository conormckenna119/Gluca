// Local CSV import. Runs entirely in the browser/Node; nothing here performs network I/O.
// Targets the Dexcom Clarity export layout, with a tolerant fallback for similar "timestamp + glucose" files.
//
// Privacy: only timestamps and glucose values are kept. Other columns (patient info, device ids, names) are never copied
// into the result, and the file name is never read.
//
// NOTE: the Clarity layout handled here was written from knowledge of the format and tested on synthetic files.
// It has not been checked against a real export. Treat real-file testing as an open validation item.

import { MG_PER_MMOL, VALID_MAX, VALID_MIN, type Reading, type Unit } from './analytics';

export type DateOrder = 'auto' | 'MDY' | 'DMY';
export interface CsvOptions { unit?: Unit; dateOrder?: DateOrder }
export type ImportErrorReason = 'unsupported_format' | 'no_valid_rows' | 'parse_error';

export interface CsvResult {
  ok: boolean;
  readings: Reading[];            // mg/dL, wall-clock timestamps; NOT yet cleaned/deduplicated (use cleanReadings)
  sourceUnit: Unit | null;
  needsUnit: boolean;             // true when the unit could not be determined: ask the user, do not guess
  ambiguousDates: boolean;        // true when day/month order could not be inferred
  dateOrderUsed: 'MDY' | 'DMY' | null;
  counts: { rows: number; accepted: number; ignoredNonGlucose: number; rejected: number; clamped: number };
  rejected: Array<{ line: number; reason: string }>; // capped at 20
  warnings: string[];
  error?: ImportErrorReason;
  message?: string;
}

export const MAX_REJECTED_LISTED = 20;
const LOW_MGDL = 40;   // Clarity writes "Low" below the sensor range
const HIGH_MGDL = 400; // and "High" above it

export function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  let best = ',', bestCount = -1;
  for (const d of [',', ';', '\t']) {
    const n = lines.reduce((s, l) => s + l.split(d).length - 1, 0);
    if (n > bestCount) { best = d; bestCount = n; }
  }
  return best;
}

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/;
const SLASH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/;

function buildMs(y: number, mo: number, d: number, h: number, mi: number, s: number): number | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const t = Date.UTC(y, mo - 1, d, h, mi, s);
  const chk = new Date(t);
  return chk.getUTCMonth() === mo - 1 && chk.getUTCDate() === d ? t : null;
}

/** Wall-clock parse. An explicit offset or "Z" in the text is ignored on purpose: the clock reading as written is what the person saw. */
export function parseTimestamp(raw: string, order: 'MDY' | 'DMY' = 'MDY'): number | null {
  const s = raw.trim();
  let m = ISO.exec(s);
  if (m) return buildMs(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0));
  m = SLASH.exec(s);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    let h = +m[4];
    if (m[7]) {
      const pm = m[7].toLowerCase() === 'pm';
      if (h < 1 || h > 12) return null;
      h = (h % 12) + (pm ? 12 : 0);
    }
    const [mo, d] = order === 'MDY' ? [a, b] : [b, a];
    return buildMs(y, mo, d, h, +m[5], +(m[6] ?? 0));
  }
  return null;
}

function inferOrder(samples: string[]): { order: 'MDY' | 'DMY'; ambiguous: boolean } {
  let sawFirstOver12 = false, sawSecondOver12 = false, sawSlash = false;
  for (const s of samples) {
    const m = SLASH.exec(s.trim());
    if (!m) continue;
    sawSlash = true;
    if (+m[1] > 12) sawFirstOver12 = true;
    if (+m[2] > 12) sawSecondOver12 = true;
  }
  if (sawFirstOver12 && !sawSecondOver12) return { order: 'DMY', ambiguous: false };
  if (sawSecondOver12 && !sawFirstOver12) return { order: 'MDY', ambiguous: false };
  return { order: 'MDY', ambiguous: sawSlash };
}

const fail = (error: ImportErrorReason, message: string, extra: Partial<CsvResult> = {}): CsvResult => ({
  ok: false, readings: [], sourceUnit: null, needsUnit: false, ambiguousDates: false, dateOrderUsed: null,
  counts: { rows: 0, accepted: 0, ignoredNonGlucose: 0, rejected: 0, clamped: 0 }, rejected: [], warnings: [], error, message, ...extra,
});

export function parseGlucoseCsv(input: string, options: CsvOptions = {}): CsvResult {
  try {
    const text = input.replace(/^﻿/, '');
    if (!text.trim()) return fail('unsupported_format', 'The file is empty.');
    const rows = parseRows(text, detectDelimiter(text));

    // 1. find the header row (exports often start with a few preamble rows)
    let headerIdx = -1, tsCol = -1, valCol = -1, evCol = -1;
    for (let i = 0; i < Math.min(rows.length, 60); i++) {
      const cells = rows[i].map((c) => c.trim().toLowerCase());
      const ts = cells.findIndex((c) => /^timestamp/.test(c) || /^(date ?time|time ?stamp|display time|device timestamp|system time|time|date)\b/.test(c));
      let val = cells.findIndex((c) => /glucose value/.test(c));
      if (val < 0) val = cells.findIndex((c) => /(glucose|sgv|egv|reading)/.test(c) && !/rate of change|trend|rate/.test(c));
      if (ts >= 0 && val >= 0 && ts !== val) {
        headerIdx = i; tsCol = ts; valCol = val;
        evCol = cells.findIndex((c) => /^event type/.test(c));
        break;
      }
    }
    if (headerIdx < 0) {
      return fail('unsupported_format', 'No timestamp and glucose columns were found. Dexcom Clarity exports have columns named "Timestamp" and "Glucose Value".');
    }

    // 2. unit: only trust what the file says, otherwise ask
    const header = rows[headerIdx][valCol].toLowerCase();
    const detected: Unit | null = /mmol/.test(header) ? 'mmol' : /mg\s*\/?\s*dl/.test(header) ? 'mgdl' : null;
    const unit = options.unit ?? detected;
    if (!unit) {
      return fail('unsupported_format', 'The glucose unit is not stated in the file. Choose mg/dL or mmol/L.', { needsUnit: true });
    }

    // 3. date order (only matters for dd/mm vs mm/dd text dates)
    const body = rows.slice(headerIdx + 1);
    const tsSamples = body.map((r) => r[tsCol] ?? '').filter(Boolean);
    const inferred = inferOrder(tsSamples);
    const order = options.dateOrder && options.dateOrder !== 'auto' ? options.dateOrder : inferred.order;
    const ambiguous = (!options.dateOrder || options.dateOrder === 'auto') && inferred.ambiguous;

    // 4. rows
    const readings: Reading[] = [];
    const rejected: CsvResult['rejected'] = [];
    const counts = { rows: 0, accepted: 0, ignoredNonGlucose: 0, rejected: 0, clamped: 0 };
    const reject = (line: number, reason: string) => { counts.rejected++; if (rejected.length < MAX_REJECTED_LISTED) rejected.push({ line, reason }); };
    for (let i = 0; i < body.length; i++) {
      const r = body[i];
      if (r.every((c) => !c.trim())) continue;
      counts.rows++;
      const line = headerIdx + 2 + i;
      if (evCol >= 0 && (r[evCol] ?? '').trim().toUpperCase() !== 'EGV') { counts.ignoredNonGlucose++; continue; }
      const rawVal = (r[valCol] ?? '').trim();
      const rawTs = (r[tsCol] ?? '').trim();
      if (!rawVal && !rawTs) { counts.ignoredNonGlucose++; continue; }
      const t = parseTimestamp(rawTs, order);
      if (t === null) { reject(line, 'Unreadable timestamp'); continue; }
      let mgdl: number;
      const lowered = rawVal.toLowerCase();
      if (lowered === 'low') { mgdl = LOW_MGDL; counts.clamped++; }
      else if (lowered === 'high') { mgdl = HIGH_MGDL; counts.clamped++; }
      else if (/^-?\d+([.,]\d+)?$/.test(rawVal)) {
        const n = parseFloat(rawVal.replace(',', '.'));
        mgdl = unit === 'mmol' ? n * MG_PER_MMOL : n;
        if (!(mgdl >= VALID_MIN && mgdl <= VALID_MAX)) { reject(line, 'Glucose value outside the plausible range'); continue; }
      } else { reject(line, 'Glucose value is not a number'); continue; }
      readings.push({ t, mgdl });
      counts.accepted++;
    }

    const warnings: string[] = [];
    if (ambiguous) warnings.push('Dates such as 03/04/2026 can be read two ways. They are being read as month/day. Switch to day/month if that is wrong.');
    if (counts.clamped) warnings.push(`${counts.clamped} reading(s) were labelled "Low" or "High" by the sensor and are shown at ${LOW_MGDL} and ${HIGH_MGDL} mg/dL.`);
    if (counts.rejected) warnings.push(`${counts.rejected} row(s) could not be read and were skipped.`);

    if (!readings.length) {
      return fail('no_valid_rows', 'The columns were recognised, but no glucose readings could be read from the rows.', { counts, rejected, warnings, sourceUnit: unit });
    }
    return { ok: true, readings, sourceUnit: unit, needsUnit: false, ambiguousDates: ambiguous, dateOrderUsed: order, counts, rejected, warnings };
  } catch {
    return fail('parse_error', 'Something went wrong while reading the file.');
  }
}
