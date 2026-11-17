import React from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { palette, useColors } from "../../ui";
import { PHOTO_LAYER, ARTWORK_LAYER } from "../../story-composition";
import { OverlayInteraction } from "./overlay-interaction";
import type { OverlayInteractionProps } from "./overlay-interaction";

type Props = {
  svg: string;
  width: number;
  height: number;
  label: string;
  photoUri: string | null;
  editing?: Omit<OverlayInteractionProps, "width" | "height">;
};

export const ArtworkPreview = React.forwardRef<
  React.ElementRef<typeof View>,
  Props
>(function ArtworkPreview(
  { svg, width, height, label, photoUri, editing },
  ref,
) {
  const c = useColors();
  return (
    <View
      style={{
        width: width + 16,
        padding: 8,
        borderRadius: 22,
        backgroundColor: c.raised,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      {/* Preview-only matte shows transparent white ink in light mode.
          It is a sibling of the capture surface, never an exported background. */}
      {!photoUri ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 8,
            top: 8,
            width,
            height,
            backgroundColor: palette.dark.raised,
          }}
        />
      ) : null}
      <View
        ref={ref}
        collapsable={false}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{
          width,
          height,
          backgroundColor: "transparent",
          overflow: "hidden",
        }}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            style={{ ...PHOTO_LAYER, width, height }}
          />
        ) : null}
        <View pointerEvents="none" style={ARTWORK_LAYER}>
          <SvgXml xml={svg} width={width} height={height} />
        </View>
      </View>
      {editing ? (
        <OverlayInteraction {...editing} width={width} height={height} />
      ) : null}
    </View>
  );
});
