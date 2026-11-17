// SQLCipher adapter core. Factory must supply an already keyed, cipher-verified, private connection.
import type { SQLiteDatabase } from "expo-sqlite";
import type {
  GlucoseCache,
  CacheEntry,
  GlucoseSnapshot,
} from "./glucose-cache";
import { copySnapshot } from "./glucose-cache";
type Database = Pick<
  SQLiteDatabase,
  "execAsync" | "runAsync" | "getFirstAsync"
>;
export class EncryptedGlucoseCache implements GlucoseCache {
  readonly protection = "encrypted-native" as const;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private db: Database) {}
  private queue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.catch(() => {}).then(fn);
    this.tail = result.catch(() => {});
    return result;
  }
  async initialize() {
    const cipher = await this.db.getFirstAsync<Record<string, unknown>>(
      "PRAGMA cipher_version",
    );
    if (
      !cipher ||
      !Object.values(cipher).some((v) => typeof v === "string" && v.length > 0)
    )
      throw new Error("SQLCipher is required. Plaintext cache is disabled.");
    await this.db.execAsync(
      "PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS private_glucose_cache(scope TEXT PRIMARY KEY, version INTEGER NOT NULL, snapshot TEXT);",
    );
  }
  read(scope: string) {
    return this.queue(async () => {
      const r = await this.db.getFirstAsync<{
        version: number;
        snapshot: string | null;
      }>(
        "SELECT version,snapshot FROM private_glucose_cache WHERE scope=?",
        scope,
      );
      if (!r) return { version: 0, snapshot: null };
      if (!r.snapshot) return { version: r.version, snapshot: null };
      const s = JSON.parse(r.snapshot) as GlucoseSnapshot;
      if (
        !s ||
        !Array.isArray(s.rows) ||
        s.rows.length > 20000 ||
        !s.rows.every(
          (r) =>
            Number.isSafeInteger(r.timestamp) &&
            Number.isFinite(r.mgdl) &&
            r.mgdl >= 20 &&
            r.mgdl <= 600,
        ) ||
        !Array.isArray(s.intervals) ||
        !Number.isFinite(s.checkpoint) ||
        !Number.isFinite(s.lastSuccess)
      )
        throw new Error("Private glucose cache is unreadable.");
      return {
        version: r.version,
        snapshot: copySnapshot(s),
      } satisfies CacheEntry;
    });
  }
  write(scope: string, version: number, snapshot: GlucoseSnapshot) {
    return this.queue(async () => {
      await this.db.execAsync("BEGIN IMMEDIATE");
      try {
        const current = await this.db.getFirstAsync<{ version: number }>(
          "SELECT version FROM private_glucose_cache WHERE scope=?",
          scope,
        );
        if ((current?.version ?? 0) !== version) {
          await this.db.execAsync("ROLLBACK");
          return false;
        }
        await this.db.runAsync(
          "INSERT INTO private_glucose_cache(scope,version,snapshot) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET version=excluded.version,snapshot=excluded.snapshot",
          scope,
          version + 1,
          JSON.stringify(snapshot),
        );
        await this.db.execAsync("COMMIT");
        return true;
      } catch (e) {
        await this.db.execAsync("ROLLBACK");
        throw e;
      }
    });
  }
  clear(scope: string) {
    return this.queue(async () => {
      await this.db.runAsync(
        "INSERT INTO private_glucose_cache(scope,version,snapshot) VALUES(?,1,NULL) ON CONFLICT(scope) DO UPDATE SET version=version+1,snapshot=NULL",
        scope,
      );
    });
  }
}
