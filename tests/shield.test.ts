import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHIELD_TIERS,
  completedYears,
  localToday,
  nextAnniversary,
  shieldFor,
  shieldLabel,
  tierForYears,
} from "../src/domain/shield";

const d = (year: number, month: number, day: number) => ({ year, month, day });

test("tier boundaries by completed years", () => {
  const expect: [number, string][] = [
    [0, "teal"],
    [1, "silver"],
    [4, "silver"],
    [5, "bronze"],
    [9, "bronze"],
    [10, "gold"],
    [14, "gold"],
    [15, "amethyst"],
    [19, "amethyst"],
    [20, "sapphire"],
    [24, "sapphire"],
    [25, "emerald"],
    [29, "emerald"],
    [30, "platinum"],
    [39, "platinum"],
    [40, "diamond"],
    [49, "diamond"],
    [50, "legacy"],
    [80, "legacy"],
  ];
  for (const [y, id] of expect)
    assert.equal(tierForYears(y).id, id, `${y} years`);
});

test("every tier has a distinct non-colour mark", () => {
  assert.equal(
    new Set(SHIELD_TIERS.map((t) => t.mark)).size,
    SHIELD_TIERS.length,
  );
  assert.equal(
    new Set(SHIELD_TIERS.map((t) => t.id)).size,
    SHIELD_TIERS.length,
  );
});

test("exact date: the day before and the day of each anniversary", () => {
  for (const [years, id] of [
    [1, "silver"],
    [5, "bronze"],
    [10, "gold"],
    [15, "amethyst"],
    [20, "sapphire"],
    [25, "emerald"],
    [30, "platinum"],
    [40, "diamond"],
    [50, "legacy"],
  ] as const) {
    const diag = d(1970, 6, 15);
    const before = shieldFor(diag, d(1970 + years, 6, 14))!;
    const on = shieldFor(diag, d(1970 + years, 6, 15))!;
    assert.equal(before.years, years - 1);
    assert.notEqual(before.tier.id, id);
    assert.equal(on.years, years);
    assert.equal(on.tier.id, id);
    assert.equal(on.certain, true);
  }
});

test("same-day diagnosis is 0 years, teal", () => {
  const s = shieldFor(d(2026, 11, 16), d(2026, 11, 16))!;
  assert.equal(s.years, 0);
  assert.equal(s.tier.id, "teal");
  assert.equal(s.certain, true);
});

test("29 February completes on 1 March in non-leap years", () => {
  const diag = d(2000, 2, 29);
  assert.equal(completedYears(diag, d(2001, 2, 28))!.years, 0);
  assert.equal(completedYears(diag, d(2001, 3, 1))!.years, 1);
  assert.equal(completedYears(diag, d(2004, 2, 28))!.years, 3);
  assert.equal(completedYears(diag, d(2004, 2, 29))!.years, 4);
  assert.deepEqual(nextAnniversary(diag, d(2001, 3, 1)), d(2002, 3, 1));
  assert.deepEqual(nextAnniversary(diag, d(2003, 3, 1)), d(2004, 2, 29));
});

test("month and year: no invented day", () => {
  const diag = { year: 2010, month: 6 };
  const before = completedYears(diag, d(2020, 5, 31))!;
  assert.deepEqual(before, { years: 9, certain: true });
  const during = completedYears(diag, d(2020, 6, 30))!;
  assert.deepEqual(during, { years: 9, certain: false });
  assert.deepEqual(completedYears(diag, d(2020, 6, 1)), {
    years: 9,
    certain: false,
  });
  assert.deepEqual(completedYears(diag, d(2020, 7, 1)), {
    years: 10,
    certain: true,
  });
  // December anniversary month rolls into January
  assert.deepEqual(completedYears({ year: 2010, month: 12 }, d(2020, 12, 31)), {
    years: 9,
    certain: false,
  });
  assert.deepEqual(completedYears({ year: 2010, month: 12 }, d(2021, 1, 1)), {
    years: 10,
    certain: true,
  });
  // diagnosis month in the same year
  assert.deepEqual(completedYears(diag, d(2010, 6, 20)), {
    years: 0,
    certain: true,
  });
  assert.equal(completedYears(diag, d(2010, 5, 20)), null);
});

test("year only: conservative and uncertain", () => {
  const diag = { year: 2000 };
  assert.deepEqual(completedYears(diag, d(2000, 12, 31)), {
    years: 0,
    certain: true,
  });
  assert.deepEqual(completedYears(diag, d(2001, 1, 1)), {
    years: 0,
    certain: false,
  });
  assert.deepEqual(completedYears(diag, d(2010, 3, 1)), {
    years: 9,
    certain: false,
  });
  assert.deepEqual(completedYears(diag, d(2010, 12, 31)), {
    years: 9,
    certain: false,
  });
  assert.deepEqual(completedYears(diag, d(2011, 1, 1)), {
    years: 10,
    certain: false,
  });
  assert.equal(nextAnniversary(diag, d(2010, 3, 1)), null);
});

test("approximate dates are never certain", () => {
  assert.equal(
    completedYears(
      { year: 2000, month: 1, day: 1, approximate: true },
      d(2020, 6, 1),
    )!.certain,
    false,
  );
  assert.equal(
    completedYears({ year: 2000, month: 1, approximate: true }, d(2020, 6, 1))!
      .certain,
    false,
  );
  assert.equal(
    completedYears({ year: 2000, approximate: true }, d(2020, 6, 1))!.certain,
    false,
  );
  assert.equal(
    nextAnniversary(
      { year: 2000, month: 1, day: 1, approximate: true },
      d(2020, 6, 1),
    ),
    null,
  );
});

test("future and malformed dates give null; never negative", () => {
  assert.equal(completedYears(d(2027, 1, 1), d(2026, 11, 16)), null);
  assert.equal(completedYears(d(2026, 11, 17), d(2026, 11, 16)), null);
  assert.equal(completedYears({ year: 2027 }, d(2026, 11, 16)), null);
  assert.equal(
    completedYears({ year: 2026, month: 12 }, d(2026, 11, 16)),
    null,
  );
  assert.equal(
    completedYears({ year: 2001, month: 2, day: 30 }, d(2026, 11, 16)),
    null,
  );
  assert.equal(shieldFor(undefined, d(2026, 11, 16)), null);
  assert.equal(shieldFor({ year: 2026 }, d(2026, 1, 1))!.years, 0);
});

test("nextAnniversary is the next date the count changes", () => {
  const diag = d(2010, 6, 15);
  assert.deepEqual(nextAnniversary(diag, d(2020, 6, 14)), d(2020, 6, 15));
  assert.deepEqual(nextAnniversary(diag, d(2020, 6, 15)), d(2021, 6, 15));
  assert.deepEqual(nextAnniversary(diag, d(2020, 12, 31)), d(2021, 6, 15));
  assert.deepEqual(
    nextAnniversary(d(2026, 11, 16), d(2026, 11, 16)),
    d(2027, 11, 16),
  );
  assert.equal(nextAnniversary(d(2030, 1, 1), d(2026, 11, 16)), null);
});

test("count updates on the anniversary", () => {
  const diag = d(2016, 11, 17);
  assert.equal(shieldFor(diag, d(2026, 11, 16))!.years, 9);
  assert.equal(shieldFor(diag, d(2026, 11, 16))!.tier.id, "bronze");
  assert.equal(shieldFor(diag, d(2026, 11, 17))!.years, 10);
  assert.equal(shieldFor(diag, d(2026, 11, 17))!.tier.id, "gold");
});

test("localToday uses the local calendar day near midnight", () => {
  const justAfter = new Date(2026, 0, 1, 0, 5, 0);
  assert.deepEqual(localToday(justAfter), d(2026, 1, 1));
  const justBefore = new Date(2025, 11, 31, 23, 55, 0);
  assert.deepEqual(localToday(justBefore), d(2025, 12, 31));
});

test("labels: with, without and uncertain number", () => {
  assert.equal(
    shieldLabel("sapphire", 20),
    "Years with diabetes, sapphire shield style, 20 years",
  );
  assert.equal(
    shieldLabel("amethyst", 17, false),
    "Years with diabetes, amethyst shield style, 17 years, limited date precision",
  );
  assert.equal(
    shieldLabel("silver", 1),
    "Years with diabetes, silver shield style, 1 year",
  );
  assert.equal(
    shieldLabel("sapphire", 20, true, false),
    "Years with diabetes, sapphire shield style",
  );
  assert.equal(shieldLabel("gold"), "Years with diabetes, gold shield style");
  for (const w of [
    "better",
    "superior",
    "senior",
    "expert",
    "credib",
    "rank",
  ]) {
    assert.ok(!shieldLabel("legacy", 50).toLowerCase().includes(w));
  }
});
