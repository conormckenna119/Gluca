import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  MockGlucoseProvider,
  CsvGlucoseProvider,
  DexcomGlucoseProvider,
} from "../providers";
import { glucoseDataMessage } from "../services/dexcom-data";
import {
  latestHistoricalDay,
  providerDay,
  type CreateSource,
} from "../create-source";
import { useDemo } from "../store";
import type { Reading } from "../types";
import type { AvailableGlucoseRange } from "../glucose-window";
/** Create-specific explicit choice. Health rows never enter DemoStore, localStorage, query keys or telemetry. */
export function useCreateReadings() {
  const { state } = useDemo();
  const mock = useMemo(() => new MockGlucoseProvider(), []),
    dexcom = useMemo(() => new DexcomGlucoseProvider(), []);
  const [source, setSource] = useState<CreateSource>(
    state.imported.length ? "csv" : "demo",
  );
  const [data, setData] = useState<Reading[]>([]),
    [range, setRange] = useState<AvailableGlucoseRange | null>(null);
  const [day, setDay] = useState(""),
    [loadedDay, setLoadedDay] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const epoch = useRef(0);
  const active = useRef(source);
  active.current = source;
  const clear = useCallback(() => {
    epoch.current++;
    dexcom.clear();
    setData([]);
    setLoadedDay("");
    setRange(null);
    setBusy(false);
    setError("");
  }, [dexcom]);
  const select = useCallback(
    (s: CreateSource) => {
      if (s === active.current) return;
      clear();
      setDay("");
      setSource(s);
    },
    [clear],
  );
  useEffect(() => {
    if (source === "dexcom") return;
    const generation = ++epoch.current;
    const provider =
      source === "csv" ? new CsvGlucoseProvider(state.imported) : mock;
    void provider.getReadings(0, Date.now() + 86400000).then((rows) => {
      if (generation === epoch.current) setData(rows);
    });
  }, [source, state.imported, mock]);
  const load = useCallback(
    async (requested?: string) => {
      const generation = ++epoch.current;
      dexcom.clear();
      setData([]);
      setLoadedDay("");
      setError("");
      setBusy(true);
      try {
        const result = await dexcom.getAvailableRange();
        if (generation !== epoch.current) return;
        setRange(result.range);
        if (!result.range) {
          setError("This sandbox account has no available EGV history.");
          return;
        }
        const selected = requested ?? latestHistoricalDay(result.range);
        const resultDay = await providerDay(dexcom, selected);
        if (generation !== epoch.current) return;
        setDay(selected);
        setLoadedDay(selected);
        setData(resultDay.readings);
        if (!resultDay.readings.length)
          setError(
            "No Dexcom readings in this UTC day. Choose another historical date.",
          );
      } catch (e) {
        if (generation === epoch.current) {
          dexcom.clear();
          setData([]);
          setRange(null);
          setError(
            e instanceof Error &&
              e.message === "Choose a valid historical UTC date."
              ? e.message
              : glucoseDataMessage(e),
          );
        }
      } finally {
        if (generation === epoch.current) setBusy(false);
      }
    },
    [dexcom],
  );
  // Selection is the explicit user action which retrieves the initial historical day.
  useEffect(() => {
    if (source === "dexcom") void load();
  }, [source, load]);
  useFocusEffect(
    useCallback(
      () => () => {
        if (active.current === "dexcom") clear();
      },
      [clear],
    ),
  );
  useEffect(() => {
    if (source !== "dexcom" || typeof document === "undefined") return;
    const hidden = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [source, clear]);
  return {
    source,
    select,
    data,
    range,
    day,
    loadedDay,
    setDay,
    busy,
    error,
    load,
  };
}
