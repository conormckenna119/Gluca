import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARTWORK_LAYER,
  PHOTO_LAYER,
  storyComposition,
} from "../src/story-composition";
import {
  defaultOptions,
  switchTemplate,
  storyArtwork,
  formats,
} from "../src/story";
import { synthetic } from "../src/providers";
test("photo is below a positioned SVG foreground, regardless of Image stacking contexts", () => {
  assert.equal(PHOTO_LAYER.position, "absolute");
  assert.equal(ARTWORK_LAYER.position, "absolute");
  assert.ok(ARTWORK_LAYER.zIndex > PHOTO_LAYER.zIndex);
});
test("photo selection, replacement and removal leave template, data and styling unchanged", () => {
  const options = {
    ...defaultOptions("transparent_overlay"),
    headline: "Synthetic caption",
  };
  const before = JSON.stringify(options),
    rows = synthetic(Date.parse("2026-11-16T23:59:00Z")),
    anchor = Date.parse("2026-11-16T12:00:00Z");
  const artwork = storyArtwork(rows, anchor, options);
  for (const uri of [null, "synthetic-photo-a", "synthetic-photo-b", null]) {
    assert.equal(storyComposition(true, uri).photoUri, uri);
    assert.equal(JSON.stringify(options), before);
    assert.equal(storyArtwork(rows, anchor, options).svg, artwork.svg);
  }
  assert.equal(storyComposition(false, "synthetic-photo-a").photoUri, null);
  const other = switchTemplate(options, "daily_recap"),
    returned = switchTemplate(other, "transparent_overlay");
  assert.equal(returned.template, "transparent_overlay");
  assert.equal(
    storyComposition(returned.transparent, "synthetic-photo-b").photoUri,
    "synthetic-photo-b",
  );
});
test("transparent art keeps exact dimensions and no opaque full-canvas background without a photo", () => {
  const rows = synthetic(Date.parse("2026-11-16T23:59:00Z")),
    anchor = Date.parse("2026-11-16T12:00:00Z");
  for (const format of Object.keys(formats) as (keyof typeof formats)[]) {
    const options = defaultOptions("transparent_overlay", "mg/dL", format),
      art = storyArtwork(rows, anchor, options);
    assert.ok(
      art.svg.includes(
        `viewBox="0 0 ${formats[format][0]} ${formats[format][1]}"`,
      ),
    );
    assert.equal(
      storyComposition(options.transparent, null).background,
      "transparent",
    );
    assert.ok(art.contents.some((s) => s.includes("transparent")));
  }
});
