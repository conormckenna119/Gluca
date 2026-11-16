import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decrypt,
  encrypt,
  randomToken,
  sha256hex,
  signValue,
  verifySigned,
} from "../server/crypto";
import {
  encryptionKeyBytes,
  parseEnvFile,
  readConfig,
  validateConfig,
  PRODUCTION_REFUSAL,
} from "../server/config";
import { buildAuthorizeUrl } from "../server/dexcom/oauth";
import { FAKE, testConfig } from "../server/testkit";

const key = Buffer.alloc(32, 1);

test("encrypt/decrypt round trip with the v1 format", () => {
  const c = encrypt("test-secret-text", key);
  assert.equal(c.split(".").length, 4);
  assert.ok(c.startsWith("v1."));
  assert.equal(decrypt(c, key), "test-secret-text");
});

test("two encryptions of the same text differ", () => {
  assert.notEqual(encrypt("same", key), encrypt("same", key));
});

test("tampering and the wrong key both fail", () => {
  const parts = encrypt("hello", key).split(".");
  const flipped = Buffer.from(parts[3], "base64url");
  flipped[0] ^= 1;
  assert.throws(() =>
    decrypt(
      [parts[0], parts[1], parts[2], flipped.toString("base64url")].join("."),
      key,
    ),
  );
  assert.throws(() => decrypt(parts.join("."), Buffer.alloc(32, 2)));
  assert.throws(() => decrypt("v2.a.b.c", key));
});

test("hash, random token and signing", () => {
  assert.equal(sha256hex("abc").length, 64);
  assert.notEqual(randomToken(), randomToken());
  const s = signValue("value", "secret");
  assert.equal(verifySigned(s, "secret"), "value");
  assert.equal(verifySigned(s, "other"), null);
  assert.equal(verifySigned(s.replace("value", "valuf"), "secret"), null);
  assert.equal(verifySigned("nodot", "secret"), null);
});

test("env file parser", () => {
  assert.deepEqual(parseEnvFile('# c\nA=1\nB="two"\r\n\nC=\n=bad'), {
    A: "1",
    B: "two",
    C: "",
  });
});

test("readConfig defaults", () => {
  const c = readConfig({});
  assert.equal(c.apiBaseUrl, "https://sandbox-api.dexcom.com");
  assert.equal(c.environment, "sandbox");
  assert.equal(c.appBaseUrl, "http://localhost:3000");
  assert.equal(c.port, 3000);
  assert.equal(c.databasePath, "server/data/gluca.sqlite");
});

test("no credentials means mock mode with no problems", () => {
  assert.deepEqual(validateConfig(readConfig({})), {
    mode: "mock",
    problems: [],
  });
});

test("partial credentials report names only, never values", () => {
  const v = validateConfig(readConfig({ DEXCOM_CLIENT_ID: "test-client-id" }));
  assert.equal(v.mode, "mock");
  assert.ok(v.problems.includes("DEXCOM_CLIENT_SECRET is missing"));
  assert.ok(v.problems.includes("DEXCOM_REDIRECT_URI is missing"));
  assert.ok(v.problems.includes("TOKEN_ENCRYPTION_KEY is missing"));
  assert.ok(!v.problems.join(" ").includes("test-client-id"));
});

test("complete config is dexcom mode; bad key and redirect are reported", () => {
  assert.deepEqual(validateConfig(testConfig()), {
    mode: "dexcom",
    problems: [],
  });
  assert.equal(encryptionKeyBytes(testConfig())?.length, 32);
  const bad = validateConfig(
    testConfig({ tokenEncryptionKey: "c2hvcnQ=", redirectUri: "http://x/cb" }),
  );
  assert.equal(bad.mode, "mock");
  assert.ok(
    bad.problems.some((p) => p.startsWith("TOKEN_ENCRYPTION_KEY must")),
  );
  assert.ok(
    bad.problems.some((p) => p.startsWith("DEXCOM_REDIRECT_URI must end")),
  );
});

test("production environment or host is refused", () => {
  assert.throws(
    () => validateConfig(testConfig({ environment: "production" })),
    { message: PRODUCTION_REFUSAL },
  );
  assert.throws(
    () => validateConfig(testConfig({ apiBaseUrl: "https://api.dexcom.com" })),
    /not approved/,
  );
  assert.throws(() =>
    validateConfig(
      testConfig({ apiBaseUrl: "https://sandbox-api.dexcom.com.evil.test" }),
    ),
  );
  assert.throws(() => validateConfig(testConfig({ apiBaseUrl: "not a url" })));
});

test("authorize URL carries only the documented parameters", () => {
  const u = new URL(buildAuthorizeUrl(testConfig(), "state-1"));
  assert.equal(
    u.origin + u.pathname,
    "https://sandbox-api.dexcom.com/v3/oauth2/login",
  );
  assert.deepEqual(Object.fromEntries(u.searchParams), {
    client_id: FAKE.clientId,
    redirect_uri: "http://localhost:3000/api/dexcom/callback",
    response_type: "code",
    scope: "offline_access",
    state: "state-1",
  });
  assert.ok(!u.toString().includes(FAKE.clientSecret));
});
