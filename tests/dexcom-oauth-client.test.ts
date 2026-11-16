import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createOAuthClient,
  connectionLabel,
  connectionMessage,
  ConnectionError,
} from "../src/services/dexcom-oauth";
test("OAuth client is inert until called, authenticates with cookies, and never sends a provider secret", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ session: true }));
  }) as typeof fetch;
  const client = createOAuthClient("", fetcher);
  assert.equal(calls.length, 0);
  await client.signIn("synthetic-user", "synthetic-passphrase");
  assert.equal(calls[0].url, "/api/session");
  assert.equal(calls[0].init?.credentials, "include");
  assert.ok(!JSON.stringify(calls).includes("client_secret"));
});
test("connection launch rejects attacker or production authorization URL", async () => {
  for (const authorizationUrl of [
    "https://evil.test/steal",
    "https://api.dexcom.com/v3/oauth2/login",
    "https://sandbox-api.dexcom.com/wrong",
  ]) {
    const client = createOAuthClient(
      "",
      (async () =>
        new Response(JSON.stringify({ authorizationUrl }))) as typeof fetch,
    );
    await assert.rejects(client.connect());
  }
});
test("status labels and errors are bounded fixed copy, not server error text", () => {
  assert.equal(connectionLabel(null), "Disconnected");
  assert.equal(
    connectionLabel({
      mode: "dexcom",
      environment: "sandbox",
      connected: true,
      needsReconnect: false,
      temporaryError: false,
    }),
    "Connected",
  );
  assert.equal(
    connectionLabel({
      mode: "dexcom",
      environment: "sandbox",
      connected: false,
      needsReconnect: true,
      temporaryError: false,
    }),
    "Reconnect",
  );
  assert.ok(
    !connectionMessage(new Error("secret-response-body")).includes(
      "secret-response-body",
    ),
  );
  assert.match(connectionMessage(new ConnectionError("no_session")), /Sign in/);
});
