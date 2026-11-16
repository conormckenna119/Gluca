import {
  latestWindow,
  validWindow,
  isEpoch,
  type DexcomRangeResult,
  type DexcomDataResult,
  type GlucoseWindow,
} from "../glucose-window";
import type { GlucoseProvider } from "../providers";
import type { DexcomReading } from "../types";
export class GlucoseDataError extends Error {
  constructor(
    public code: string,
    public retryAfterSeconds?: number,
  ) {
    super(code);
  }
}
const CODES = new Set([
  "no_session",
  "needs_reconnect",
  "not_found",
  "dexcom_not_configured",
  "bad_range",
  "rate_limited",
  "unavailable",
  "forbidden",
  "unexpected_schema",
  "upstream_rejected",
]);
export function glucoseDataMessage(e: unknown) {
  const c = e instanceof GlucoseDataError ? e.code : "unavailable";
  return (
    (
      {
        no_session: "Sign in to your Gluca sandbox account in Settings.",
        needs_reconnect: "Reconnect Dexcom in Settings before retrieving data.",
        not_found: "Development diagnostics are disabled on this backend.",
        dexcom_not_configured:
          "Configure sandbox credentials and the registered redirect locally.",
        bad_range: "Select a valid UTC period of at most 30 days.",
        rate_limited: "Rate limited. Wait for the indicated retry delay.",
        forbidden: "Dexcom denied data access.",
        unexpected_schema:
          "Dexcom returned an unexpected response. No readings were invented.",
        upstream_rejected: "Dexcom rejected this historical request.",
      } as Record<string, string>
    )[c] ?? "The data request could not be completed. Try again later."
  );
}
/** Compatible with the existing provider contract, but scoped to this viewer's memory and current browser session. */
export class DexcomGlucoseProvider implements GlucoseProvider {
  id = "dexcom";
  connected = false;
  private range: DexcomRangeResult | null = null;
  private result: DexcomDataResult | null = null;
  private abort = new AbortController();
  private revision = 0;
  constructor(
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
    private base = "",
  ) {}
  get lastResult() {
    return this.result;
  }
  get availableRange() {
    return this.range;
  }
  clear() {
    this.abort.abort();
    this.abort = new AbortController();
    this.revision++;
    this.range = null;
    this.result = null;
    this.connected = false;
  }
  private async request(path: string, body?: unknown): Promise<unknown> {
    const epoch = this.revision;
    // AbortSignal.any is not available in every supported browser. Combine cancellation explicitly.
    const parent = this.abort.signal,
      request = new AbortController();
    const cancel = () => request.abort();
    parent.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, 20000);
    try {
      const res = await this.fetcher(this.base + path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: request.signal,
        headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new GlucoseDataError("unexpected_schema");
      }
      if (epoch !== this.revision) throw new GlucoseDataError("no_session");
      if (!res.ok) {
        this.connected = false;
        this.result = null;
        this.range = null;
        const b = data as { error?: unknown; retryAfterSeconds?: unknown };
        throw new GlucoseDataError(
          typeof b?.error === "string" && CODES.has(b.error)
            ? b.error
            : "unavailable",
          typeof b?.retryAfterSeconds === "number"
            ? b.retryAfterSeconds
            : undefined,
        );
      }
      return data;
    } catch (e) {
      if (epoch === this.revision) {
        this.result = null;
        this.range = null;
        this.connected = false;
      }
      throw e instanceof GlucoseDataError
        ? e
        : new GlucoseDataError("unavailable");
    } finally {
      clearTimeout(timer);
      parent.removeEventListener("abort", cancel);
    }
  }
  async getAvailableRange(): Promise<DexcomRangeResult> {
    const b = (await this.request(
      "/api/dexcom/data-range",
    )) as DexcomRangeResult;
    if (
      !b ||
      b.source !== "dexcom" ||
      b.environment !== "sandbox" ||
      typeof b.connectionRevision !== "string" ||
      !b.connectionRevision ||
      (b.range !== null &&
        (!b.range ||
          !isEpoch(b.range.start) ||
          !isEpoch(b.range.end) ||
          b.range.end < b.range.start))
    )
      throw new GlucoseDataError("unexpected_schema");
    if (this.range?.connectionRevision !== b.connectionRevision)
      this.result = null;
    this.range = b;
    this.connected = true;
    return b;
  }
  async getReadings(start: number, end: number): Promise<DexcomReading[]> {
    if (!validWindow({ start, end })) throw new GlucoseDataError("bad_range");
    const range = this.range ?? (await this.getAvailableRange());
    const b = (await this.request("/api/dexcom/egvs", {
      start,
      end,
      connectionRevision: range.connectionRevision,
    })) as DexcomDataResult;
    if (
      !b ||
      b.source !== "dexcom" ||
      b.environment !== "sandbox" ||
      b.connectionRevision !== range.connectionRevision ||
      !b.window ||
      b.window.start !== start ||
      b.window.end !== end ||
      !Array.isArray(b.readings) ||
      b.readings.length > 20000 ||
      !b.readings.every(
        (r) =>
          r.source === "dexcom" &&
          r.environment === "sandbox" &&
          isEpoch(r.timestamp) &&
          r.timestamp >= start &&
          r.timestamp < end &&
          typeof r.mgdl === "number" &&
          Number.isFinite(r.mgdl) &&
          r.mgdl >= 39 &&
          r.mgdl <= 401 &&
          typeof r.recordId === "string" &&
          typeof r.sourceId === "string" &&
          isEpoch(r.ingestedAt),
      )
    )
      throw new GlucoseDataError("unexpected_schema");
    this.result = b;
    this.connected = true;
    return b.readings;
  }
  async loadLatest(days = 1): Promise<DexcomDataResult | null> {
    this.result = null;
    const r = await this.getAvailableRange();
    if (!r.range) return null;
    const w = latestWindow(r.range, days);
    await this.getReadings(w.start, w.end);
    return this.result;
  }
}
