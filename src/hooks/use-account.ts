import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConnectionError, createOAuthClient } from "../services/dexcom-oauth";
import { isEnabled } from "../flags";

export type AccountStatus =
  "off" | "checking" | "signedOut" | "signedIn" | "unavailable";

// The key holds no credentials, and the username is never kept on the device.
const KEY = ["account-session"] as const;
type Session = { session: boolean };

/** Whether this device has an account session. Does nothing at all while the `accounts` flag is off. */
export function useAccount() {
  const on = isEnabled("accounts");
  const client = useMemo(() => createOAuthClient(), []);
  const qc = useQueryClient();
  const q = useQuery<Session>({
    queryKey: KEY,
    enabled: on,
    retry: false,
    staleTime: 30000,
    queryFn: async () => {
      try {
        return await client.session();
      } catch (e) {
        if (e instanceof ConnectionError && e.code === "no_session")
          return { session: false };
        throw e;
      }
    },
  });
  const refresh = useCallback(() => {
    if (on) void qc.invalidateQueries({ queryKey: KEY });
  }, [on, qc]);
  // Throws ConnectionError so the form can show messageFor(code). Passwords only travel in the request body.
  const signIn = useCallback(
    async (u: string, p: string) => {
      await client.signIn(u, p);
      qc.setQueryData<Session>(KEY, { session: true });
    },
    [client, qc],
  );
  const register = useCallback(
    async (u: string, p: string) => {
      await client.register(u, p);
      qc.setQueryData<Session>(KEY, { session: true });
    },
    [client, qc],
  );
  const signOut = useCallback(async () => {
    try {
      await client.logout();
      qc.setQueryData<Session>(KEY, { session: false });
    } catch (e) {
      // Do not claim the server session ended if it may not have.
      void qc.invalidateQueries({ queryKey: KEY });
      throw e;
    }
  }, [client, qc]);
  const status: AccountStatus = !on
    ? "off"
    : q.isError
      ? "unavailable"
      : q.data
        ? q.data.session
          ? "signedIn"
          : "signedOut"
        : "checking";
  return { status, refresh, signIn, register, signOut };
}
