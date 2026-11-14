import React, { useState } from "react";
import { Platform, Share, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  Eyebrow,
  Group,
  Input,
  ListRow,
  Notice,
  Section,
  Steps,
  Stat,
  T,
  row,
  space,
} from "../ui";
import { useDemo } from "../store";
import { hasImported, removeImported, REMOVED_IMPORT_MESSAGE } from "../state";
import { parseCsv, type CsvResult, type CsvUnit, type DateOrder } from "../csv";
import { Page } from "../components/page";
import { Guard } from "../components/guard";
import { track, importFailReason } from "../telemetry";

const day = (t: number) =>
  new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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
  const [text, setText] = useState("");
  const [offset, setOffset] = useState("");
  const [order, setOrder] = useState<DateOrder>("auto");
  const [unit, setUnit] = useState<CsvUnit | undefined>(undefined);
  const [result, setResult] = useState<CsvResult | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [reading, setReading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // One import attempt = start (file chosen or preview pressed) to confirm / failure. Counted once per attempt.
  const attempt = React.useRef(false);
  const begin = () => {
    if (!attempt.current) track("import_started");
    attempt.current = true;
  };
  const run = (
    over: {
      text?: string;
      unit?: CsvUnit | undefined;
      order?: DateOrder;
      offset?: string;
    } = {},
  ) => {
    const r = parseCsv(over.text ?? text, {
      unit: "unit" in over ? over.unit : unit,
      dateOrder: over.order ?? order,
      utcOffset: over.offset ?? offset,
    });
    if (!r.ok && !r.needsUnit) {
      track("import_failed", { reason: importFailReason(r.error) });
      attempt.current = false;
    }
    setResult(r);
  };
  const pick = async () => {
    begin();
    setReading(true);
    setDone("");
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
      setText(content);
      setUnit(undefined);
      setError("");
      run({ text: content, unit: undefined });
    } catch {
      track("import_failed", { reason: "unknown" });
      attempt.current = false;
      setError(
        "Unable to read the selected file. You can paste CSV text below.",
      );
    } finally {
      setReading(false);
    }
  };

  const ok = !!result && result.ok;
  const needsUnit = !!result && result.needsUnit;
  const failed = !!result && !result.ok && !result.needsUnit;
  const current = ok ? 2 : result ? 1 : 0;

  return (
    <Page
      title="Import & export"
      subtitle="Bring in a glucose CSV in three steps, or save a copy of what is stored here."
    >
      {done ? (
        <Notice tone="success" title="Imported on this device">
          {done}
        </Notice>
      ) : null}
      {error ? (
        <Notice
          tone={error === REMOVED_IMPORT_MESSAGE ? "success" : "error"}
          title={error === REMOVED_IMPORT_MESSAGE ? "Done" : "That didn't work"}
        >
          {error}
        </Notice>
      ) : null}
      {done ? (
        <View style={{ gap: space.sm }}>
          <Button
            kind="primary"
            label="Open My Glucose"
            onPress={() => router.push("/glucose")}
          />
          <Button
            label="Create a graphic"
            onPress={() => router.push("/create")}
          />
        </View>
      ) : null}

      <Steps labels={["Choose file", "Review", "Confirm"]} current={current} />

      <Section title="1 · Choose file">
        <Card>
          <T>
            Pick a glucose export as a CSV file, such as one from Dexcom
            Clarity. It is read on this device and never uploaded. Only times
            and glucose values are kept: the file name and any patient details
            are not.
          </T>
          <Button
            kind={result ? "secondary" : "primary"}
            label="Choose CSV file"
            disabled={reading}
            onPress={() => void pick()}
          />
          <Input
            label="CSV text"
            value={text}
            onChange={(v) => {
              setText(v);
              setUnit(undefined);
              setResult(null);
            }}
            multiline
          />
          <Input
            label="UTC offset for local timestamps (empty = this device)"
            value={offset}
            onChange={(v) => {
              setOffset(v);
              setResult(null);
            }}
          />
          <T small muted>
            Times without an offset use this device's time zone unless you enter
            a UTC offset such as -05:00.
          </T>
          <Button
            label="Preview import"
            disabled={!text.trim()}
            onPress={() => {
              begin();
              setError("");
              setDone("");
              run();
            }}
          />
        </Card>
      </Section>

      {result ? (
        <Section title="2 · Review">
          {needsUnit ? (
            <Card>
              <T bold>Which unit does this file use?</T>
              <T>{result.message}</T>
              <View style={row}>
                {(["mg/dL", "mmol/L"] as const).map((u) => (
                  <Button
                    key={u}
                    label={`This file uses ${u}`}
                    onPress={() => {
                      setUnit(u);
                      run({ unit: u });
                    }}
                  />
                ))}
              </View>
            </Card>
          ) : null}

          {failed ? (
            <>
              <Notice tone="error" title="No readings could be used">
                {`${result.message ?? "The file could not be read."} Try a Clarity-style CSV export with a time column and a glucose column, or check that you picked the right file.`}
              </Notice>
              {result.rejected.length ? <Rejected result={result} /> : null}
            </>
          ) : null}

          {ok ? (
            <>
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: space.lg,
                  }}
                >
                  <Stat
                    value={String(result.readings.length)}
                    label="Readings accepted"
                  />
                  <Stat
                    value={result.sourceUnit ?? "—"}
                    label="Unit detected"
                  />
                </View>
                {result.readings.length ? (
                  <T>
                    {day(result.readings[0].timestamp)} to{" "}
                    {day(result.readings[result.readings.length - 1].timestamp)}
                  </T>
                ) : null}
                <T small muted>
                  {result.counts.duplicates} duplicate times collapsed ·{" "}
                  {result.counts.rejected} rows rejected
                </T>
                <T small muted>
                  Stored in mg/dL. Gaps stay gaps: missing time is never filled
                  in or counted as in range.
                </T>
              </Card>

              {result.counts.clamped ? (
                <Notice title="Low and High readings">
                  {`The sensor wrote Low ${result.counts.low} times and High ${result.counts.high} times. They are kept as 40 and 400 mg/dL, the ends of the sensor range, not exact values.`}
                </Notice>
              ) : null}

              {result.ambiguousDates ? (
                <Card>
                  <T bold>Which date order?</T>
                  <T small muted>
                    Dates like 03/04/2026 can be read two ways. Now reading as{" "}
                    {result.dateOrderUsed === "DMY" ? "day/month" : "month/day"}
                    .
                  </T>
                  <View style={row}>
                    {(
                      [
                        ["MDY", "Month/day"],
                        ["DMY", "Day/month"],
                      ] as const
                    ).map(([o, l]) => (
                      <Chip
                        key={o}
                        label={l}
                        selected={result.dateOrderUsed === o}
                        accessibilityLabel={`Read dates as ${l}`}
                        onPress={() => {
                          setOrder(o);
                          run({ order: o });
                        }}
                      />
                    ))}
                  </View>
                </Card>
              ) : null}

              {result.warnings.map((w) => (
                <Notice key={w} title="Heads up">
                  {w}
                </Notice>
              ))}
              {result.rejected.length ? <Rejected result={result} /> : null}
            </>
          ) : null}
        </Section>
      ) : null}

      {ok ? (
        <Section title="3 · Confirm">
          <Card>
            <T>
              Using these readings replaces any readings imported before, and My
              Glucose and Create will use them. You can remove them again at any
              time.
            </T>
            <Button
              kind="primary"
              label="Use these readings"
              disabled={!result.readings.length}
              onPress={() => {
                track("import_succeeded");
                attempt.current = false;
                const n = result.readings.length;
                set((s) => ({ ...s, imported: result.readings }));
                setText("");
                setUnit(undefined);
                setError("");
                setResult(null);
                setDone(
                  `${n} readings are now stored on this device. My Glucose and Create use them.`,
                );
                // Arrived from the welcome screen: go straight to a graphic.
                if (from === "welcome") router.replace("/create");
              }}
            />
            <Button
              label="Cancel"
              onPress={() => {
                setResult(null);
                setText("");
                setUnit(undefined);
                attempt.current = false;
              }}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Your data">
        <Group>
          {hasImported(state) ? (
            <ListRow
              destructive
              title="Remove imported data"
              detail={`${state.imported.length} imported readings are stored on this device.`}
              onPress={() => setConfirmRemove(true)}
            />
          ) : (
            <ListRow
              title="No imported readings"
              detail="The app is using synthetic demo glucose."
            />
          )}
          <ListRow
            icon="share"
            title="Export local data JSON"
            detail="Saves a copy of everything stored here, including imported readings."
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
                  setError("Sharing unavailable."),
                );
            }}
          />
        </Group>
      </Section>

      <ConfirmSheet
        visible={confirmRemove}
        title="Remove imported data?"
        body="This deletes the imported glucose readings from this device and the app goes back to synthetic demo data. Your posts and preferences are kept. This can't be undone."
        confirmLabel="Yes, remove imported data"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          set(removeImported);
          setDone("");
          setError(REMOVED_IMPORT_MESSAGE);
          setConfirmRemove(false);
        }}
      />
    </Page>
  );
}

function Rejected({ result }: { result: CsvResult }) {
  return (
    <Card>
      <Eyebrow>Rows left out</Eyebrow>
      {result.rejected.map((x) => (
        <T key={x.line} small>
          Line {x.line}: {x.reason}
        </T>
      ))}
      {result.counts.rejected > result.rejected.length ? (
        <T small muted>
          Showing the first {result.rejected.length} of {result.counts.rejected}{" "}
          rejected rows.
        </T>
      ) : (
        <T small muted>
          {result.counts.rejected} rejected{" "}
          {result.counts.rejected === 1 ? "row" : "rows"} in total.
        </T>
      )}
    </Card>
  );
}
