import { test } from "node:test";
import assert from "node:assert/strict";
import { createTelemetry } from "../src/art/telemetry";
import { TEMPLATE_ORDER } from "../src/art/templates";
import { telemetryModeFrom, exportFormatId, exportFailReason, importFailReason } from "../src/telemetry";

const FORMATS = ["story_1080x1920", "portrait_1080x1350", "square_1080x1080", "transparent_png"];
const TEMPLATES = ["minimal_trace", "daily_recap", "transparent_overlay", "real_side", "humorous", "milestone"];

test("mode is off unless EXPO_PUBLIC_TELEMETRY is exactly 'local'; there is no remote mode", () => {
  assert.equal(telemetryModeFrom(undefined), "off");
  assert.equal(telemetryModeFrom(""), "off");
  assert.equal(telemetryModeFrom("remote"), "off");
  assert.equal(telemetryModeFrom("LOCAL"), "off");
  assert.equal(telemetryModeFrom("local"), "local");
});

test("off mode records nothing for the wired events", () => {
  const t = createTelemetry({ mode: "off" });
  t.track("app_opened");
  t.track("demo_started");
  t.track("import_started");
  t.track("import_failed", { reason: "parse_error" });
  t.track("export_started", { template: "daily_recap", format: "story_1080x1920" });
  t.track("share_sheet_opened", { template: "daily_recap", format: "story_1080x1920" });
  assert.equal(t.events().length, 0);
  assert.deepEqual(t.counts(), {});
});

test("every wired event, with the values the app produces, records only allowed enum strings", () => {
  const t = createTelemetry({ mode: "local" });
  const formats = (["Story", "Portrait", "Square"] as const).flatMap((f) => [exportFormatId(f, false), exportFormatId(f, true)]);
  assert.deepEqual([...new Set(formats)].sort(), [...FORMATS].sort());
  assert.deepEqual([...TEMPLATE_ORDER].sort(), [...TEMPLATES].sort());
  t.track("app_opened");
  t.track("demo_started");
  t.track("import_started");
  t.track("import_succeeded");
  for (const e of [undefined, "unsupported_format", "no_valid_rows", "bad_option", "parse_error"] as const)
    t.track("import_failed", { reason: importFailReason(e) });
  t.track("import_failed", { reason: "user_cancelled" });
  const errors: unknown[] = [
    new Error("Photo library permission was not granted."),
    new Error("Sharing is unavailable on this device."),
    new Error("Unable to render graphic."),
    new Error("my_secret_file.csv 142 mg/dL"),
    "not an error",
  ];
  for (const template of TEMPLATE_ORDER) {
    t.track("template_selected", { template, source: "demo" });
    t.track("template_selected", { template, source: "csv" });
    t.track("customization_opened", { template });
    for (const format of formats) {
      t.track("export_started", { template, format });
      t.track("export_succeeded", { template, format });
      t.track("share_sheet_opened", { template, format });
      for (const err of errors) t.track("export_failed", { template, format, reason: exportFailReason(err) });
    }
  }
  assert.deepEqual(t.dropped(), { events: 0, props: 0 }, "nothing the app sends should need dropping");
  const allowed: Record<string, string[]> = {
    reason: ["unsupported_format", "no_valid_rows", "parse_error", "user_cancelled", "unknown", "render", "permission", "unsupported"],
    template: TEMPLATES,
    format: FORMATS,
    source: ["demo", "csv"],
  };
  assert.ok(t.events().length > 100);
  for (const e of t.events())
    for (const [k, v] of Object.entries(e.props)) assert.ok(allowed[k]?.includes(v), `${e.name}.${k}=${v}`);
});

test("error text never reaches the payload: only the category is kept", () => {
  assert.equal(exportFailReason(new Error("C:\\Users\\me\\clarity-export.csv 142")), "unknown");
  assert.equal(exportFailReason(new Error("Photo library permission was not granted.")), "permission");
});

test("free text, numbers and unknown values are dropped from payloads", () => {
  const t = createTelemetry({ mode: "local" });
  t.track("export_failed", { template: "daily_recap", format: "story_1080x1920", reason: "my caption" as never, glucose: 142 } as never);
  t.track("template_selected", { template: "Daily recap" as never, source: "demo" });
  const [a, b] = t.events();
  assert.deepEqual(a.props, { template: "daily_recap", format: "story_1080x1920" });
  assert.deepEqual(b.props, { source: "demo" });
  assert.equal(t.dropped().props, 3);
});
