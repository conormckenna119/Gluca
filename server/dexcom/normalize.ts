// Pure, defensive normalization of official V3 EGVs. No logging, persistence or invented samples.
import type { DexcomReading } from "../../src/types";
import { parseProviderTime } from "../../src/glucose-window";
export const MGDL_PER_MMOL = 18.0182,
  LOW_MARKER = 39,
  HIGH_MARKER = 401;
export const parseSystemTime = parseProviderTime;
// Old sync modules remain unmounted; this shape keeps their types compatible while the API sends toReading().
export interface NormalizedEgv {
  recordId: string;
  systemTimeMs: number;
  systemTime: string;
  displayTime: string | null;
  mgdl: number;
  originalValue: number;
  originalUnit: "mg/dL" | "mmol/L";
  trend: string | null;
  trendRate: number | null;
  rateUnit: string | null;
  status: "low" | "high" | null;
  device: string | null;
  deviceGeneration: string | null;
  ingestedAt: number;
}
export interface NormalizeResult {
  rows: NormalizedEgv[];
  rejected: Record<string, number>;
  rejectedTotal: number;
  duplicates: number;
}
const text = (v: unknown, max = 80) =>
  typeof v === "string" && v.length <= max && /^[a-zA-Z0-9+._/-]+$/.test(v)
    ? v
    : null;
const TRENDS = new Set([
  "none",
  "unknown",
  "doubleUp",
  "singleUp",
  "fortyFiveUp",
  "flat",
  "fortyFiveDown",
  "singleDown",
  "doubleDown",
  "notComputable",
  "rateOutOfRange",
]);
function one(r: Record<string, unknown>, now: number): NormalizedEgv | string {
  const systemTimeMs = parseSystemTime(r.systemTime);
  if (systemTimeMs === null || systemTimeMs > now + 600000) return "bad_time";
  if (typeof r.recordId !== "string" || !text(r.recordId, 100)) return "bad_id";
  if (r.unit !== "mg/dL" && r.unit !== "mmol/L") return "bad_unit";
  if (typeof r.value !== "number" || !Number.isFinite(r.value))
    return r.value == null ? "missing_value" : "bad_value";
  const mgdl = r.unit === "mmol/L" ? r.value * MGDL_PER_MMOL : r.value;
  if (!(
    (mgdl >= 40 && mgdl <= 400) ||
    mgdl === LOW_MARKER ||
    mgdl === HIGH_MARKER
  ))
    return "out_of_range";
  const status =
    mgdl === LOW_MARKER ? "low" : mgdl === HIGH_MARKER ? "high" : null;
  if (r.status != null && r.status !== status) return "bad_status";
  if (
    r.displayTime != null &&
    (typeof r.displayTime !== "string" || r.displayTime.length > 64)
  )
    return "bad_display_time";
  const platform = text(r.displayDevice),
    app = text(r.displayApp);
  return {
    recordId: r.recordId,
    systemTimeMs,
    systemTime: r.systemTime as string,
    displayTime: typeof r.displayTime === "string" ? r.displayTime : null,
    mgdl,
    originalValue: r.value,
    originalUnit: r.unit,
    trend: typeof r.trend === "string" && TRENDS.has(r.trend) ? r.trend : null,
    trendRate:
      typeof r.trendRate === "number" && Number.isFinite(r.trendRate)
        ? r.trendRate
        : null,
    rateUnit:
      r.rateUnit === "mg/dL/min" || r.rateUnit === "mmol/L/min"
        ? r.rateUnit
        : null,
    status,
    device: platform && app ? `${platform}/${app}` : (platform ?? app),
    deviceGeneration:
      text(r.transmitterGenerationVariant) ?? text(r.transmitterGeneration),
    ingestedAt: now,
  };
}
export function normalizeEgvs(records: unknown, now: number): NormalizeResult {
  const byId = new Map<string, NormalizedEgv>();
  const rejected: Record<string, number> = {};
  let rejectedTotal = 0,
    duplicates = 0;
  for (const r of Array.isArray(records) ? records : []) {
    const value =
      r && typeof r === "object" && !Array.isArray(r)
        ? one(r, now)
        : "not_an_object";
    if (typeof value === "string") {
      rejected[value] = (rejected[value] ?? 0) + 1;
      rejectedTotal++;
    } else {
      if (byId.has(value.recordId)) duplicates++;
      byId.set(value.recordId, value);
    }
  }
  return {
    rows: [...byId.values()].sort(
      (a, b) =>
        a.systemTimeMs - b.systemTimeMs || a.recordId.localeCompare(b.recordId),
    ),
    rejected,
    rejectedTotal,
    duplicates,
  };
}
export function toReading(r: NormalizedEgv): DexcomReading {
  return {
    timestamp: r.systemTimeMs,
    mgdl: r.mgdl,
    source: "dexcom",
    environment: "sandbox",
    sourceId: `dexcom:sandbox:${r.recordId}`,
    recordId: r.recordId,
    originalValue: r.originalValue,
    originalUnit: r.originalUnit,
    sourceSystemTime: r.systemTime,
    sourceDisplayTime: r.displayTime,
    trend: r.trend,
    trendRate: r.trendRate,
    rateUnit: r.rateUnit,
    status: r.status,
    device: r.device,
    deviceGeneration: r.deviceGeneration,
    ingestedAt: r.ingestedAt,
  };
}
