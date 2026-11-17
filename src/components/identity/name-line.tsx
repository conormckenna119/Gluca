import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PartialDate, PublicProfile } from "../../domain/profile";
import { shieldLabel } from "../../domain/shield";
import { EMBLEM_LABEL, EmblemBadge } from "./emblem";
import { IdentitySheet, type IdentityTarget } from "./identity-sheet";
import { Shield } from "./shield";
import { space, useColors } from "../../ui";

/**
 * A name followed by whatever shield and emblem the person chose to share. Each is a 44 px target that opens
 * an explanation. `diagnosis` is only passed for the person's own profile, to show the next anniversary.
 */
export function NameLine({
  name,
  publicProfile,
  diagnosis,
  bold = true,
}: {
  name: string;
  publicProfile?: Pick<PublicProfile, "shield" | "emblem" | "name">;
  diagnosis?: PartialDate;
  bold?: boolean;
}) {
  const c = useColors();
  const [target, setTarget] = useState<IdentityTarget | null>(null);
  const shield = publicProfile?.shield;
  const emblem = publicProfile?.emblem;
  const label = (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{
        color: c.text,
        fontSize: 16,
        fontWeight: bold ? "700" : "400",
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      {name}
    </Text>
  );
  if (!shield && !emblem) return label;
  // Precision is explained by the accessible label and detail sheet, never drawn in the icon.
  const certain = shield?.certain !== false;
  return (
    <View
      testID="identity-name-line"
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "nowrap",
        minWidth: 0,
        maxWidth: "100%",
        columnGap: space.xs,
      }}
    >
      {label}
      {shield ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${shieldLabel(shield.tier, shield.years, certain, shield.years !== undefined)}. Opens an explanation.`}
          onPress={() =>
            setTarget({
              kind: "shield",
              tier: shield.tier,
              years: shield.years,
              certain,
              showNumber: shield.years !== undefined,
              diagnosis,
            })
          }
          style={{
            flexShrink: 0,
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Shield
            tier={shield.tier}
            years={shield.years}
            certain={certain}
            showNumber={shield.years !== undefined}
            size={30}
          />
        </Pressable>
      ) : null}
      {emblem ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${EMBLEM_LABEL[emblem]}. Opens an explanation.`}
          onPress={() => setTarget({ kind: "emblem", emblem })}
          style={{
            flexShrink: 0,
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EmblemBadge emblem={emblem} size={28} />
        </Pressable>
      ) : null}
      <IdentitySheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}
