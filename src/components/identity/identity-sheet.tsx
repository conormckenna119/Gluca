import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, T, space } from "../../ui";
import type { Emblem } from "../../domain/profile";
import {
  formatLocalDate,
  nextAnniversary,
  shieldPrecisionNote,
  tierById,
  localToday,
} from "../../domain/shield";
import type { PartialDate } from "../../domain/profile";
import { Sheet } from "../../ui";
import { Shield } from "./shield";
import { EmblemBadge } from "./emblem";
import { EMBLEM_NOTE, EMBLEM_TABLE } from "../../domain/emblems";

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
  const insets = useSafeAreaInsets();
  if (!target) return null;
  const isShield = target.kind === "shield";
  const title = isShield
    ? "Years with diabetes"
    : EMBLEM_TABLE[target.emblem].label;
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
      footer={
        <View style={{ paddingBottom: insets.bottom }}>
          <Button label="Done" onPress={onClose} />
        </View>
      }
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
            {target.showNumber !== false && target.years !== undefined
              ? `${target.years} ${target.years === 1 ? "year" : "years"} with diabetes`
              : "Years kept private"}
          </T>
        ) : null}
      </View>
      {isShield ? (
        <>
          <T bold>Shield style · {tier?.label ?? "Unknown"}</T>
          <T>
            A personal way to share time with diabetes. Everyone’s experience is
            different.
          </T>
          <T muted>
            {shieldPrecisionNote(target.diagnosis, target.certain ?? true)}
          </T>
          {next ? (
            <T muted>Next anniversary: {formatLocalDate(next)}.</T>
          ) : null}
        </>
      ) : (
        <T>{EMBLEM_TABLE[target.emblem].description}</T>
      )}
      <T muted>
        Self-reported and optional. Hide your shield or emblem in Profile
        settings at any time.
      </T>
      {!isShield ? (
        <T small muted>
          {EMBLEM_NOTE}
        </T>
      ) : null}
    </Sheet>
  );
}
