import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, T, space } from "../ui";
import { useSynchronizedGlucose } from "../glucose-context";
import { sessionEvent } from "../services/session-events";
import { glucoseDataMessage, GlucoseDataError } from "../services/dexcom-data";
import { router } from "expo-router";
export function GlucoseSyncStatus() {
  const sync = useSynchronizedGlucose(),
    [, render] = useState(0);
  const s = sync.state;
  useEffect(() => {
    if (s.retryAt <= Date.now()) return;
    const t = setTimeout(
      () => render((n) => n + 1),
      s.retryAt - Date.now() + 50,
    );
    return () => clearTimeout(t);
  }, [s.retryAt]);
  if (!sync.enabled) return null;
  const latest = s.data?.rows.at(-1)?.timestamp;
  const error =
    s.error === "cache_deleted"
      ? "Local glucose history deleted. Automatic sync is paused; Sync Now resumes it."
      : s.error === "session_verification_required"
        ? "Verify your Gluca session to use private cached data again."
        : s.error
          ? glucoseDataMessage(new GlucoseDataError(s.error))
          : "";
  return (
    <Card>
      <T bold>
        Dexcom Sandbox ·{" "}
        {s.connection === "connected"
          ? "Connected"
          : s.connection === "reconnect"
            ? "Reconnect"
            : s.connection === "checking"
              ? "Checking connection"
              : s.connection === "unavailable"
                ? "Unavailable"
                : "Disconnected"}
      </T>
      <T small>
        {s.busy
          ? "Synchronizing…"
          : s.data
            ? "Cached history ready"
            : "No private cached history loaded"}
      </T>
      <T small>
        Last successful sync:{" "}
        {s.data?.lastSuccess
          ? new Date(s.data.lastSuccess).toLocaleString()
          : "Not yet"}
      </T>
      <T small>
        Newest cached reading:{" "}
        {latest ? new Date(latest).toISOString() : "None"}
      </T>
      {s.data?.available ? (
        <T small>
          Newest available device timestamp:{" "}
          {new Date(s.data.available.end).toISOString()}
        </T>
      ) : null}
      <T small muted>
        Simulated, delayed Dexcom data—not real-time glucose. Browser cache
        lasts only in this open app; a page reload starts with an empty cache.
      </T>
      {error ? (
        <View accessibilityRole="alert">
          <T small>{error}</T>
          {s.retryAt > Date.now() ? (
            <T small>
              Retry available after {new Date(s.retryAt).toLocaleTimeString()}.
            </T>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button
          label="Sync Now"
          disabled={s.busy || s.retryAt > Date.now()}
          onPress={() => void sync.syncNow()}
        />
        <Button
          label="Delete local glucose history"
          onPress={() => sessionEvent("purge")}
        />
        <Button
          label="Connection settings"
          onPress={() => router.push("/settings")}
        />
      </View>
    </Card>
  );
}
