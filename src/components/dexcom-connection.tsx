import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { Button, Card, Input, Notice, Section, T, row } from "../ui";
import { sessionEvent } from "../services/session-events";
import {
  createOAuthClient,
  connectionLabel,
  connectionMessage,
  type ConnectionStatus,
} from "../services/dexcom-oauth";
// Web uses one origin for cookies and the HTTPS callback. Native handoff is a later platform gate.
const client = createOAuthClient();
export function DexcomConnection() {
  const [signedIn, S] = useState(false);
  const [status, Status] = useState<ConnectionStatus | null>(null);
  const [username, U] = useState("");
  const [password, P] = useState("");
  const [busy, B] = useState(false);
  const [message, M] = useState("");
  const { dexcom } = useLocalSearchParams<{ dexcom?: string }>();
  async function reload() {
    const session = await client.session();
    S(session.session);
    Status(session.session ? await client.status() : null);
  }
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "web") return;
      let alive = true;
      const update = () =>
        client
          .session()
          .then(async (s) => {
            if (!alive) return;
            S(s.session);
            Status(s.session ? await client.status() : null);
            if (alive)
              M((previous) =>
                previous.startsWith("The connection service is unavailable") ||
                previous.startsWith("Authorization returned")
                  ? ""
                  : previous,
              );
          })
          .catch((e) => {
            if (alive) M(connectionMessage(e));
          });
      void update();
      return () => {
        alive = false;
      };
    }, []),
  );
  useEffect(() => {
    if (!dexcom) return;
    if (dexcom === "connected") sessionEvent("check");
    M(
      dexcom === "denied"
        ? "Dexcom authorization was declined."
        : dexcom === "connected"
          ? "Authorization returned. Checking the saved connection…"
          : "Authorization could not be completed. Start again in this browser.",
    );
    router.setParams({ dexcom: undefined });
  }, [dexcom]);
  async function run(fn: () => Promise<unknown>) {
    B(true);
    M("");
    try {
      await fn();
    } catch (e) {
      M(connectionMessage(e));
    } finally {
      P("");
      B(false);
    }
  }
  if (Platform.OS !== "web")
    return (
      <Section title="Dexcom sandbox">
        <Notice title="Open the web version">
          OAuth connection testing is available in your browser. Native browser
          handoff is not enabled yet. Demo and CSV still work here.
        </Notice>
      </Section>
    );
  return (
    <Section title="Dexcom sandbox">
      <Card>
        <T bold>{connectionLabel(status)}</T>
        <T small muted>
          Authorize a simulated Dexcom account. This sandbox connection is
          separate from the device selected in your profile. Demo and CSV data
          remain available.
        </T>
        {!signedIn ? (
          <>
            <T small>
              Sign in or create a Gluca sandbox account. Use a separate Gluca
              passphrase, never your Dexcom password. These test accounts have
              no password recovery.
            </T>
            <Input
              label="Gluca sandbox username"
              value={username}
              onChange={U}
              maxLength={40}
            />
            <Input
              label="Gluca sandbox passphrase"
              value={password}
              onChange={P}
              secureTextEntry
              maxLength={128}
            />
            <View style={row}>
              <Button
                label="Sign in to Gluca"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await client.signIn(username, password);
                    await reload();
                  })
                }
              />
              <Button
                label="Create Gluca sandbox account"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await client.register(username, password);
                    await reload();
                  })
                }
              />
            </View>
          </>
        ) : (
          <>
            <T small>Signed in to Gluca's sandbox connection service.</T>
            <View style={row}>
              <Button
                label={
                  status?.needsReconnect ? "Reconnect Dexcom" : "Connect Dexcom"
                }
                kind="primary"
                disabled={busy || status?.connected || status?.mode === "mock"}
                onPress={() =>
                  void run(async () => {
                    const url = await client.connect();
                    globalThis.location.assign(url);
                  })
                }
              />
              <Button
                label="Check connection"
                disabled={busy}
                onPress={() => void run(reload)}
              />
              {status?.connected || status?.needsReconnect ? (
                <Button
                  label="Disconnect Dexcom"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await client.disconnect();
                      await reload();
                      M(
                        "Stored Dexcom credentials were removed. Revoke authorization separately in Dexcom Permissions if desired.",
                      );
                    })
                  }
                />
              ) : null}
              <Button
                label="Sign out of Gluca"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await client.logout();
                    S(false);
                    Status(null);
                  })
                }
              />
            </View>
            {status?.mode === "mock" ? (
              <T small>
                Configure backend sandbox credentials and the registered
                callback before connecting.
              </T>
            ) : null}
            {status?.temporaryError ? (
              <T small>
                Connection check is temporarily unavailable. Try again later.
              </T>
            ) : null}
          </>
        )}
        {message ? <Notice title="Connection update">{message}</Notice> : null}
      </Card>
    </Section>
  );
}
