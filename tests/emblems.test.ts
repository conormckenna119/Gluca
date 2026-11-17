import { test } from "node:test";
import assert from "node:assert/strict";
import { EMBLEMS } from "../src/domain/profile";
import {
  EMBLEM_NOTE,
  EMBLEM_NONE_LABEL,
  EMBLEM_TABLE,
} from "../src/domain/emblems";

test("every emblem has a complete table entry", () => {
  for (const e of EMBLEMS) {
    const i = EMBLEM_TABLE[e];
    assert.ok(i, e);
    assert.equal(i.id, e);
    for (const k of ["label", "line", "description", "a11y"] as const) {
      assert.ok(i[k].trim().length > 0, `${e}.${k}`);
    }
  }
  assert.equal(Object.keys(EMBLEM_TABLE).length, EMBLEMS.length);
});

test("emblem wording never implies data access or rank", () => {
  const banned =
    /\b(access|see their|view their|their glucose|readings|rank|ranking|best|top|level|score|verified|official)\b/i;
  const texts = [EMBLEM_NONE_LABEL];
  for (const e of EMBLEMS) {
    const i = EMBLEM_TABLE[e];
    texts.push(i.label, i.line, i.description, i.a11y);
  }
  for (const t of texts) assert.ok(!banned.test(t), t);
});

test("the note says an emblem is self-chosen and shares no data", () => {
  assert.match(EMBLEM_NOTE, /self-chosen/);
  assert.match(EMBLEM_NOTE, /does not share/);
});
