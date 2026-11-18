import React, { useState } from "react";
import { View } from "react-native";
import { Button, Card, Notice, Input, T, space } from "../../ui";
export type ExportResult =
  { kind: "idle" } | { kind: "success" | "error"; text: string };
export function ExportPanel({
  busy,
  disabled = false,
  result,
  contents,
  onShare,
  onSave,
  posting = false,
  description,
  onDescription,
}: {
  busy: boolean;
  disabled?: boolean;
  result: ExportResult;
  contents: string[];
  onShare: () => void;
  onSave?: () => void;
  posting?: boolean;
  description: string;
  onDescription: (v: string) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  return (
    <>
      <Button
        label={
          advanced ? "Hide accessibility options" : "Accessibility options"
        }
        onPress={() => setAdvanced((v) => !v)}
      />
      {advanced ? (
        <Card>
          <T bold>Image description</T>
          <Input
            label="Image description (optional)"
            value={description}
            onChange={(v) => onDescription(v.slice(0, 2000))}
            multiline
          />
          <T small muted>
            Used as alternative text on Gluca. Leave empty for the generated
            description.
          </T>
          <View style={{ gap: space.xs }}>
            {contents.map((line, i) => (
              <T key={i} small muted>
                {line}
              </T>
            ))}
          </View>
        </Card>
      ) : null}
      <Button
        kind="primary"
        label={
          busy
            ? posting
              ? "Exporting and posting…"
              : "Exporting…"
            : posting
              ? "Export & Post"
              : "Export Graphic"
        }
        disabled={busy || disabled}
        onPress={onShare}
      />
      {onSave ? (
        <Button
          label="Save to photo library"
          disabled={busy || disabled}
          onPress={onSave}
        />
      ) : null}
      {result.kind !== "idle" ? (
        <Notice tone={result.kind === "error" ? "error" : "success"}>
          {result.text}
        </Notice>
      ) : null}
    </>
  );
}
