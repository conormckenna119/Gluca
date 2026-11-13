import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_REJECTED_LISTED,
  MG_PER_MMOL,
  parseCsv,
  parseRows,
  parseTimestamp,
} from "../src/csv";

const HEADER =
  "Index,Timestamp (YYYY-MM-DDThh:mm:ss),Event Type,Event Subtype,Patient Info,Device Info,Source Device ID,Glucose Value (mg/dL),Insulin Value (u),Carb Value (grams),Duration (hh:mm:ss),Glucose Rate of Change (mg/dL/min),Transmitter Time (Long Integer (in ticks)),Transmitter ID";
const egv = (i: number, ts: string, v: string) =>
  `${i},${ts},EGV,,,Demo Receiver,SN123,${v},,,,0.5,1234567,TX9`;
const UTC = { utcOffset: "+00:00" };

const CLARITY = [
  HEADER,
  "1,,FirstName,,Jane,,,,,,,,,",
  "2,,LastName,,Testperson,,,,,,,,,",
  egv(3, "2026-11-10T08:00:01", "112"),
  egv(4, "2026-11-10T08:05:01", "118"),
  "5,2026-11-10T08:06:00,Insulin,Fast-Acting,,,,,2.0,,,,,",
  "6,2026-11-10T08:07:00,Carbs,,,,,,,30,,,,",
  egv(7, "2026-11-10T08:10:01", "Low"),
  egv(8, "2026-11-10T08:15:01", "High"),
  "9,2026-11-10T08:16:00,Alert,Urgent Low Soon,,,,,,,,,,",
].join("\r\n");

test("Clarity-style file: only EGV rows become readings; Low/High are mapped and flagged", () => {
  const r = parseCsv(CLARITY, UTC);
  assert.equal(r.ok, true);
  assert.equal(r.sourceUnit, "mg/dL");
  assert.deepEqual(
    r.readings.map((x) => x.mgdl),
    [112, 118, 40, 400],
  );
  assert.ok(r.readings.every((x) => x.source === "csv"));
  assert.equal(r.counts.accepted, 4);
  assert.equal(r.counts.clamped, 2);
  assert.equal(r.counts.low, 1);
  assert.equal(r.counts.high, 1);
  assert.ok(r.counts.ignoredNonGlucose >= 5);
  assert.ok(r.warnings.some((w) => /Low|High/.test(w)));
});

test("patient names, ids and device info never appear in the result", () => {
  const dump = JSON.stringify(parseCsv(CLARITY, UTC));
  for (const secret of ["Jane", "Testperson", "SN123", "TX9", "Demo Receiver"])
    assert.ok(!dump.includes(secret), secret);
});

test("timestamps: UTC instants, explicit offsets honoured, impossible dates rejected", () => {
  assert.equal(parseTimestamp("2026-11-10T08:00:01", "MDY", 0), Date.UTC(2026, 10, 10, 8, 0, 1));
  assert.equal(parseTimestamp("2026-11-10T08:00:01Z", "MDY", 60), Date.UTC(2026, 10, 10, 8, 0, 1));
  assert.equal(parseTimestamp("2026-11-10 08:00:01-05:00"), Date.UTC(2026, 10, 10, 13, 0, 1));
  assert.equal(parseTimestamp("2026-11-10T08:00:00", "MDY", -300), Date.UTC(2026, 10, 10, 13, 0, 0));
  assert.equal(parseTimestamp("2026-11-10T08:00:00"), new Date(2026, 10, 10, 8, 0, 0).getTime());
  assert.equal(parseTimestamp("2026-02-30T08:00:00"), null);
  assert.equal(parseTimestamp("garbage"), null);
});

test("mmol/L files are detected from the header and converted to mg/dL", () => {
  const csv = "Timestamp,Glucose Value (mmol/L)\n2026-11-10T08:00:00,5.6\n2026-11-10T08:05:00,10.0";
  const r = parseCsv(csv, UTC);
  assert.equal(r.sourceUnit, "mmol/L");
  assert.ok(Math.abs(r.readings[0].mgdl - 5.6 * MG_PER_MMOL) < 1e-9);
  assert.ok(Math.abs(r.readings[1].mgdl - 180.182) < 1e-6);
});

test("unit is never guessed: an unlabeled file asks, and succeeds once told", () => {
  const csv = "Timestamp,Glucose\n2026-11-10T08:00:00,5.6\n2026-11-10T08:05:00,6.1";
  const asked = parseCsv(csv, UTC);
  assert.equal(asked.ok, false);
  assert.equal(asked.needsUnit, true);
  assert.equal(asked.readings.length, 0);
  const ok = parseCsv(csv, { ...UTC, unit: "mmol/L" });
  assert.equal(ok.ok, true);
  assert.ok(Math.abs(ok.readings[0].mgdl - 100.9) < 0.1);
});

test("decimal commas and semicolon delimiters", () => {
  const csv = 'Timestamp;Glucose Value (mmol/L)\n2026-11-10T08:00:00;"5,6"\n2026-11-10T08:05:00;6,1';
  const r = parseCsv(csv, UTC);
  assert.equal(r.ok, true);
  assert.equal(r.readings.length, 2);
  assert.ok(Math.abs(r.readings[1].mgdl - 6.1 * MG_PER_MMOL) < 1e-9);
});

test("slash dates: day/month inferred when unambiguous, ambiguity reported otherwise; AM/PM handled", () => {
  const dmy = parseCsv("Timestamp,Glucose Value (mg/dL)\n13/04/2026 8:00 AM,100\n14/04/2026 8:05 PM,110", UTC);
  assert.equal(dmy.dateOrderUsed, "DMY");
  assert.equal(dmy.ambiguousDates, false);
  assert.equal(dmy.readings[0].timestamp, Date.UTC(2026, 3, 13, 8, 0, 0));
  assert.equal(dmy.readings[1].timestamp, Date.UTC(2026, 3, 14, 20, 5, 0));
  const amb = parseCsv("Timestamp,Glucose Value (mg/dL)\n03/04/2026 8:00 AM,100", UTC);
  assert.equal(amb.ambiguousDates, true);
  assert.equal(amb.dateOrderUsed, "MDY");
  assert.ok(amb.warnings.some((w) => /two ways/.test(w)));
  assert.equal(amb.readings[0].timestamp, Date.UTC(2026, 2, 4, 8, 0, 0));
  const forced = parseCsv("Timestamp,Glucose Value (mg/dL)\n03/04/2026 8:00 AM,100", { ...UTC, dateOrder: "DMY" });
  assert.equal(forced.readings[0].timestamp, Date.UTC(2026, 3, 3, 8, 0, 0));
  assert.equal(forced.ambiguousDates, false);
});

test("bad rows are reported with line numbers and skipped; rejected list is capped", () => {
  const lines = ["Timestamp,Glucose Value (mg/dL)", "2026-11-10T08:00:00,100", "not a date,100", "2026-11-10T08:10:00,abc", "2026-11-10T08:15:00,5"];
  const r = parseCsv(lines.join("\n"), UTC);
  assert.equal(r.ok, true);
  assert.equal(r.counts.rejected, 3);
  assert.deepEqual(r.rejected.map((x) => x.line), [3, 4, 5]);
  const many = ["Timestamp,Glucose Value (mg/dL)", ...Array.from({ length: 50 }, () => "bad,100"), "2026-11-10T08:00:00,100"].join("\n");
  const m = parseCsv(many, UTC);
  assert.equal(m.counts.rejected, 50);
  assert.equal(m.rejected.length, MAX_REJECTED_LISTED);
});

test("unsupported, empty and no-valid-row files give clear errors", () => {
  assert.equal(parseCsv("").error, "unsupported_format");
  assert.equal(parseCsv("a,b,c\n1,2,3").error, "unsupported_format");
  const none = parseCsv("Timestamp,Glucose Value (mg/dL)\nx,y\nz,w", UTC);
  assert.equal(none.ok, false);
  assert.equal(none.error, "no_valid_rows");
  assert.equal(parseCsv(CLARITY, { utcOffset: "five" }).error, "bad_option");
});

test("BOM, CRLF and quoted fields with embedded commas and quotes", () => {
  assert.deepEqual(parseRows('a,"b,""c""",d\r\n1,2,3', ","), [["a", 'b,"c"', "d"], ["1", "2", "3"]]);
  const r = parseCsv("﻿Timestamp,Glucose Value (mg/dL)\r\n2026-11-10T08:00:00,100\r\n", UTC);
  assert.equal(r.ok, true);
  assert.equal(r.readings.length, 1);
});

test("duplicate timestamps collapse (last row wins) and are counted", () => {
  const r = parseCsv("Timestamp,Glucose Value (mg/dL)\n2026-11-10T08:00:00,100\n2026-11-10T08:00:00,130\n2026-11-10T08:05:00,120", UTC);
  assert.equal(r.counts.duplicates, 1);
  assert.deepEqual(r.readings.map((x) => x.mgdl), [130, 120]);
});

test("preamble rows before the header are skipped", () => {
  const r = parseCsv("Exported by something,,\nDevice,Demo,\n\nTimestamp,Glucose Value (mg/dL)\n2026-11-10T08:00:00,100", UTC);
  assert.equal(r.ok, true);
  assert.equal(r.readings.length, 1);
});

test("explicit offsets in the text are kept as real instants; an hour apart stays an hour apart", () => {
  const csv = 'Export metadata\nTimestamp,Glucose Value (mg/dL)\n"2026-11-01T01:30:00-04:00",100\n2026-11-01T01:30:00-05:00,120\n2026-11-01T01:30:00-05:00,120\nbad,NOPE';
  const p = parseCsv(csv);
  assert.equal(p.readings.length, 2);
  assert.equal(p.readings[1].timestamp - p.readings[0].timestamp, 3600000);
  assert.equal(p.counts.duplicates, 1);
  assert.equal(p.rejected.length, 1);
});

test("UTC offset option and day-first dates with mmol/L", () => {
  const p = parseCsv('Device Timestamp;Glucose (mmol/L)\n12/11/2026 08:00;"5,5"', { dateOrder: "DMY", utcOffset: "+01:00" });
  assert.equal(p.readings[0].timestamp, Date.parse("2026-11-12T07:00:00Z"));
  assert.ok(Math.abs(p.readings[0].mgdl - 99.1001) < 0.001);
});

// ---- the bundled synthetic Clarity sample ----
const samplePath = [
  path.join(process.cwd(), "samples", "synthetic-clarity.csv"),
  path.join(__dirname, "..", "..", "samples", "synthetic-clarity.csv"),
].find((p) => fs.existsSync(p)) as string;
const sampleText = fs.readFileSync(samplePath, "utf8");

test("sample file imports, drops non-glucose rows and keeps source 'csv'", () => {
  const r = parseCsv(sampleText, UTC);
  assert.equal(r.ok, true);
  assert.ok(r.readings.length > 3000);
  assert.ok(r.counts.ignoredNonGlucose > 0);
  assert.equal(r.counts.rejected, 0);
  assert.ok(r.readings.every((x) => x.source === "csv" && x.mgdl >= 20 && x.mgdl <= 600));
});

test("sample file: time in range and average match an independent calculation", () => {
  const { readings } = parseCsv(sampleText, UTC);
  // Rule: duration-weighted; each reading lasts until the next, at most 5 minutes; the last counts 5 minutes; range 70-180.
  const calc = (rows: { t: number; v: number }[]) => {
    let total = 0, inside = 0, weighted = 0;
    rows.forEach((x, i) => {
      const d = Math.min(rows[i + 1] ? rows[i + 1].t - x.t : 300000, 300000);
      total += d;
      weighted += x.v * d;
      if (x.v >= 70 && x.v <= 180) inside += d;
    });
    return { tir: (inside / total) * 100, avg: weighted / total };
  };
  const fromParser = calc(readings.map((x) => ({ t: x.timestamp, v: x.mgdl })));
  // Second, parser-independent path: read the EGV lines straight from the raw text.
  const raw = sampleText
    .split("\n")
    .filter((l) => /,EGV,/.test(l))
    .map((l) => {
      const c = l.split(",");
      return { t: Date.parse(c[1] + "Z"), v: Number(c[7]) };
    });
  assert.equal(raw.length, readings.length);
  const fromRaw = calc(raw);
  assert.ok(fromParser.tir > 0 && fromParser.tir < 100);
  assert.ok(Math.abs(fromParser.tir - fromRaw.tir) < 1e-9);
  assert.ok(Math.abs(fromParser.avg - fromRaw.avg) < 1e-9);
});

test("sample file: patient names and device id never appear in anything the parser returns", () => {
  assert.ok(sampleText.includes("Sample") && sampleText.includes("Person") && sampleText.includes("SYNTH-0001"));
  const dump = JSON.stringify(parseCsv(sampleText, UTC));
  for (const secret of ["Sample", "Person", "SYNTH-0001", "Dexcom G7", "synthetic-clarity"])
    assert.ok(!dump.includes(secret), secret);
});
