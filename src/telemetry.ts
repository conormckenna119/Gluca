// App-side glue for the closed-spec telemetry in src/art/telemetry.ts. Plain TypeScript so it can be tested.
// Mode is "off" unless EXPO_PUBLIC_TELEMETRY is exactly "local". There is no remote mode and no network sink.
import { telemetry, type ExportFormat, type TelemetryMode } from "./art/telemetry";
import type { ImportErrorReason } from "./csv";

export { telemetry };
export const track = telemetry.track;

export const telemetryModeFrom = (raw: string | undefined): TelemetryMode => (raw === "local" ? "local" : "off");

/** Call once at startup: configureTelemetry(process.env.EXPO_PUBLIC_TELEMETRY) (literal access, like flags). */
export function configureTelemetry(raw: string | undefined): TelemetryMode {
  const mode = telemetryModeFrom(raw);
  telemetry.setMode(mode);
  return mode;
}

const FORMAT_IDS = { Story: "story_1080x1920", Portrait: "portrait_1080x1350", Square: "square_1080x1080" } as const;
export const exportFormatId = (format: keyof typeof FORMAT_IDS, transparent: boolean): ExportFormat =>
  transparent ? "transparent_png" : FORMAT_IDS[format];

/** Maps an export error to the closed reason list. Only the category is kept, never the message. */
export function exportFailReason(e: unknown): "render" | "permission" | "unsupported" | "unknown" {
  const m = e instanceof Error ? e.message.toLowerCase() : "";
  if (m.includes("permission")) return "permission";
  if (m.includes("unavailable") || m.includes("unsupported")) return "unsupported";
  if (m.includes("render") || m.includes("png export") || m.includes("canvas")) return "render";
  return "unknown";
}

export function importFailReason(error: ImportErrorReason | undefined): "unsupported_format" | "no_valid_rows" | "parse_error" | "unknown" {
  return error === "unsupported_format" || error === "no_valid_rows" || error === "parse_error" ? error : "unknown";
}
