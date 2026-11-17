import React, { useState } from "react";
import { View } from "react-native";
import { Chip, Input, T, space } from "../../ui";
import {
  MAX_MODEL_LENGTH,
  isValidBirthday,
  type Birthday,
} from "../../domain/profile";
import { birthdayFrom, monthName } from "../../domain/onboarding";
/** Single choice. Tapping the chosen option again clears it, so every answer can be taken back. */
export function ChoiceChips<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value?: T;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <View style={{ gap: space.sm, alignItems: "flex-start" }}>
      {options.map((o) => (
        <Chip
          key={o}
          label={labels[o]}
          selected={value === o}
          onPress={() => onChange(value === o ? undefined : o)}
        />
      ))}
    </View>
  );
}

export function ModelInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Input
      label={label}
      value={value ?? ""}
      maxLength={MAX_MODEL_LENGTH}
      placeholder="Optional"
      onChange={(v) => onChange(v || undefined)}
    />
  );
}

/** Month and day only. No year is asked for or stored. */
export function BirthdayFields({
  value,
  onChange,
  onValidityChange,
}: {
  value?: Birthday;
  onChange: (v: Birthday | undefined) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [m, setM] = useState(value?.month ? String(value.month) : "");
  const [d, setD] = useState(value?.day ? String(value.day) : "");
  const [error, setError] = useState<string | undefined>();
  const update = (nm: string, nd: string) => {
    setM(nm);
    setD(nd);
    if (!nm && !nd) {
      onValidityChange?.(true);
      setError(undefined);
      return onChange(undefined);
    }
    const date = nm && nd ? birthdayFrom(Number(nm), Number(nd)) : undefined;
    if (date && isValidBirthday(date)) {
      onValidityChange?.(true);
      setError(undefined);
      return onChange(date);
    }
    onValidityChange?.(false);
    setError(
      nm && nd
        ? "That is not a real date."
        : "Enter both the month and the day.",
    );
    onChange(undefined);
  };
  const digits = (s: string) => s.replace(/\D/g, "");
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Month"
            value={m}
            placeholder="1 to 12"
            maxLength={2}
            onChange={(v) => update(digits(v), d)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Day"
            value={d}
            placeholder="1 to 31"
            maxLength={2}
            onChange={(v) => update(m, digits(v))}
          />
        </View>
      </View>
      {value?.month ? (
        <T small muted>{`${value.day} ${monthName(value.month)}`}</T>
      ) : null}
      {error ? (
        <T small bold>
          {error}
        </T>
      ) : null}
    </View>
  );
}
