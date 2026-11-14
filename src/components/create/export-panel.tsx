import React from "react";
import { Button, Card, Eyebrow, T } from "../../ui";

export type ExportResult =
  | { kind: "idle" }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

export function ExportPanel({
  busy,
  result,
  contents,
  onShare,
  onSave,
}: {
  busy: boolean;
  result: ExportResult;
  contents: string[];
  onShare: () => void;
  onSave?: () => void;
}) {
  return (
    <>
      <Button
        kind="primary"
        label={busy ? "Exporting…" : "Export PNG / Share"}
        disabled={busy}
        onPress={onShare}
      />
      {onSave ? (
        <Button
          label="Save to photo library"
          disabled={busy}
          onPress={onSave}
        />
      ) : null}
      {result.kind !== "idle" && result.text ? (
        <T small>{result.text}</T>
      ) : null}

      <Card tone="raised">
        <Eyebrow>What’s on this image</Eyebrow>
        {contents.map((line, i) => (
          <T key={i} small>
            • {line}
          </T>
        ))}
        <T small muted>
          Only what is listed here is in the export. Exporting never posts
          anything.
        </T>
      </Card>
    </>
  );
}
