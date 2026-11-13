import React, { useState } from "react";
import { Platform, Share } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Button, Card, Input, T } from "../ui";
import { useDemo } from "../store";
import { parseCsv } from "../csv";
import { Page } from "../components/page";
export function ImportScreen() {
  const { state, set } = useDemo();
  const [text, Text] = useState("");
  const [offset, Offset] = useState("-05:00");
  const [order, Order] = useState<"MDY" | "DMY">("MDY");
  const [result, R] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [error, E] = useState("");
  const pick = async () => {
    try {
      const file = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });
      if (file.canceled) return;
      const a = file.assets[0];
      const content =
        Platform.OS === "web"
          ? await a.file!.text()
          : await new File(a.uri).text();
      Text(content);
      R(null);
    } catch {
      E("Unable to read the selected file. You can paste CSV text below.");
    }
  };
  return (
    <Page title="Import & export">
      <T>
        Prototype storage is for synthetic data only. Imports replace the
        selected glucose source after explicit confirmation. Local CSV times
        require an offset and date-order selection; split files at
        daylight-saving transitions.
      </T>
      <Button label="Choose CSV file" onPress={() => void pick()} />
      <Input
        label="CSV text"
        value={text}
        onChange={(v) => {
          Text(v);
          R(null);
        }}
        multiline
      />
      <Input
        label="UTC offset for local timestamps"
        value={offset}
        onChange={(v) => {
          Offset(v);
          R(null);
        }}
      />
      <Button
        label={`Date order: ${order}`}
        onPress={() => {
          Order(order === "MDY" ? "DMY" : "MDY");
          R(null);
        }}
      />
      <Button
        label="Preview import"
        onPress={() => {
          try {
            R(parseCsv(text, order, offset));
            E("");
          } catch (e) {
            E(e instanceof Error ? e.message : "Invalid CSV.");
            R(null);
          }
        }}
      />
      <T>{error}</T>
      {result ? (
        <Card>
          <T>
            {result.readings.length} valid readings · {result.duplicates}{" "}
            duplicates removed · {result.errors.length} rejected rows ·{" "}
            {result.unit}
          </T>
          {result.errors.slice(0, 8).map((e) => (
            <T key={e}>{e}</T>
          ))}
          <Button
            label="Confirm import"
            disabled={!result.readings.length}
            onPress={() => {
              set((s) => ({ ...s, imported: result.readings }));
              E("Imported locally. Dashboard now uses CSV data.");
              R(null);
            }}
          />
        </Card>
      ) : null}
      <Button
        label="Use synthetic source again"
        onPress={() => set((s) => ({ ...s, imported: [] }))}
      />
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
