import { useMemo } from "react";
import { useDemo } from "../store";
import { MockGlucoseProvider, CsvGlucoseProvider } from "../providers";
import { useSynchronizedGlucose } from "../glucose-context";
const mock = new MockGlucoseProvider();
export function useReadings(options: { synchronized?: boolean } = {}) {
  const { state } = useDemo();
  const shared = useSynchronizedGlucose();
  const privateEnabled = !!options.synchronized && shared.enabled;
  const data = useMemo(() => {
    const p = state.imported.length
      ? new CsvGlucoseProvider(state.imported)
      : mock;
    return p.readings.filter(
      (r) => r.timestamp >= 0 && r.timestamp < Date.now() + 86400000,
    );
  }, [state.imported]);
  const local = {
    data,
    isPending: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
  return privateEnabled
    ? {
        ...local,
        data: shared.data,
        isPending:
          shared.source === "dexcom" &&
          shared.state.busy &&
          !shared.data.length,
        error:
          shared.source === "dexcom" &&
          shared.state.error &&
          shared.state.error !== "cache_deleted" &&
          !shared.data.length
            ? new Error("Private glucose data unavailable.")
            : null,
        refetch: shared.syncNow,
        source: shared.source,
        sync: shared,
      }
    : {
        ...local,
        source: state.imported.length ? ("csv" as const) : ("demo" as const),
        sync: null,
      };
}
