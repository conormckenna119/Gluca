import React from "react";
import { View } from "react-native";
import { Button, Notice, T, space } from "../../ui";
import type { Emblem } from "../../domain/profile";
import {
  formatLocalDate,
  nextAnniversary,
  shieldLabel,
  tierById,
  localToday,
} from "../../domain/shield";
import type { PartialDate } from "../../domain/profile";
import { Sheet } from "../../ui";
import { Shield } from "./shield";
import { EmblemBadge, EMBLEM_LABEL, EMBLEM_MEANING } from "./emblem";

export type IdentityTarget =
  | {
      kind: "shield";
      tier: string;
      years?: number;
      certain?: boolean;
      showNumber?: boolean;
      diagnosis?: PartialDate;
    }
  | { kind: "emblem"; emblem: Emblem };

/** Explains a shield or an emblem when it is tapped. Plain words: self-reported, optional, not a ranking. */
export function IdentitySheet({
  target,
  onClose,
}: {
  target: IdentityTarget | null;
  onClose: () => void;
}) {
  if (!target) return null;
  const isShield = target.kind === "shield";
  const title = isShield
    ? "Diabetes experience shield"
    : EMBLEM_LABEL[target.emblem];
  const next =
    isShield && target.diagnosis
      ? nextAnniversary(target.diagnosis, localToday())
      : null;
  const tier = isShield ? tierById(target.tier) : undefined;
  return (
    <Sheet
      visible
      onClose={onClose}
      title={title}
      footer={<Button label="Done" onPress={onClose} />}
    >
      <View style={{ alignItems: "center", gap: space.sm }}>
        {isShield ? (
          <Shield
            tier={target.tier}
            years={target.years}
            certain={target.certain}
            showNumber={target.showNumber}
            size={72}
          />
        ) : (
          <EmblemBadge emblem={target.emblem} size={64} />
        )}
        {isShield ? (
          <T bold>
            {shieldLabel(
              target.tier,
              target.years,
              target.certain ?? true,
              target.showNumber !== false,
            )}
          </T>
        ) : null}
      </View>
      {isShield ? (
        <>
          <T>
            The shield marks time since diagnosis, shown as a{" "}
            {tier ? tier.label : ""} tier with its own inner shape.
            {target.years !== undefined && target.certain === false
              ? " The count is approximate because the diagnosis date is not exact."
              : ""}
          </T>
          {next ? (
            <T muted>The count next changes on {formatLocalDate(next)}.</T>
          ) : null}
        </>
      ) : (
        <T>{EMBLEM_MEANING[target.emblem]}</T>
      )}
      <T muted>
        It is self-reported and optional. Nobody checks it, and it can be hidden
        any time in Settings.
      </T>
      <Notice tone="info">
        {isShield
          ? "Time since diagnosis is not a ranking. It says nothing about skill, success or how much anyone's words are worth."
          : "An emblem is not a ranking. It only tells people how someone relates to diabetes."}
      </Notice>
    </Sheet>
  );
}
