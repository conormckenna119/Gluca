import React from "react";
import { View } from "react-native";
import { Button, Eyebrow, T, row, space } from "../../ui";
import {
  templateIds,
  templateInfo,
  type StoryOptions,
  type TemplateId,
} from "../../story";
import type { Reading } from "../../types";

export function TemplateStrip({
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
  return (
    <View style={{ gap: space.sm }}>
      <Eyebrow>Template</Eyebrow>
      <View style={row}>
        {templateIds.map((t) => (
          <Button
            key={t}
            label={templateInfo[t].label}
            selected={t === options.template}
            disabled={templateInfo[t].needsData && noData}
            onPress={() => onSelect(t)}
          />
        ))}
      </View>
      <T small muted>
        {templateInfo[options.template].blurb}
      </T>
    </View>
  );
}
