import React from "react";
import { View } from "react-native";
import { Button, Card, Eyebrow, Icon, Notice, T, space } from "../../ui";

export type ExportResult =
  | { kind: "idle" }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

export function ExportPanel({
  busy,
  disabled = false,
  result,
  contents,
  onShare,
  onSave,
}: {
  busy: boolean;
  disabled?: boolean;
  result: ExportResult;
  contents: string[];
  onShare: () => void;
  onSave?: () => void;
}) {
  return (
    <>
      <Card tone="raised">
        <Eyebrow>What’s on this image</Eyebrow>
        {contents.map((line, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              gap: space.sm,
              alignItems: "center",
            }}
          >
            <Icon name="check" size={16} />
            <View style={{ flex: 1 }}>
              <T small>{line}</T>
            </View>
          </View>
        ))}
        <T small muted>
          Only what is listed here is in the export. Exporting never posts
          anything.
        </T>
      </Card>
      <Button
        kind="primary"
        label={busy ? "Exporting…" : "Export PNG / Share"}
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
      {result.kind === "success" && result.text ? (
        <Notice tone="success">{result.text}</Notice>
      ) : null}
      {result.kind === "error" ? (
        <Notice tone="error">
          <T small>{result.text}</T>
          <T small muted>
            Try again. If it keeps failing, try a different format or turn off
            Transparent.
          </T>
        </Notice>
      ) : null}
    </>
  );
}
