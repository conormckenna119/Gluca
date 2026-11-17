import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOT_RUNNING,
  canSubmit,
  messageFor,
  normalizeUsername,
  passphraseHint,
  validateConfirm,
  validatePassphrase,
  validateUsername,
} from "../src/account-form";

test("username rules", () => {
  assert.equal(validateUsername("demo.user"), null);
  assert.equal(validateUsername("a_b-3"), null);
  assert.ok(validateUsername(""));
  assert.ok(validateUsername("ab"));
  assert.ok(validateUsername("x".repeat(41)));
  assert.equal(validateUsername("x".repeat(40)), null);
  assert.ok(validateUsername("has space"));
  assert.ok(validateUsername("name@mail.com"));
});

test("normalizeUsername trims and lower-cases", () => {
  assert.equal(normalizeUsername("  Demo.User "), "demo.user");
});

test("passphrase rules: length only, not equal to username", () => {
  assert.ok(validatePassphrase(""));
  assert.ok(validatePassphrase("short"));
  assert.ok(validatePassphrase("12345678901"));
  assert.equal(validatePassphrase("correct horse battery staple"), null);
  assert.equal(validatePassphrase("aaaaaaaaaaaa"), null);
  assert.ok(validatePassphrase("x".repeat(129)));
  assert.equal(validatePassphrase("x".repeat(128)), null);
  assert.ok(validatePassphrase("demo.user.long", "Demo.User.Long"));
});

test("confirm must match", () => {
  assert.ok(validateConfirm("abc", ""));
  assert.ok(validateConfirm("abc", "abd"));
  assert.equal(validateConfirm("abc", "abc"), null);
});

test("passphraseHint counts down then confirms", () => {
  assert.equal(passphraseHint(0), "12 more characters");
  assert.equal(passphraseHint(11), "1 more character");
  assert.equal(passphraseHint(12), "Long enough");
  assert.equal(passphraseHint(40), "Long enough");
});

test("canSubmit", () => {
  const ok = {
    username: "demo.user",
    passphrase: "correct horse battery staple",
    confirm: "correct horse battery staple",
    ageConfirmed: true,
  };
  assert.equal(canSubmit("create", ok), true);
  assert.equal(canSubmit("create", { ...ok, ageConfirmed: false }), false);
  assert.equal(canSubmit("create", { ...ok, confirm: "nope" }), false);
  assert.equal(
    canSubmit("create", { ...ok, passphrase: "short", confirm: "short" }),
    false,
  );
  assert.equal(canSubmit("create", { ...ok, username: "x" }), false);
  assert.equal(
    canSubmit("signIn", { username: "demo.user", passphrase: "x" }),
    true,
  );
  assert.equal(
    canSubmit("signIn", { username: "demo.user", passphrase: "" }),
    false,
  );
  assert.equal(canSubmit("signIn", { username: "", passphrase: "x" }), false);
});

test("messageFor covers every code with a plain sentence", () => {
  const codes = [
    "no_session",
    "invalid_login",
    "invalid_credentials",
    "account_unavailable",
    "rate_limited",
    "dexcom_not_configured",
    "unavailable",
    "something_else",
  ];
  for (const m of ["signIn", "create"] as const)
    for (const c of codes) {
      const s = messageFor(c, m);
      assert.ok(s.endsWith("."), `${c} ${m}`);
    }
  assert.equal(
    messageFor("invalid_login", "signIn"),
    "The username or passphrase is not right.",
  );
  assert.equal(
    messageFor("account_unavailable", "create"),
    "That username is taken. Try another.",
  );
  assert.equal(
    messageFor("rate_limited", "signIn"),
    "Too many tries. Wait a minute and try again.",
  );
  assert.equal(messageFor("unavailable", "signIn"), NOT_RUNNING);
  assert.equal(messageFor("weird", "create"), NOT_RUNNING);
});
