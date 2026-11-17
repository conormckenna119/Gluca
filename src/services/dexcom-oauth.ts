// Connection management only. No Dexcom bearer token or secret ever enters this client.
import { sessionEvent } from "./session-events";
export type ConnectionStatus = {
  mode: "mock" | "dexcom";
  environment: "sandbox";
  connected: boolean;
  needsReconnect: boolean;
  temporaryError: boolean;
  cacheScope?: string | null;
  cacheValidUntil?: number | null;
  retryAfterSeconds?: number;
  connectionRevision?: string | null;
};
export class ConnectionError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function createOAuthClient(base = "", fetcher: typeof fetch = fetch) {
  async function request<T>(
    route: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const mutation =
      method === "POST" &&
      [
        "/api/session",
        "/api/accounts",
        "/api/session/logout",
        "/api/dexcom/disconnect",
      ].includes(route);
    if (mutation) sessionEvent("lock");
    const res = await fetcher(`${base}${route}`, {
      method,
      credentials: "include",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      let code = "unavailable";
      try {
        const b = await res.json();
        if (
          [
            "no_session",
            "invalid_login",
            "invalid_credentials",
            "account_unavailable",
            "rate_limited",
            "dexcom_not_configured",
          ].includes(b.error)
        )
          code = b.error;
      } catch {}
      throw new ConnectionError(code);
    }
    const result = (await res.json()) as T;
    if (mutation && ["/api/session", "/api/accounts"].includes(route))
      sessionEvent("check");
    return result;
  }
  return {
    session: () => request<{ session: boolean }>("/api/session"),
    signIn: (username: string, password: string) =>
      request("/api/session", "POST", { username, password }),
    register: (username: string, password: string) =>
      request("/api/accounts", "POST", { username, password }),
    logout: () => request("/api/session/logout", "POST"),
    status: () => request<ConnectionStatus>("/api/dexcom/status"),
    disconnect: () => request("/api/dexcom/disconnect", "POST"),
    connect: async () => {
      const b = await request<{ authorizationUrl: string }>(
        "/api/dexcom/connect",
        "POST",
      );
      const u = new URL(b.authorizationUrl);
      if (
        u.origin !== "https://sandbox-api.dexcom.com" ||
        u.pathname !== "/v3/oauth2/login" ||
        u.username ||
        u.password
      )
        throw new ConnectionError("unavailable");
      return u.href;
    },
  };
}
export const connectionLabel = (s: ConnectionStatus | null) =>
  s?.needsReconnect ? "Reconnect" : s?.connected ? "Connected" : "Disconnected";
export function connectionMessage(error: unknown) {
  const code = error instanceof ConnectionError ? error.code : "unavailable";
  return (
    (
      {
        no_session: "Sign in to your Gluca sandbox account.",
        invalid_login: "The username or Gluca passphrase is incorrect.",
        invalid_credentials:
          "Use a 3–40 character username and a 12–128 character Gluca passphrase.",
        account_unavailable: "That username is unavailable.",
        rate_limited: "Too many attempts. Try again later.",
        dexcom_not_configured:
          "The backend needs its sandbox OAuth configuration before you can connect.",
      } as Record<string, string>
    )[code] ??
    "The connection service is unavailable. Check the backend and try again."
  );
}
