import React, { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Eyebrow, Icon, T, radius, space, useColors } from "../../ui";
import {
  formats,
  storyArtwork,
  switchTemplate,
  templateIds,
  templateInfo,
  type StoryOptions,
  type TemplateId,
} from "../../story";
import type { Reading } from "../../types";

const THUMB_W = 84;

export function TemplateStrip({
  data,
  anchor,
  options,
  noData,
  onSelect,
}: {
  data: Reading[];
  anchor: number;
  options: StoryOptions;
  noData: boolean;
  onSelect: (id: TemplateId) => void;
}) {
  const c = useColors();
  const [fw, fh] = formats[options.format];
  const thumbH = Math.round((THUMB_W * fh) / fw);

  const svgs = useMemo(() => {
    const out = {} as Record<TemplateId, string>;
    for (const id of templateIds) {
      const o = id === options.template ? options : switchTemplate(options, id);
      out[id] = storyArtwork(data, anchor, { ...o }, { native: true }).svg;
    }
    return out;
  }, [data, anchor, options]);

  return (
    <View style={{ gap: space.sm }}>
      <Eyebrow>Template</Eyebrow>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ alignSelf: "stretch" }}
        contentContainerStyle={{
          gap: space.md,
          paddingVertical: space.xs,
          paddingRight: space.sm,
        }}
      >
        {templateIds.map((t) => {
          const selected = t === options.template;
          const disabled = templateInfo[t].needsData && noData;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={templateInfo[t].label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(t)}
              style={{
                width: THUMB_W + 8,
                minHeight: 44,
                alignItems: "center",
                gap: space.xs,
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: THUMB_W + 8,
                  height: thumbH + 8,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.md,
                  borderWidth: selected ? 3 : 1,
                  borderColor: selected ? c.accent : c.border,
                  backgroundColor: c.surface,
                }}
              >
                <View
                  style={{
                    width: THUMB_W,
                    height: thumbH,
                    borderRadius: radius.sm,
                    overflow: "hidden",
                  }}
                >
                  <SvgXml xml={svgs[t]} width={THUMB_W} height={thumbH} />
                </View>
                {selected ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: c.accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="check" size={14} color={c.accentInk} />
                  </View>
                ) : null}
              </View>
              <T small muted={!selected} bold={selected} align="center">
                {templateInfo[t].label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <T small muted>
        {templateInfo[options.template].blurb}
      </T>
    </View>
  );
}
