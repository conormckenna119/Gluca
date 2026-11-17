import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configureNativeFonts,
  nativeSafe,
  storyArtwork,
  defaultOptions,
  templateIds,
  formats,
} from "../src/story";
import { headlineForPeriod } from "../src/art/copy";
import { synthetic } from "../src/providers";

const rows = synthetic(Date.parse("2026-11-12T20:00:00"));
const anchor = Date.parse("2026-11-11T12:00:00");
const MAP = { 500: "F500", 600: "F600", 700: "F700", 800: "F800" };

test("nativeSafe maps each text and tspan to a per-weight family and leaves no family list", () => {
  const svg =
    '<svg font-family="A, B"><text font-size="9" font-weight="800">12<tspan font-weight="600" font-size="3">mg</tspan><tspan dx="2">x</tspan></text><text font-size="4">t</text></svg>';
  configureNativeFonts(MAP);
  try {
    const out = nativeSafe(svg);
    assert.ok(!out.includes("A, B"));
    assert.match(out, /<text font-size="9" font-family="F800">/);
    assert.match(
      out,
      /<tspan font-weight="600" font-size="3" font-family="F600">|<tspan font-size="3" font-family="F600">/,
    );
    assert.match(out, /<tspan dx="2" font-family="F800">/); // inherits the parent's weight
    assert.match(out, /<text font-size="4" font-family="F500">/); // no weight: nearest to 400 is 500
  } finally {
    configureNativeFonts(null);
  }
});
test("unconfigured nativeSafe strips font-family exactly as before", () => {
  configureNativeFonts(null);
  assert.equal(
    nativeSafe('<text font-family="X" font-weight="700">a</text>'),
    '<text font-weight="700">a</text>',
  );
});
test("configured native artwork: every text has one registered family", () => {
  configureNativeFonts(MAP);
  try {
    for (const template of templateIds) {
      const svg = storyArtwork(rows, anchor, defaultOptions(template), {
        native: true,
      }).svg;
      const tags = svg.match(/<(text|tspan)\b[^>]*>/g) ?? [];
      assert.ok(tags.length > 0);
      for (const t of tags)
        assert.match(
          t,
          /font-family="F(500|600|700|800)"/,
          `${template}: ${t}`,
        );
      assert.ok(!/GlucaInter|<style|<filter/.test(svg));
    }
  } finally {
    configureNativeFonts(null);
  }
});
test("native output has no ignored filter and emulates the glow with two round strokes", () => {
  const web = storyArtwork(rows, anchor, defaultOptions("daily_recap")).svg;
  assert.ok(web.includes('filter="url(#bl)"'));
  const native = storyArtwork(rows, anchor, defaultOptions("daily_recap"), {
    native: true,
  }).svg;
  assert.ok(!/filter|feGaussianBlur/.test(native));
  const glow =
    native.match(
      /<path [^>]*stroke-linecap="round"[^>]*opacity="0\.(1|16)"\/>/g,
    ) ?? [];
  assert.equal(glow.length, 2);
  const widths = glow.map((g) => Number(/stroke-width="([\d.]+)"/.exec(g)![1]));
  assert.ok(widths.every((w) => w > 8));
  assert.notEqual(widths[0], widths[1]);
});

test("week artwork swaps built-in single-day headlines, never a custom one", () => {
  assert.equal(headlineForPeriod("Daily recap", "week"), "Weekly recap");
  assert.equal(headlineForPeriod("Daily recap", "day"), "Daily recap");
  assert.equal(
    headlineForPeriod("My own words about a day", "week"),
    "My own words about a day",
  );
  const o = { ...defaultOptions("daily_recap"), period: "week" as const };
  const week = storyArtwork(rows, anchor, o).contents;
  assert.ok(week.includes("Headline: “Weekly recap”"), week.join("|"));
  const custom = storyArtwork(rows, anchor, {
    ...o,
    headline: "Another day of showing up",
  }).contents;
  assert.ok(!custom.some((c) => c.includes("week of")));
});

test("target labels sit in a gutter right of the trace and do not overlap each other, in every format", () => {
  for (const template of templateIds) {
    for (const format of Object.keys(formats) as (keyof typeof formats)[]) {
      for (const period of ["day", "week"] as const) {
        const o = { ...defaultOptions(template, "mg/dL", format), period };
        if (!o.show.band) continue;
        const svg = storyArtwork(rows, anchor, o).svg;
        const labels = [
          ...svg.matchAll(
            /<text x="([\d.]+)" y="([\d.]+)" font-size="24" font-weight="600"[^>]*text-anchor="end"[^>]*>(70|180)<\/text>/g,
          ),
        ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), t: m[3] }));
        if (!labels.length) continue;
        assert.equal(labels.length, 2, `${template}/${format}`);
        const traceMaxX = Math.max(
          ...[
            ...svg.matchAll(
              /<path d="(M[^"]*)" fill="none" stroke="[^"]*" stroke-width="[\d.]+" stroke-linecap="round"/g,
            ),
          ].flatMap((m) =>
            [...m[1].matchAll(/[ML]([\d.]+) /g)].map((n) => Number(n[1])),
          ),
        );
        for (const l of labels)
          assert.ok(
            l.x - 2 * 24 * 0.62 > traceMaxX - 1,
            `${template}/${format}/${period}: ${l.t} label overlaps trace`,
          );
        const [a, b] = labels.sort((p, q) => p.y - q.y);
        assert.ok(b.y - a.y >= 24, `${template}/${format}: labels overlap`);
      }
    }
  }
});
