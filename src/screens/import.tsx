import React, { useState } from "react";
import { Platform, Share } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Input, T } from "../ui";
import { useDemo } from "../store";
import { hasImported, removeImported, REMOVED_IMPORT_MESSAGE } from "../state";
import {
  parseCsv,
  type CsvResult,
  type CsvUnit,
  type DateOrder,
} from "../csv";
import { Page } from "../components/page";
import { Guard } from "../components/guard";
import { track, importFailReason } from "../telemetry";
export function ImportScreen() {
  return (
    <Guard route="/import">
      <ImportFlow />
    </Guard>
  );
}
function ImportFlow() {
  const { state, set } = useDemo();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [text, Text] = useState("");
  const [offset, Offset] = useState("");
  const [order, Order] = useState<DateOrder>("auto");
  const [unit, Unit] = useState<CsvUnit | undefined>(undefined);
  const [result, R] = useState<CsvResult | null>(null);
  const [error, E] = useState("");
  // One import attempt = start (file chosen or preview pressed) to confirm / failure. Counted once per attempt.
  const attempt = React.useRef(false);
  const begin = () => {
    if (!attempt.current) track("import_started");
    attempt.current = true;
  };
  const run = (u: CsvUnit | undefined = unit) => {
    const r = parseCsv(text, { unit: u, dateOrder: order, utcOffset: offset });
    if (!r.ok && !r.needsUnit) {
      track("import_failed", { reason: importFailReason(r.error) });
      attempt.current = false;
    }
    R(r);
  };
  const pick = async () => {
    begin();
    try {
      const file = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });
      if (file.canceled) {
        track("import_failed", { reason: "user_cancelled" });
        attempt.current = false;
        return;
      }
      const a = file.assets[0];
      // Only the contents are used; the file name is never read or stored.
      const content =
        Platform.OS === "web"
          ? await a.file!.text()
          : await new File(a.uri).text();
      Text(content);
      Unit(undefined);
      R(null);
    } catch {
      track("import_failed", { reason: "unknown" });
      attempt.current = false;
      E("Unable to read the selected file. You can paste CSV text below.");
    }
  };
  return (
    <Page title="Import & export">
      <T>
        Prototype storage is for synthetic data only. Imports replace the
        selected glucose source after explicit confirmation. The file is read
        on this device; its name and any patient details are never kept. Times
        without an offset use this device's time zone unless you enter a UTC
        offset.
      </T>
      <Button label="Choose CSV file" onPress={() => void pick()} />
      <Input
        label="CSV text"
        value={text}
        onChange={(v) => {
          Text(v);
          Unit(undefined);
          R(null);
        }}
        multiline
      />
      <Input
        label="UTC offset for local timestamps (empty = this device)"
        value={offset}
        onChange={(v) => {
          Offset(v);
          R(null);
        }}
      />
      <Button
        label={`Date order: ${order === "auto" ? "detect" : order}`}
        onPress={() => {
          Order(order === "auto" ? "MDY" : order === "MDY" ? "DMY" : "auto");
          R(null);
        }}
      />
      <Button
        label="Preview import"
        onPress={() => {
          begin();
          run();
          E("");
        }}
      />
      <T>{error}</T>
      {result && result.needsUnit ? (
        <Card>
          <T>{result.message}</T>
          {(["mg/dL", "mmol/L"] as const).map((u) => (
            <Button
              key={u}
              label={`This file uses ${u}`}
              onPress={() => {
                Unit(u);
                run(u);
              }}
            />
          ))}
        </Card>
      ) : null}
      {result && !result.ok && !result.needsUnit ? (
        <Card>
          <T>{result.message}</T>
          {result.rejected.map((x) => (
            <T key={x.line}>
              Line {x.line}: {x.reason}
            </T>
          ))}
        </Card>
      ) : null}
      {result && result.ok ? (
        <Card>
          <T>
            {result.readings.length} valid readings ·{" "}
            {result.counts.duplicates} duplicates removed ·{" "}
            {result.counts.rejected} rejected rows · {result.sourceUnit}
          </T>
          {result.counts.clamped ? (
            <T>
              Sensor Low: {result.counts.low}, High: {result.counts.high}{" "}
              (shown as 40 and 400 mg/dL).
            </T>
          ) : null}
          {result.warnings.map((w) => (
            <T key={w}>{w}</T>
          ))}
          {result.rejected.map((x) => (
            <T key={x.line}>
              Line {x.line}: {x.reason}
            </T>
          ))}
          {result.counts.rejected > result.rejected.length ? (
            <T>
              Showing the first {result.rejected.length} of{" "}
              {result.counts.rejected} rejected rows.
            </T>
          ) : null}
          <Button
            label="Confirm import"
            disabled={!result.readings.length}
            onPress={() => {
              track("import_succeeded");
              attempt.current = false;
              set((s) => ({ ...s, imported: result.readings }));
              Text("");
              Unit(undefined);
              E("Imported locally. Dashboard now uses CSV data.");
              R(null);
              // Arrived from the welcome screen: go straight to a graphic.
              if (from === "welcome") router.replace("/create");
            }}
          />
        </Card>
      ) : null}
      {hasImported(state) ? (
        <Card>
          <T>
            {state.imported.length} imported readings are stored on this
            device.
          </T>
          <Button
            label="Remove imported data"
            onPress={() => {
              set(removeImported);
              E(REMOVED_IMPORT_MESSAGE);
            }}
          />
        </Card>
      ) : null}
      <Button
        label="Export local data JSON"
        onPress={() => {
          const json = JSON.stringify(state, null, 2);
          if (Platform.OS === "web") {
            const u = URL.createObjectURL(
              new Blob([json], { type: "application/json" }),
            );
            const a = document.createElement("a");
            a.href = u;
            a.download = "gluca-local-demo.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
          } else
            Share.share({ message: json }).catch(() =>
              E("Sharing unavailable."),
            );
        }}
      />
    </Page>
  );
}
