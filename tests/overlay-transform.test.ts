import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OVERLAY,
  normalizeOverlay,
  moveOverlay,
  scaleOverlay,
  overlayBounds,
  transformOverlaySvg,
} from "../src/overlay-transform";
import {
  defaultOptions,
  formats,
  pickTone,
  storyArtwork,
  switchTemplate,
  templateIds,
  TONES,
} from "../src/story";
import { synthetic } from "../src/providers";
import { storyComposition } from "../src/story-composition";
const anchor = Date.parse("2026-11-16T12:00:00Z");
const rows = synthetic(Date.parse("2026-11-16T23:59:00Z"));
test("normalized movement, keyboard nudges and touch pinch use canvas fractions, with reachable bounds", () => {
  const t = moveOverlay({ ...DEFAULT_OVERLAY, scale: 0.6 }, 0.1, -0.2);
  assert.equal(t.x, 0.6);
  assert.equal(t.y, 0.3);
  assert.ok(Math.abs(scaleOverlay(t, 1.5).scale - 0.9) < 1e-12);
  assert.equal(scaleOverlay(t, 100).scale, 1.5);
  assert.equal(scaleOverlay(t, 0.001).scale, 0.5);
  assert.equal(moveOverlay(t, 100, -100).x, 0.9);
  assert.equal(moveOverlay(t, 100, -100).y, 0.1);
  assert.deepEqual(
    normalizeOverlay({
      ...DEFAULT_OVERLAY,
      x: NaN,
      y: Infinity,
      scale: NaN,
      opacity: NaN,
    }),
    DEFAULT_OVERLAY,
  );
  assert.equal(normalizeOverlay({ ...t, opacity: -1 }).opacity, 0.2);
  assert.equal(normalizeOverlay({ ...t, opacity: 2 }).opacity, 1);
});
test("preview/export affine coordinates preserve aspect, dimensions and alpha in every format", () => {
  for (const format of Object.keys(formats) as (keyof typeof formats)[]) {
    const [w, h] = formats[format],
      t = { ...DEFAULT_OVERLAY, x: 0.6, y: 0.4, scale: 0.5, opacity: 0.7 };
    const b = overlayBounds(t, w, h);
    assert.equal(b.left, 0.35 * w);
    assert.ok(Math.abs(b.top - 0.15 * h) < 0.000001);
    assert.equal(b.width / b.height, w / h);
    const art = storyArtwork(
      rows,
      anchor,
      defaultOptions("transparent_overlay", "mg/dL", format),
    );
    const preview = transformOverlaySvg(art.svg, w, h, t);
    assert.ok(preview.includes(`viewBox="0 0 ${w} ${h}"`));
    assert.ok(preview.includes(`translate(${b.left} ${b.top}) scale(0.5)`));
    assert.ok(preview.includes('opacity="0.7"'));
    assert.ok(!preview.includes('data-bg="1"'));
    assert.ok(!preview.includes("data-resize"));
    // Mandatory simulation disclosure is outside the movable/faded group.
    assert.match(
      preview,
      /<\/g><g id="source-disclosure"><text[^>]*>DEMO DATA/,
    );
  }
});
test("photo add/replace/remove, date and template changes leave placement and source data independent", () => {
  const placement = {
      ...DEFAULT_OVERLAY,
      x: 0.4,
      y: 0.6,
      scale: 0.65,
      opacity: 0.8,
    },
    snapshot = JSON.stringify(placement),
    source = JSON.stringify(rows);
  for (const photo of [null, "synthetic-a", "synthetic-b", null]) {
    assert.equal(storyComposition(true, photo).photoUri, photo);
    for (const id of templateIds) {
      const o = {
        ...switchTemplate(defaultOptions("transparent_overlay"), id),
        transparent: true,
      };
      for (const date of [anchor, anchor - 86400000]) {
        const svg = transformOverlaySvg(
          storyArtwork(rows, date, o).svg,
          1080,
          1920,
          placement,
        );
        assert.ok(svg.includes("scale(0.65)"));
        assert.equal(JSON.stringify(placement), snapshot);
      }
    }
  }
  assert.equal(JSON.stringify(rows), source);
});
test("all template defaults are neutral/minimal; generated tones are opt-in and custom text survives style changes", () => {
  assert.deepEqual(TONES, [
    "minimal",
    "casual",
    "humorous",
    "motivational",
    "custom",
  ]);
  for (const id of templateIds) {
    const o = defaultOptions(id);
    assert.equal(o.tone, "minimal");
    assert.equal(o.caption, "");
    assert.doesNotMatch(
      storyArtwork(rows, anchor, o).svg,
      /showing up|chose chaos|Stronger than|Pancreas replacement/,
    );
  }
  const custom = {
    ...defaultOptions("daily_recap"),
    tone: "custom" as const,
    headline: "My own words",
    caption: "My caption",
  };
  assert.equal(switchTemplate(custom, "real_side").caption, custom.caption);
  assert.equal(switchTemplate(custom, "humorous").headline, custom.headline);
  assert.equal(pickTone(custom, "custom").caption, custom.caption);
  assert.equal(pickTone(custom, "minimal").caption, "");
  assert.equal(pickTone(custom, "casual").tone, "casual");
  const exactDefaultWords = {
    ...custom,
    headline: "Daily recap",
    period: "week" as const,
  };
  assert.ok(
    storyArtwork(rows, anchor, exactDefaultWords).contents.includes(
      "Headline: “Daily recap”",
    ),
  );
  const cleared = { ...custom, headline: "", caption: "" };
  for (const id of ["real_side", "humorous"] as const) {
    const artwork = storyArtwork(rows, anchor, switchTemplate(cleared, id));
    assert.ok(!artwork.contents.some((c) => c.startsWith("Caption:")));
    assert.doesNotMatch(artwork.svg, /Some days|Pancreas replacement/);
  }
});
