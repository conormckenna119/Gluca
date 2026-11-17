// Explicit live verification only. Not mounted as a public route and never runs in unit CI.
import type { AppDeps } from "../http";
import { getAvailableRange, retrieveReadings } from "./relay";
import { getDeviceMetadata } from "./devices";
import { loadConnection } from "./client";
import {
  latestHistoricalDay,
  providerDay,
  sandboxStory,
} from "../../src/create-source";
import type { GlucoseProvider } from "../../src/providers";
export async function verifySandbox(
  deps: AppDeps,
  userId: string,
  day?: string,
) {
  const connection = loadConnection(deps, userId);
  if (!connection || connection.status !== "connected")
    throw new Error("BLOCKED");
  const available = await getAvailableRange(deps, userId);
  if (!available.range) throw new Error("No sandbox EGV history.");
  const device = await getDeviceMetadata(deps, userId, available.subject);
  if (!device.g7) throw new Error("BLOCKED_G7");
  const selected = day ?? latestHistoricalDay(available.range);
  let result: Awaited<ReturnType<typeof retrieveReadings>> | undefined;
  const provider: GlucoseProvider = {
    id: "dexcom",
    connected: true,
    getReadings: async (start, end) => {
      result = await retrieveReadings(
        deps,
        userId,
        { start, end },
        connection.generation,
      );
      return result.readings;
    },
  };
  const data = await providerDay(provider, selected);
  const story = sandboxStory(data.readings, selected);
  return {
    svg: story.artwork.svg,
    summary: {
      result: "PASS",
      environment: "sandbox",
      apiHostname: "sandbox-api.dexcom.com",
      ownerBound: true,
      g7Confirmed: device.g7,
      devices: device,
      selectedDay: selected,
      selectedPeriod: {
        start: new Date(story.window.start).toISOString(),
        end: new Date(story.window.end).toISOString(),
      },
      availableRange: {
        start: new Date(available.range.start).toISOString(),
        end: new Date(available.range.end).toISOString(),
      },
      receivedCount: result!.receivedCount,
      normalizedCount: data.readings.length,
      rejectedCount: result!.rejectedCount,
      duplicateCount: result!.duplicateCount,
      outsideWindowCount: result!.outsideWindowCount,
      firstTimestamp: new Date(data.readings[0].timestamp).toISOString(),
      lastTimestamp: new Date(data.readings.at(-1)!.timestamp).toISOString(),
      units: [
        ...new Set(
          data.readings.map((r) =>
            "originalUnit" in r ? r.originalUnit : "unknown",
          ),
        ),
      ],
      trendFieldsPresent: data.readings.some(
        (r) => "trend" in r && r.trend !== null,
      ),
      analyticsCompleted: true,
      readingCount: story.stats.count,
      coveragePercent: story.stats.coverage,
      chartSegments: story.paths.length,
      createDataAccepted: true,
      provenance: "Dexcom Sandbox — Simulated",
      csvUsed: false,
      glucaMockUsed: false,
      rawHistoryPersisted: false,
      svgDimensions: {
        width: story.artwork.width,
        height: story.artwork.height,
      },
      svgProduced: true,
      pngExport:
        "Verify separately through the existing Create browser export.",
    },
  };
}
