// Minimal device evidence for explicit development verification. No identifiers, alerts or settings retained.
import type { AppDeps } from "../http";
import { dexcomFetch } from "./client";
import { envelope } from "./relay";
import { UnexpectedSchema } from "./errors";
import { parseSystemTime } from "./normalize";
export function validateDevices(body: unknown, subject: string) {
  const b = envelope(body, "device");
  if (
    b.userId !== subject ||
    !Array.isArray(b.records) ||
    b.records.length > 10000
  )
    throw new UnexpectedSchema();
  const generations = new Set<string>(),
    apps = new Set<string>(),
    platforms = new Set<string>();
  for (const r of b.records) {
    if (
      !r ||
      typeof r !== "object" ||
      parseSystemTime(r.lastUploadDate) === null ||
      !["unknown", "g6", "g6+", "g6Pro", "g7"].includes(
        r.transmitterGeneration,
      ) ||
      !["unknown", "receiver", "iOS", "android"].includes(r.displayDevice) ||
      !Array.isArray(r.alertSchedules) ||
      (r.displayApp !== null &&
        (typeof r.displayApp !== "string" || r.displayApp.length > 80))
    )
      throw new UnexpectedSchema();
    generations.add(r.transmitterGeneration);
    platforms.add(r.displayDevice);
    if (["G6", "G7", "DexcomOne", "D1G7", "G715DAY"].includes(r.displayApp))
      apps.add(r.displayApp);
  }
  return {
    count: b.records.length,
    generations: [...generations],
    apps: [...apps],
    platforms: [...platforms],
    g7: b.records.some(
      (r) => r.transmitterGeneration === "g7" && r.displayApp === "G7",
    ),
  };
}
export async function getDeviceMetadata(
  deps: AppDeps,
  userId: string,
  subject: string,
) {
  return validateDevices(
    await dexcomFetch(deps, userId, "/v3/users/self/devices"),
    subject,
  );
}
