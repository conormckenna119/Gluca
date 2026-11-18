import React from "react";
import { Text, View } from "react-native";
import { Mark, layout, space, typeface, useColors } from "../ui";
import { BRAND } from "../art/brand";
/** Natural-size header content; the router retains responsibility for status-bar safe areas. */
export function BrandHeader() {
  const c = useColors();
  return (
    <View
      testID="brand-header"
      style={{
        height: layout.headerHeight,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: space.sm,
      }}
    >
      <Mark size={28} />
      <Text
        style={{
          fontFamily: typeface,
          color: c.text,
          fontSize: 21,
          fontWeight: "800",
          letterSpacing: -0.7,
        }}
      >
        {BRAND.name}
      </Text>
    </View>
  );
}
