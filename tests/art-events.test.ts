import { test } from "node:test";
import assert from "node:assert/strict";
import { synthetic } from "../src/providers";
import { formats, storyArtwork, defaultOptions, nativeSafe } from "../src/story";
import type { GlucaEvent } from "../src/types";

const rows = synthetic(Date.parse("2026-11-12T20:00:00"));
const anchor = Date.parse("2026-11-11T12:00:00");
const day0 = new Date(anchor).setHours(0, 0, 0, 0);
const at = (h: number) => day0 + h * 3600000;
const ev = (id: string, kind: GlucaEvent["kind"], start: number, durationMin = 0, label?: string): GlucaEvent => ({ id, kind, start, durationMin, label });

// two meals, a 45-minute activity, a note, plus events near each edge of the day
const EVENTS: GlucaEvent[] = [
  ev("a", "meal", at(7.5), 0, "Secret breakfast"),
  ev("b", "meal", at(12.5)),
  ev("c", "activity", at(17.5), 45),
  ev("d", "note", at(15)),
  ev("e", "note", at(0.02)),
  ev("f", "activity", at(23.9), 45),
];
const FORMATS = Object.keys(formats) as (keyof typeof formats)[];
const TEMPLATES = ["daily_recap", "real_side"] as const;

type Badge = { kind: string; cx: number; cy: number; r: number };
const badges = (svg: string): Badge[] =>
  [...svg.matchAll(/data-ev="(\w+)" data-b="([\d.]+),([\d.]+),([\d.]+)"/g)].map((m) => ({ kind: m[1], cx: +m[2], cy: +m[3], r: +m[4] }));
const build = (template: (typeof TEMPLATES)[number], format: keyof typeof formats, events?: GlucaEvent[], tweak: object = {}, period: "day" | "week" = "day") =>
  storyArtwork(rows, anchor, { ...defaultOptions(template, "mg/dL", format), period, ...tweak }, { events });

test("events: badges stay inside the plot, never overlap, in every format and both periods", () => {
  for (const template of TEMPLATES) for (const format of FORMATS) for (const period of ["day", "week"] as const) {
    const art = build(template, format, EVENTS, {}, period);
    const bs = badges(art.svg);
    assert.ok(bs.length >= 4, `${template}/${format}/${period} draws badges`);
    const margin = format === "Square" ? 80 : 90;
    for (const b of bs) {
      assert.ok(b.cx - b.r >= margin - 0.5 && b.cx + b.r <= formats[format][0] - margin + 0.5, "inside horizontal margins");
      assert.ok(b.cy - b.r >= 0 && b.cy + b.r <= formats[format][1], "inside the canvas");
    }
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++)
      assert.ok(Math.hypot(bs[i].cx - bs[j].cx, bs[i].cy - bs[j].cy) >= 2 * bs[i].r - 0.01, `badges ${i},${j} overlap`);
    assert.equal(art.overflow, 0);
    assert.equal(art.width, formats[format][0]);
  }
});

test("events: badges sit above the plot, clear of the range labels and the right gutter", () => {
  const art = build("daily_recap", "Story", EVENTS);
  const bs = badges(art.svg);
  // the target band rect is the first rect with a fill-opacity at the plot's left edge; its y is the plot-relative band top
  const band = /<rect x="90" y="([\d.]+)" width="([\d.]+)"/.exec(art.svg)!;
  const plotRight = 90 + +band[2];
  for (const b of bs) {
    assert.ok(b.cy + b.r < +band[1], "badge ends above the band, so above the trace and the labels");
    assert.ok(b.cx + b.r <= plotRight + 0.5, "badge ends before the right gutter");
  }
});

test("events: activity bar is clipped to the plot; events outside the window are ignored", () => {
  const art = build("daily_recap", "Story", [ev("x", "activity", at(23.5), 120)]);
  const bar = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="6"/.exec(art.svg)!;
  const band = /<rect x="90" y="[\d.]+" width="([\d.]+)"/.exec(art.svg)!;
  assert.ok(+bar[1] + +bar[2] <= 90 + +band[1] + 0.1, "bar does not pass the plot's right edge");
  const none = build("daily_recap", "Story", [ev("p", "meal", at(-3)), ev("q", "meal", at(25)), ev("r", "note", at(24))]);
  assert.equal(badges(none.svg).length, 0);
  assert.ok(!none.contents.some((l) => /Logged events/.test(l)));
});

test("events: edge-of-day events are drawn inside the bounds", () => {
  const art = build("real_side", "Square", [ev("s", "meal", at(0)), ev("t", "meal", at(23.99))]);
  const bs = badges(art.svg);
  assert.equal(bs.length, 2);
  assert.ok(bs[0].cx - 22 >= 80 - 0.5);
});

test("events: contents line wording, counts and no free text on the image", () => {
  const art = build("daily_recap", "Story", EVENTS);
  const line = art.contents.find((l) => l.startsWith("Logged events"));
  assert.equal(line, "Logged events: 3 meals, 2 activities, 2 notes (icons only, no text)".replace("3 meals", "2 meals"));
  assert.ok(!art.svg.includes("Secret breakfast"));
  const one = build("real_side", "Story", [ev("z", "activity", at(9), 30)]);
  assert.ok(one.contents.includes("Logged events: 1 activity (icons only, no text)"));
});

test("events: show.events switches them off and the list follows", () => {
  const base = defaultOptions("daily_recap");
  const off = storyArtwork(rows, anchor, { ...base, show: { ...base.show, events: false } }, { events: EVENTS });
  assert.equal(badges(off.svg).length, 0);
  assert.ok(!off.contents.some((l) => /Logged events/.test(l)));
  assert.equal(off.svg, storyArtwork(rows, anchor, { ...base, show: { ...base.show, events: false } }).svg);
});

test("events: output without events is identical to output with an empty list", () => {
  for (const template of TEMPLATES) for (const format of FORMATS) {
    const o = defaultOptions(template, "mg/dL", format);
    const plain = storyArtwork(rows, anchor, o);
    assert.equal(storyArtwork(rows, anchor, o, { events: [] }).svg, plain.svg);
    assert.deepEqual(storyArtwork(rows, anchor, o, { events: [] }).contents, plain.contents);
  }
});

test("events: native-safe svg carries no data attributes", () => {
  assert.ok(!/data-(ev|b)=/.test(nativeSafe(build("daily_recap", "Story", EVENTS).svg)));
});

test("events: many events stack into rows without overlap", () => {
  const many = Array.from({ length: 30 }, (_, i) => ev(`m${i}`, "meal", at(8) + i * 60000));
  const bs = badges(build("daily_recap", "Story", many).svg);
  assert.ok(bs.length >= 20);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++)
    assert.ok(Math.hypot(bs[i].cx - bs[j].cx, bs[i].cy - bs[j].cy) >= 43.99);
});
