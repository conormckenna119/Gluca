// SQLite via node:sqlite. Idempotent schema with a version number; add new migrations at the end.
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS: string[] = [
  `CREATE TABLE users (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
   CREATE TABLE sessions (
     id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
     created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
   CREATE TABLE oauth_states (
     state_hash TEXT PRIMARY KEY, session_id_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER);
   CREATE TABLE dexcom_connections (
     user_id TEXT PRIMARY KEY REFERENCES users(id),
     environment TEXT NOT NULL, region TEXT,
     access_token_enc TEXT NOT NULL, refresh_token_enc TEXT NOT NULL,
     access_expires_at INTEGER NOT NULL, status TEXT NOT NULL,
     last_sync_at INTEGER, latest_data_at INTEGER,
     created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`,
  // 2: rate-limit backoff and a short error code on the connection.
  `ALTER TABLE dexcom_connections ADD COLUMN backoff_until INTEGER;
   ALTER TABLE dexcom_connections ADD COLUMN backoff_ms INTEGER;
   ALTER TABLE dexcom_connections ADD COLUMN last_error TEXT;`,
  // 3: normalised glucose readings, one row per (user, Dexcom record id).
  `CREATE TABLE egvs (
     user_id TEXT NOT NULL REFERENCES users(id),
     record_id TEXT NOT NULL,
     system_time_ms INTEGER NOT NULL,
     display_time TEXT,
     mgdl INTEGER NOT NULL,
     original_value REAL,
     original_unit TEXT,
     trend TEXT,
     status TEXT,
     device TEXT,
     environment TEXT NOT NULL,
     ingested_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, record_id));
   CREATE INDEX egvs_user_time ON egvs (user_id, system_time_ms);`,
  // 4: authenticated sandbox accounts and connection-scoped OAuth concurrency controls.
  `CREATE TABLE account_credentials (
     user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL, salt TEXT NOT NULL);
   ALTER TABLE users ADD COLUMN oauth_epoch INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE oauth_states ADD COLUMN oauth_epoch INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE dexcom_connections ADD COLUMN generation TEXT NOT NULL DEFAULT '';
   ALTER TABLE dexcom_connections ADD COLUMN refresh_nonce TEXT;
   ALTER TABLE dexcom_connections ADD COLUMN refresh_started INTEGER;`,
  // 5: account-owned, encrypted optional profile. Existing tables and rows are untouched.
  `CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    handle TEXT UNIQUE,
    payload_enc TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL);`,
];

export function migrate(db: DatabaseSync): void {
  const current = (
    db.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

export function openDb(databasePath: string): DatabaseSync {
  if (databasePath !== ":memory:")
    mkdirSync(path.dirname(path.resolve(databasePath)), {
      recursive: true,
      mode: 0o700,
    });
  const db = new DatabaseSync(databasePath);
  // NTFS permissions must also restrict the service account; see docs/OAUTH_SETUP.md.
  if (databasePath !== ":memory:" && process.platform !== "win32")
    chmodSync(databasePath, 0o600);
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}
