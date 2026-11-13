import test from 'node:test';
import assert from 'node:assert/strict';
import { MG_PER_MMOL, cleanReadings } from '../src/analytics';
import { MAX_REJECTED_LISTED, parseGlucoseCsv, parseTimestamp, parseRows } from '../src/csv';

const HEADER = 'Index,Timestamp (YYYY-MM-DDThh:mm:ss),Event Type,Event Subtype,Patient Info,Device Info,Source Device ID,Glucose Value (mg/dL),Insulin Value (u),Carb Value (grams),Duration (hh:mm:ss),Glucose Rate of Change (mg/dL/min),Transmitter Time (Long Integer (in ticks)),Transmitter ID';
const egv = (i: number, ts: string, v: string) => `${i},${ts},EGV,,,Demo Receiver,SN123,${v},,,,0.5,1234567,TX9`;

const CLARITY = [
  HEADER,
  '1,,FirstName,,Jane,,,,,,,,,',
  '2,,LastName,,Testperson,,,,,,,,,',
  egv(3, '2026-11-10T08:00:01', '112'),
  egv(4, '2026-11-10T08:05:01', '118'),
  '5,2026-11-10T08:06:00,Insulin,Fast-Acting,,,,,2.0,,,,,',
  '6,2026-11-10T08:07:00,Carbs,,,,,,,30,,,,',
  egv(7, '2026-11-10T08:10:01', 'Low'),
  egv(8, '2026-11-10T08:15:01', 'High'),
  '9,2026-11-10T08:16:00,Alert,Urgent Low Soon,,,,,,,,,,',
].join('\r\n');

test('Clarity-style file: only EGV rows become readings; Low/High are clamped and flagged', () => {
  const r = parseGlucoseCsv(CLARITY);
  assert.equal(r.ok, true);
  assert.equal(r.sourceUnit, 'mgdl');
  assert.deepEqual(r.readings.map((x) => x.mgdl), [112, 118, 40, 400]);
  assert.equal(r.counts.accepted, 4);
  assert.equal(r.counts.clamped, 2);
  assert.ok(r.counts.ignoredNonGlucose >= 5);
  assert.ok(r.warnings.some((w) => /Low|High/.test(w)));
});

test('patient names, ids and device info never appear in the result', () => {
  const dump = JSON.stringify(parseGlucoseCsv(CLARITY));
  for (const secret of ['Jane', 'Testperson', 'SN123', 'TX9', 'Demo Receiver']) assert.ok(!dump.includes(secret), secret);
});

test('timestamps are wall-clock: offsets and Z are ignored, not shifted', () => {
  assert.equal(parseTimestamp('2026-11-10T08:00:01'), Date.UTC(2026, 10, 10, 8, 0, 1));
  assert.equal(parseTimestamp('2026-11-10T08:00:01Z'), Date.UTC(2026, 10, 10, 8, 0, 1));
  assert.equal(parseTimestamp('2026-11-10 08:00:01-05:00'), Date.UTC(2026, 10, 10, 8, 0, 1));
  assert.equal(parseTimestamp('2026-02-30T08:00:00'), null);
  assert.equal(parseTimestamp('garbage'), null);
});

test('mmol/L files are detected from the header and converted to mg/dL', () => {
  const csv = 'Timestamp,Glucose Value (mmol/L)\n2026-11-10T08:00:00,5.6\n2026-11-10T08:05:00,10.0';
  const r = parseGlucoseCsv(csv);
  assert.equal(r.sourceUnit, 'mmol');
  assert.ok(Math.abs(r.readings[0].mgdl - 5.6 * MG_PER_MMOL) < 1e-9);
  assert.ok(Math.abs(r.readings[1].mgdl - 180.182) < 1e-6);
});

test('unit is never guessed: an unlabeled file asks, and succeeds once told', () => {
  const csv = 'Timestamp,Glucose\n2026-11-10T08:00:00,5.6\n2026-11-10T08:05:00,6.1';
  const asked = parseGlucoseCsv(csv);
  assert.equal(asked.ok, false); assert.equal(asked.needsUnit, true);
  const ok = parseGlucoseCsv(csv, { unit: 'mmol' });
  assert.equal(ok.ok, true);
  assert.ok(Math.abs(ok.readings[0].mgdl - 100.9) < 0.1);
});

test('decimal commas and semicolon delimiters', () => {
  const csv = 'Timestamp;Glucose Value (mmol/L)\n2026-11-10T08:00:00;"5,6"\n2026-11-10T08:05:00;6,1';
  const r = parseGlucoseCsv(csv);
  assert.equal(r.ok, true);
  assert.equal(r.readings.length, 2);
  assert.ok(Math.abs(r.readings[1].mgdl - 6.1 * MG_PER_MMOL) < 1e-9);
});

test('slash dates: day/month inferred when unambiguous, ambiguity reported otherwise; AM/PM handled', () => {
  const dmy = parseGlucoseCsv('Timestamp,Glucose Value (mg/dL)\n13/04/2026 8:00 AM,100\n14/04/2026 8:05 PM,110');
  assert.equal(dmy.dateOrderUsed, 'DMY');
  assert.equal(dmy.ambiguousDates, false);
  assert.equal(dmy.readings[0].t, Date.UTC(2026, 3, 13, 8, 0, 0));
  assert.equal(dmy.readings[1].t, Date.UTC(2026, 3, 14, 20, 5, 0));
  const amb = parseGlucoseCsv('Timestamp,Glucose Value (mg/dL)\n03/04/2026 8:00 AM,100');
  assert.equal(amb.ambiguousDates, true);
  assert.equal(amb.dateOrderUsed, 'MDY');
  assert.equal(amb.readings[0].t, Date.UTC(2026, 2, 4, 8, 0, 0));
  const forced = parseGlucoseCsv('Timestamp,Glucose Value (mg/dL)\n03/04/2026 8:00 AM,100', { dateOrder: 'DMY' });
  assert.equal(forced.readings[0].t, Date.UTC(2026, 3, 3, 8, 0, 0));
  assert.equal(forced.ambiguousDates, false);
});

test('bad rows are reported with line numbers and skipped; rejected list is capped', () => {
  const lines = ['Timestamp,Glucose Value (mg/dL)', '2026-11-10T08:00:00,100', 'not a date,100', '2026-11-10T08:10:00,abc', '2026-11-10T08:15:00,5'];
  const r = parseGlucoseCsv(lines.join('\n'));
  assert.equal(r.ok, true);
  assert.equal(r.counts.rejected, 3);
  assert.deepEqual(r.rejected.map((x) => x.line), [3, 4, 5]);
  const many = ['Timestamp,Glucose Value (mg/dL)', ...Array.from({ length: 50 }, () => 'bad,100'), '2026-11-10T08:00:00,100'].join('\n');
  const m = parseGlucoseCsv(many);
  assert.equal(m.counts.rejected, 50);
  assert.equal(m.rejected.length, MAX_REJECTED_LISTED);
});

test('unsupported, empty and no-valid-row files give clear errors', () => {
  assert.equal(parseGlucoseCsv('').error, 'unsupported_format');
  assert.equal(parseGlucoseCsv('a,b,c\n1,2,3').error, 'unsupported_format');
  const none = parseGlucoseCsv('Timestamp,Glucose Value (mg/dL)\nx,y\nz,w');
  assert.equal(none.ok, false); assert.equal(none.error, 'no_valid_rows');
});

test('BOM, CRLF and quoted fields with embedded commas and quotes', () => {
  assert.deepEqual(parseRows('a,"b,""c""",d\r\n1,2,3', ','), [['a', 'b,"c"', 'd'], ['1', '2', '3']]);
  const r = parseGlucoseCsv('﻿Timestamp,Glucose Value (mg/dL)\r\n2026-11-10T08:00:00,100\r\n');
  assert.equal(r.ok, true); assert.equal(r.readings.length, 1);
});

test('imported duplicates collapse via cleanReadings (last row wins)', () => {
  const r = parseGlucoseCsv('Timestamp,Glucose Value (mg/dL)\n2026-11-10T08:00:00,100\n2026-11-10T08:00:00,130\n2026-11-10T08:05:00,120');
  const c = cleanReadings(r.readings);
  assert.equal(c.duplicates, 1);
  assert.deepEqual(c.readings.map((x) => x.mgdl), [130, 120]);
});

test('preamble rows before the header are skipped', () => {
  const r = parseGlucoseCsv('Exported by something,,\nDevice,Demo,\n\nTimestamp,Glucose Value (mg/dL)\n2026-11-10T08:00:00,100');
  assert.equal(r.ok, true); assert.equal(r.readings.length, 1);
});
