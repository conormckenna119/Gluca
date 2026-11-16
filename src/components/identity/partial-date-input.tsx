import React, { useState } from "react";
import { View } from "react-native";
import { isValidPartialDate, type PartialDate } from "../../domain/profile";
import { Group, Input, SwitchRow, T, space } from "../../ui";

const digits = (s: string) => s.replace(/\D/g, "");

type Parts = { y: string; m: string; d: string; approx: boolean };

/** Parse typed parts. Only parts that were typed are used: a missing month or day is never filled in. */
export function parseParts(
  p: Parts,
  maxYear: number,
): { value?: PartialDate; error?: string } {
  if (!p.y && !p.m && !p.d) return {};
  if (!p.y) return { error: "Enter the year first." };
  const date: PartialDate = { year: Number(p.y) };
  if (p.m) date.month = Number(p.m);
  if (p.d) date.day = Number(p.d);
  if (p.approx) date.approximate = true;
  if (p.d && !p.m)
    return {
      error: "A day needs a month. Leave the day empty if you are not sure.",
    };
  if (!isValidPartialDate(date, 1900, maxYear)) {
    return {
      error: `That is not a real date. The year must be between 1900 and ${maxYear}.`,
    };
  }
  return { value: date };
}

/**
 * Year, optional month, optional day, and a switch for "not sure". Calls `onChange` with a valid date, or
 * undefined while the fields are empty or invalid. Never fills in a part that was left empty.
 */
export function PartialDateInput({
  label,
  value,
  onChange,
  maxYear = new Date().getFullYear(),
  allowApproximate = true,
}: {
  label: string;
  value?: PartialDate;
  onChange: (v: PartialDate | undefined) => void;
  maxYear?: number;
  allowApproximate?: boolean;
}) {
  const [parts, setParts] = useState<Parts>({
    y: value ? String(value.year) : "",
    m: value?.month !== undefined ? String(value.month) : "",
    d: value?.day !== undefined ? String(value.day) : "",
    approx: value?.approximate === true,
  });
  const [error, setError] = useState<string | undefined>();
  const update = (next: Parts) => {
    setParts(next);
    const r = parseParts(next, maxYear);
    setError(r.error);
    onChange(r.value);
  };
  return (
    <View style={{ gap: space.md }}>
      <T small muted bold>
        {label}
      </T>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 2 }}>
          <Input
            label="Year"
            value={parts.y}
            placeholder="2010"
            maxLength={4}
            onChange={(v) => update({ ...parts, y: digits(v) })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Month (optional)"
            value={parts.m}
            placeholder="1 to 12"
            maxLength={2}
            onChange={(v) => update({ ...parts, m: digits(v) })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Day (optional)"
            value={parts.d}
            placeholder="1 to 31"
            maxLength={2}
            onChange={(v) => update({ ...parts, d: digits(v) })}
          />
        </View>
      </View>
      {allowApproximate ? (
        <Group>
          <SwitchRow
            title="Not sure of the exact date"
            detail="Your shield then says “about” and never claims more than you entered."
            value={parts.approx}
            onChange={(v) => update({ ...parts, approx: v })}
          />
        </Group>
      ) : null}
      {error ? (
        <T small bold>
          {error}
        </T>
      ) : null}
    </View>
  );
}
