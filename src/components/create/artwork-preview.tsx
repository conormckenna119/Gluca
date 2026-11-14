import React from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useColors } from "../../ui";

type Props = {
  svg: string;
  width: number;
  height: number;
  label: string;
  photoUri: string | null;
};

export const ArtworkPreview = React.forwardRef<
  React.ElementRef<typeof View>,
  Props
>(function ArtworkPreview({ svg, width, height, label, photoUri }, ref) {
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
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            style={{ position: "absolute", top: 0, left: 0, width, height }}
          />
        ) : null}
        <SvgXml xml={svg} width={width} height={height} />
      </View>
    </View>
  );
});
