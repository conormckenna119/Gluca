import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { EncryptedGlucoseCache } from "./encrypted-glucose-cache";
/** Requires a custom SQLCipher build. SecureStore holds only 32 bytes of key material, never glucose history. */
export async function createPrivateGlucoseCache() {
  if (!(await SecureStore.isAvailableAsync()))
    throw new Error("Encrypted native cache is unavailable.");
  const keyName = "gluca-private-glucose-key-v1";
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync(keyName, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(key))
    throw new Error("Encrypted native cache key is invalid.");
  const db = await SQLite.openDatabaseAsync("private-glucose-v1.db");
  try {
    const cipher = await db.getFirstAsync<Record<string, unknown>>(
      "PRAGMA cipher_version",
    );
    if (
      !cipher ||
      !Object.values(cipher).some((v) => typeof v === "string" && v.length > 0)
    )
      throw new Error("SQLCipher is required.");
    // Only locally generated/validated hex is interpolated; scope and payload SQL always use parameters.
    await db.execAsync(`PRAGMA key="x'${key}'";`);
    const cache = new EncryptedGlucoseCache(db);
    await cache.initialize();
    return cache;
  } catch {
    await db.closeAsync();
    throw new Error(
      "Encrypted native cache could not be opened. Plaintext fallback is disabled.",
    );
  }
}
