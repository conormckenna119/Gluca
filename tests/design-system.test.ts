import { test } from "node:test";
import assert from "node:assert/strict";
import { palette, layout, typography } from "../src/design/tokens";
import { contrast } from "../src/art/svg";
test("both application themes preserve readable text, primary actions and chart/interaction accents", () => {
  for (const c of Object.values(palette)) {
    for (const bg of [c.bg, c.surface, c.raised]) {
      assert.ok(contrast(c.text, bg) >= 4.5);
      assert.ok(contrast(c.muted, bg) >= 4.5);
      assert.ok(contrast(c.accent, bg) >= 3);
    }
    assert.ok(contrast(c.accentInk, c.accent) >= 4.5);
    assert.notEqual(c.below, c.inRange);
    assert.notEqual(c.above, c.inRange);
  }
  assert.equal(palette.dark.accent, "#91E6B2");
  assert.equal(palette.light.accent, "#1F7A4A");
});
test("mobile chrome dimensions and typography support comfortable targets without artwork changes", () => {
  assert.ok(layout.touchTarget >= 44);
  assert.ok(layout.buttonHeight >= 44);
  assert.ok(layout.navHeight >= 56);
  assert.ok(typography.body.fontSize >= 16);
  assert.ok(typography.caption.lineHeight > typography.caption.fontSize);
  assert.ok(typography.title.fontSize > typography.heading.fontSize);
  assert.ok(typography.metric.fontSize > typography.body.fontSize);
});
