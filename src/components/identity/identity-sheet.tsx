import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { Button, T, space } from "../../ui";
import type { Emblem } from "../../domain/profile";
import {
  formatLocalDate,
  nextAnniversary,
  shieldPrecisionNote,
  tierById,
  localToday,
  SHIELD_TIERS,
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
  const [explore, showExplore] = useState(false);
  useEffect(() => showExplore(false), [target]);
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
            {target.showNumber !== false && target.years !== undefined
              ? `${target.certain === false ? "At least " : ""}${target.years} ${target.years === 1 ? "year" : "years"} with diabetes`
              : "Years kept private"}
          </T>
        ) : null}
      </View>
      {isShield ? (
        <>
          <T small muted>
            Color · {tier?.label ?? "Unknown"}
          </T>
          <T>
            The number represents completed years with diabetes. Colors mark
            different spans of time and change as supported anniversaries pass.
            They do not indicate expertise, health or status.
          </T>
          <T muted>
            {shieldPrecisionNote(target.diagnosis, target.certain ?? true)}
          </T>
          <Button
            label={explore ? "Hide shield colors" : "Explore shield colors"}
            onPress={() => showExplore((v) => !v)}
          />
          {explore ? (
            <View style={{ gap: space.md }}>
              {SHIELD_TIERS.map((style, i) => (
                <View
                  key={style.id}
                  style={{
                    flexDirection: "row",
                    gap: space.md,
                    alignItems: "center",
                  }}
                >
                  <Shield tier={style.id} years={style.minYears} size={32} />
                  <T
                    small
                  >{`${style.label} · ${i === 0 ? "Less than one year" : i === SHIELD_TIERS.length - 1 ? `${style.minYears}+ years` : `${style.minYears}–${SHIELD_TIERS[i + 1].minYears - 1} years`}`}</T>
                </View>
              ))}
            </View>
          ) : null}
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
