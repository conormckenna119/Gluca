import type { AppDeps } from "../http";
import { connectionStatus } from "./status";
import { getAvailableRange, retrieveReadings } from "./relay";
import { loadConnection } from "./client";
import {
  GlucoseSync,
  preferredStoryDay,
  type SyncTransport,
} from "../../src/glucose-sync";
import { MemoryGlucoseCache } from "../../src/glucose-cache";
import { sandboxStory } from "../../src/create-source";
export async function verifySynchronization(deps: AppDeps, userId: string) {
  const session = deps.db
    .prepare(
      "SELECT id_hash FROM sessions WHERE user_id=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1",
    )
    .get(userId, deps.now()) as { id_hash: string } | undefined;
  if (!session) throw new Error("BLOCKED");
  let revision = "";
  let reads = 0;
  const windows: { start: string; end: string }[] = [];
  const transport: SyncTransport = {
    authorization: () =>
      connectionStatus(deps, { userId, idHash: session.id_hash }),
    range: async () => {
      const r = await getAvailableRange(deps, userId);
      revision = loadConnection(deps, userId)!.generation;
      return {
        source: "dexcom",
        environment: "sandbox",
        range: r.range,
        connectionRevision: revision,
      };
    },
    readings: async (start, end) => {
      reads++;
      windows.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
      return (await retrieveReadings(deps, userId, { start, end }, revision))
        .readings;
    },
    cancel: () => {},
  };
  const engine = new GlucoseSync(transport, new MemoryGlucoseCache(), deps.now);
  await engine.activate();
  if (!engine.snapshot().data?.rows.length)
    throw new Error("Synchronization failed.");
  const initialCount = engine.snapshot().data!.rows.length;
  const before = reads;
  await engine.sync();
  const avoided = reads === before;
  if (!avoided) throw new Error("Fresh cache redownloaded.");
  await engine.sync(true);
  if (engine.snapshot().error) throw new Error("Incremental refresh failed.");
  const data = engine.snapshot().data!,
    day = preferredStoryDay(data.rows, deps.now());
  sandboxStory(data.rows, day);
  const summary = {
    initialCount,
    finalCount: data.rows.length,
    initialAndOverlapWindows: windows,
    freshCheckAvoidedEgvRequest: avoided,
    duplicates:
      new Set(data.rows.map((r) => r.timestamp)).size !== data.rows.length,
    createDay: day,
    createSharedDataset: true,
    cacheProtection: engine.cache.protection,
    persistedRawHistory: false,
  };
  await engine.clearLocal();
  if (engine.snapshot().data !== null) throw new Error("Deletion failed.");
  return { ...summary, cacheDeletionVerified: true };
}
