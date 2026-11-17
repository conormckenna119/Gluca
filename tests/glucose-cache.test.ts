import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import type { SQLiteDatabase } from "expo-sqlite";
import { EncryptedGlucoseCache } from "../src/encrypted-glucose-cache";
import type { GlucoseSnapshot } from "../src/glucose-cache";
function port(db: DatabaseSync, cipher = false) {
  // Deliberately synthetic cipher evidence: these tests verify adapter semantics, never native encryption.
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...args: (string | number | null)[]) =>
      db.prepare(sql).run(...args),
    getFirstAsync: async (sql: string, ...args: (string | number | null)[]) =>
      sql === "PRAGMA cipher_version"
        ? cipher
          ? { cipher_version: "MOCK" }
          : null
        : (db.prepare(sql).get(...args) ?? null),
  } as unknown as Pick<
    SQLiteDatabase,
    "execAsync" | "runAsync" | "getFirstAsync"
  >;
}
const snapshot: GlucoseSnapshot = {
  rows: [{ timestamp: 1735689600000, mgdl: 100, source: "mock" }],
  checkpoint: 1735689900000,
  lastSuccess: 1735689900000,
  intervals: [{ start: 1735689600000, end: 1735689900000 }],
  available: null,
};
test("encrypted adapter refuses a plaintext SQLite connection before creating any health tables", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const c = new EncryptedGlucoseCache(port(db));
    await assert.rejects(c.initialize(), /SQLCipher/);
    assert.equal(
      (
        db.prepare("SELECT COUNT(*) AS n FROM sqlite_master").get() as {
          n: number;
        }
      ).n,
      0,
    );
  } finally {
    db.close();
  }
});
test("MOCK PASS: native cache persistence/transactions/namespace isolation; not native encryption proof", async () => {
  const dir = mkdtempSync(path.join(__dirname, "cache-"));
  const file = path.join(dir, "synthetic.sqlite");
  let db = new DatabaseSync(file);
  try {
    let cache = new EncryptedGlucoseCache(port(db, true));
    await cache.initialize();
    assert.equal(await cache.write("account-a", 0, snapshot), true);
    assert.equal((await cache.read("account-b")).snapshot, null);
    db.close();
    db = new DatabaseSync(file);
    cache = new EncryptedGlucoseCache(port(db, true));
    await cache.initialize();
    assert.equal((await cache.read("account-a")).snapshot!.rows.length, 1);
    const before = await cache.read("account-a");
    await cache.clear("account-a");
    assert.equal(
      await cache.write("account-a", before.version, snapshot),
      false,
    );
    assert.equal((await cache.read("account-a")).snapshot, null);
    assert.equal((await cache.read("account-a' OR 1=1 --")).snapshot, null);
  } finally {
    db.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(__dirname) + path.sep));
    rmSync(dir, { recursive: true, force: true });
  }
});
test("corrupt private cache fails closed without returning substitute data", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const c = new EncryptedGlucoseCache(port(db, true));
    await c.initialize();
    await c.write("a", 0, snapshot);
    db.prepare("UPDATE private_glucose_cache SET snapshot=? WHERE scope=?").run(
      "{invalid",
      "a",
    );
    await assert.rejects(c.read("a"));
  } finally {
    db.close();
  }
});
