import { createOAuthClient, ConnectionError } from "./dexcom-oauth";
import { DexcomGlucoseProvider, GlucoseDataError } from "./dexcom-data";
import type { SyncTransport } from "../glucose-sync";
export function createSyncTransport(
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): SyncTransport {
  const oauth = createOAuthClient("", fetcher),
    provider = new DexcomGlucoseProvider(fetcher);
  return {
    authorization: async () => {
      try {
        return await oauth.status();
      } catch (e) {
        throw new GlucoseDataError(
          e instanceof ConnectionError ? e.code : "unavailable",
        );
      }
    },
    range: () => provider.getAvailableRange(),
    readings: (start, end) => provider.getReadings(start, end),
    cancel: () => provider.clear(),
  };
}
