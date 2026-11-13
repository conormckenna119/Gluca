// Local CSV import. Plain TypeScript, no react-native import, no network I/O.
// Targets the Dexcom Clarity export layout, with a tolerant fallback for similar "timestamp + glucose" files.
//
// Privacy: only timestamps and glucose values are kept. Other columns (patient info, device ids, names) are never
// copied into the result, and the file name is never read here.
//
// Ported from prototypes/share-first-web/src/csv.ts. The Clarity layout handled here was written from knowledge of
// the format and tested on synthetic files; it has not been checked against a real export.
import { Reading } from "./types";
import { normalize } from "./analytics";

export type CsvUnit = "mg/dL" | "mmol/L";
export type DateOrder = "auto" | "MDY" | "DMY";
export interface CsvOptions {
  /** Pass when the file does not state its unit (see `needsUnit`). A unit stated in the file is overridden by this. */
  unit?: CsvUnit;
  /** Day/month order for text dates such as 03/04/2026. Default "auto": inferred, with a warning when ambiguous. */
  dateOrder?: DateOrder;
  /**
   * UTC offset such as "-05:00" for timestamps that carry no offset of their own. Omit to read them as the device's
   * own time zone. A timestamp that includes an offset or "Z" always keeps that offset.
   */
  utcOffset?: string;
}
export type ImportErrorReason =
  | "unsupported_format"
  | "no_valid_rows"
  | "bad_option"
  | "parse_error";

export interface CsvResult {
  ok: boolean;
  /** mg/dL, UTC epoch ms, sorted, duplicate timestamps collapsed (last row wins). Empty unless `ok`. */
  readings: Reading[];
  sourceUnit: CsvUnit | null;
  /** True when the file does not state a unit: ask the person, never guess, then call again with `options.unit`. */
  needsUnit: boolean;
  ambiguousDates: boolean;
  dateOrderUsed: "MDY" | "DMY" | null;
  counts: {
    rows: number;
    accepted: number;
    ignoredNonGlucose: number;
    rejected: number;
    /** Sensor "Low" / "High" rows, stored as 40 and 400 mg/dL. clamped = low + high. */
    clamped: number;
    low: number;
    high: number;
    duplicates: number;
  };
  rejected: Array<{ line: number; reason: string }>; // capped at MAX_REJECTED_LISTED
  warnings: string[];
  error?: ImportErrorReason;
  message?: string;
}

export const MG_PER_MMOL = 18.0182;
export const MAX_REJECTED_LISTED = 20;
const VALID_MIN = 20;
const VALID_MAX = 600;
const LOW_MGDL = 40; // Clarity writes "Low" below the sensor range
const HIGH_MGDL = 400; // and "High" above it

export function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 8);
  let best = ",";
  let bestCount = -1;
  for (const d of [",", ";", "\t"]) {
    const n = lines.reduce((s, l) => s + l.split(d).length - 1, 0);
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

const ISO =
  /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
const SLASH =
  /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/;

/** "+05:30", "-0500" or "Z" to minutes east of UTC, or null when it is not an offset. */
export function offsetMinutes(text: string): number | null {
  const s = text.trim();
  if (/^z$/i.test(s)) return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[2]);
  const mi = Number(m[3]);
  if (h > 14 || mi > 59) return null;
  return (m[1] === "-" ? -1 : 1) * (h * 60 + mi);
}

function valid(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59)
    return false;
  const chk = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return chk.getUTCMonth() === mo - 1 && chk.getUTCDate() === d;
}

/**
 * Text timestamp to UTC epoch ms. An offset written in the text wins; otherwise `defaultOffset` (minutes east of UTC)
 * applies; when that is null the text is read as the device's own local time.
 */
export function parseTimestamp(
  raw: string,
  order: "MDY" | "DMY" = "MDY",
  defaultOffset: number | null = null,
): number | null {
  const s = raw.trim();
  let y: number, mo: number, d: number, h: number, mi: number, sec: number;
  let own: number | null = null;
  let m = ISO.exec(s);
  if (m) {
    [y, mo, d, h, mi, sec] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0)];
    if (m[7]) own = offsetMinutes(m[7]);
  } else {
    m = SLASH.exec(s);
    if (!m) return null;
    const a = +m[1];
    const b = +m[2];
    y = +m[3];
    if (y < 100) y += 2000;
    h = +m[4];
    if (m[7]) {
      if (h < 1 || h > 12) return null;
      h = (h % 12) + (m[7].toLowerCase() === "pm" ? 12 : 0);
    }
    [mo, d] = order === "MDY" ? [a, b] : [b, a];
    mi = +m[5];
    sec = +(m[6] ?? 0);
  }
  if (!valid(y, mo, d, h, mi, sec)) return null;
  const offset = own ?? defaultOffset;
  if (offset === null) return new Date(y, mo - 1, d, h, mi, sec).getTime();
  return Date.UTC(y, mo - 1, d, h, mi, sec) - offset * 60000;
}

function inferOrder(samples: string[]): {
  order: "MDY" | "DMY";
  ambiguous: boolean;
} {
  let firstOver12 = false;
  let secondOver12 = false;
  let sawSlash = false;
  for (const s of samples) {
    const m = SLASH.exec(s.trim());
    if (!m) continue;
    sawSlash = true;
    if (+m[1] > 12) firstOver12 = true;
    if (+m[2] > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return { order: "DMY", ambiguous: false };
  if (secondOver12 && !firstOver12) return { order: "MDY", ambiguous: false };
  return { order: "MDY", ambiguous: sawSlash };
}

const emptyCounts = (): CsvResult["counts"] => ({
  rows: 0,
  accepted: 0,
  ignoredNonGlucose: 0,
  rejected: 0,
  clamped: 0,
  low: 0,
  high: 0,
  duplicates: 0,
});
const fail = (
  error: ImportErrorReason,
  message: string,
  extra: Partial<CsvResult> = {},
): CsvResult => ({
  ok: false,
  readings: [],
  sourceUnit: null,
  needsUnit: false,
  ambiguousDates: false,
  dateOrderUsed: null,
  counts: emptyCounts(),
  rejected: [],
  warnings: [],
  error,
  message,
  ...extra,
});

export function parseCsv(input: string, options: CsvOptions = {}): CsvResult {
  try {
    let defaultOffset: number | null = null;
    if (options.utcOffset && options.utcOffset.trim()) {
      defaultOffset = offsetMinutes(options.utcOffset);
      if (defaultOffset === null)
        return fail(
          "bad_option",
          "Use a UTC offset such as -05:00, or leave it empty to use this device's time zone.",
        );
    }
    const text = input.replace(/^﻿/, "");
    if (!text.trim()) return fail("unsupported_format", "The file is empty.");
    const rows = parseRows(text, detectDelimiter(text));

    // 1. find the header row (exports often start with a few preamble rows)
    let headerIdx = -1;
    let tsCol = -1;
    let valCol = -1;
    let evCol = -1;
    for (let i = 0; i < Math.min(rows.length, 60); i++) {
      const cells = rows[i].map((c) => c.trim().toLowerCase());
      const ts = cells.findIndex(
        (c) =>
          /^timestamp/.test(c) ||
          /^(date ?time|time ?stamp|display time|device timestamp|system time|time|date)\b/.test(
            c,
          ),
      );
      let val = cells.findIndex((c) => /glucose value/.test(c));
      if (val < 0)
        val = cells.findIndex(
          (c) =>
            /(glucose|sgv|egv|reading)/.test(c) &&
            !/rate of change|trend|rate/.test(c),
        );
      if (ts >= 0 && val >= 0 && ts !== val) {
        headerIdx = i;
        tsCol = ts;
        valCol = val;
        evCol = cells.findIndex((c) => /^event type/.test(c));
        break;
      }
    }
    if (headerIdx < 0)
      return fail(
        "unsupported_format",
        'No timestamp and glucose columns were found. Dexcom Clarity exports have columns named "Timestamp" and "Glucose Value".',
      );

    // 2. unit: only trust what the file says, otherwise ask
    const head = rows[headerIdx][valCol].toLowerCase();
    const detected: CsvUnit | null = /mmol/.test(head)
      ? "mmol/L"
      : /mg\s*\/?\s*dl/.test(head)
        ? "mg/dL"
        : null;
    const unit = options.unit ?? detected;
    if (!unit)
      return fail(
        "unsupported_format",
        "The glucose unit is not stated in the file. Choose mg/dL or mmol/L.",
        { needsUnit: true },
      );

    // 3. date order (only matters for dd/mm vs mm/dd text dates)
    const body = rows.slice(headerIdx + 1);
    const inferred = inferOrder(
      body.map((r) => r[tsCol] ?? "").filter(Boolean),
    );
    const chosen = options.dateOrder && options.dateOrder !== "auto";
    const order = chosen ? (options.dateOrder as "MDY" | "DMY") : inferred.order;
    const ambiguous = !chosen && inferred.ambiguous;

    // 4. rows
    const parsed: Reading[] = [];
    const rejected: CsvResult["rejected"] = [];
    const counts = emptyCounts();
    const reject = (line: number, reason: string) => {
      counts.rejected++;
      if (rejected.length < MAX_REJECTED_LISTED) rejected.push({ line, reason });
    };
    for (let i = 0; i < body.length; i++) {
      const r = body[i];
      if (r.every((c) => !c.trim())) continue;
      counts.rows++;
      const line = headerIdx + 2 + i;
      if (evCol >= 0 && (r[evCol] ?? "").trim().toUpperCase() !== "EGV") {
        counts.ignoredNonGlucose++;
        continue;
      }
      const rawVal = (r[valCol] ?? "").trim();
      const rawTs = (r[tsCol] ?? "").trim();
      if (!rawVal && !rawTs) {
        counts.ignoredNonGlucose++;
        continue;
      }
      const timestamp = parseTimestamp(rawTs, order, defaultOffset);
      if (timestamp === null) {
        reject(line, "Unreadable timestamp");
        continue;
      }
      let mgdl: number;
      const lowered = rawVal.toLowerCase();
      if (lowered === "low") {
        mgdl = LOW_MGDL;
        counts.low++;
        counts.clamped++;
      } else if (lowered === "high") {
        mgdl = HIGH_MGDL;
        counts.high++;
        counts.clamped++;
      } else if (/^-?\d+([.,]\d+)?$/.test(rawVal)) {
        const n = parseFloat(rawVal.replace(",", "."));
        mgdl = unit === "mmol/L" ? n * MG_PER_MMOL : n;
        if (!(mgdl >= VALID_MIN && mgdl <= VALID_MAX)) {
          reject(line, "Glucose value outside the plausible range");
          continue;
        }
      } else {
        reject(line, "Glucose value is not a number");
        continue;
      }
      parsed.push({ timestamp, mgdl, source: "csv" });
      counts.accepted++;
    }

    const readings = normalize(parsed);
    counts.duplicates = parsed.length - readings.length;

    const warnings: string[] = [];
    if (ambiguous)
      warnings.push(
        "Dates such as 03/04/2026 can be read two ways. They are being read as month/day. Switch to day/month if that is wrong.",
      );
    if (counts.clamped)
      warnings.push(
        `${counts.clamped} reading(s) were labelled "Low" or "High" by the sensor and are shown at ${LOW_MGDL} and ${HIGH_MGDL} mg/dL.`,
      );
    if (counts.rejected)
      warnings.push(
        `${counts.rejected} row(s) could not be read and were skipped.`,
      );

    if (!readings.length)
      return fail(
        "no_valid_rows",
        "The columns were recognised, but no glucose readings could be read from the rows.",
        { counts, rejected, warnings, sourceUnit: unit },
      );
    return {
      ok: true,
      readings,
      sourceUnit: unit,
      needsUnit: false,
      ambiguousDates: ambiguous,
      dateOrderUsed: order,
      counts,
      rejected,
      warnings,
    };
  } catch {
    return fail("parse_error", "Something went wrong while reading the file.");
  }
}
