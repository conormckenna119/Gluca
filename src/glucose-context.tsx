import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, Platform } from "react-native";
import { GlucoseSync, type SyncState } from "./glucose-sync";
import { createPrivateGlucoseCache } from "./private-glucose-cache";
import { createSyncTransport } from "./services/glucose-sync-transport";
import { onSessionEvent, sessionEvent } from "./services/session-events";
import { getFlags } from "./flags";
import { useDemo } from "./store";
import { MockGlucoseProvider } from "./providers";
import type { Reading } from "./types";
const EMPTY: Reading[] = [];
type Choice = "auto" | "demo" | "csv" | "dexcom";
interface Context {
  enabled: boolean;
  engine: GlucoseSync | null;
  state: SyncState;
  choice: Choice;
  select: (s: Choice) => void;
  mock: Reading[];
}
const INITIAL: SyncState = {
  identityVersion: 0,
  connection: "checking",
  busy: false,
  error: null,
  retryAt: 0,
  leaseUntil: 0,
  data: null,
  cacheProtection: "ephemeral",
};
const GlucoseContext = createContext<Context>({
  enabled: false,
  engine: null,
  state: INITIAL,
  choice: "auto",
  select: () => {},
  mock: EMPTY,
});
const locked = () => {
  try {
    return (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem("gluca-private-locked") === "1"
    );
  } catch {
    return false;
  }
};
const lockMarker = (value: boolean) => {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem("gluca-private-locked", value ? "1" : "0");
  } catch {
    /* no persistent health data is involved */
  }
};
/** One lifecycle and one private cache for every screen. No background polling. */
export function GlucoseDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const f = getFlags();
  const available = __DEV__ && Platform.OS === "web" && f.dexcomApi;
  const enabled = available && f.dexcomDiagnostics && f.dexcomSync;
  const mock = useMemo(
    () => (enabled ? new MockGlucoseProvider().readings : EMPTY),
    [enabled],
  );
  const [engine, setEngine] = useState<GlucoseSync | null>(null),
    [choice, select] = useState<Choice>("auto");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void createPrivateGlucoseCache().then((cache) => {
      if (alive) setEngine(new GlucoseSync(createSyncTransport(), cache));
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  const state = useSyncExternalStore(
    engine?.subscribe ?? (() => () => {}),
    engine?.snapshot ?? (() => INITIAL),
    () => INITIAL,
  );
  useEffect(() => {
    if (!available) return;
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("gluca-private-session-v1")
        : null;
    const off = onSessionEvent((e, remote) => {
      lockMarker(e !== "check");
      if (e === "lock") void engine?.invalidate();
      else if (e === "purge") void engine?.clearLocal();
      else void engine?.activate();
      if (!remote) channel?.postMessage(e);
    });
    if (channel)
      channel.onmessage = (e) => {
        if (e.data === "lock" || e.data === "check" || e.data === "purge")
          sessionEvent(e.data, true);
      };
    return () => {
      off();
      channel?.close();
    };
  }, [available, engine]);
  useEffect(() => {
    if (!engine) return;
    if (!locked()) void engine.activate();
    else void engine.invalidate();
    const resume = async () => {
      await engine.expire();
      if (
        !engine.isPaused() ||
        engine.snapshot().error === "session_verification_required"
      )
        void engine.activate();
    };
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") resume();
    });
    const visible = () => {
      if (!document.hidden) resume();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visible);
      window.addEventListener("focus", resume);
    }
    return () => {
      app.remove();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", visible);
        window.removeEventListener("focus", resume);
      }
      void engine.invalidate();
    };
  }, [engine]);
  useEffect(() => {
    if (!engine || !state.leaseUntil) return;
    const timer = setTimeout(
      () => void engine.expire(),
      Math.max(0, state.leaseUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [engine, state.leaseUntil]);
  return (
    <GlucoseContext.Provider
      value={{ enabled, engine, state, choice, select, mock }}
    >
      {children}
    </GlucoseContext.Provider>
  );
}
export function useSynchronizedGlucose() {
  const context = useContext(GlucoseContext),
    { state: demo } = useDemo();
  const source =
    context.choice === "auto"
      ? context.state.connection === "disconnected"
        ? demo.imported.length
          ? "csv"
          : "demo"
        : "dexcom"
      : context.choice;
  const data =
    source === "dexcom"
      ? (context.state.data?.rows ?? EMPTY)
      : source === "csv"
        ? demo.imported
        : context.mock;
  return {
    ...context,
    source,
    data,
    select: context.select,
    syncNow: () => {
      lockMarker(false);
      return context.engine?.activate(true);
    },
  };
}
