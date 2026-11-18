// One-origin OAuth testing: serve only the exported dist bundle, never the project root.
import path from "node:path";
import { readFile, realpath } from "node:fs/promises";
import type { ServerResponse } from "node:http";
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const ROUTES = new Set([
  "/",
  "/welcome",
  "/account",
  "/settings",
  "/dexcom-data",
  "/create",
  "/glucose",
  "/explore",
  "/profile",
  "/import",
  "/log",
  "/onboarding",
  "/profile-edit",
  "/identity-preview",
  "/trophies",
  "/challenges",
]);
export async function serveWeb(
  rawPath: string,
  res: ServerResponse,
  root = path.resolve(__dirname, "../dist"),
): Promise<boolean> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    return false;
  }
  if (
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.split("/").some((p) => p.startsWith("."))
  )
    return false;
  const spa = ROUTES.has(pathname) || /^\/post\/[a-zA-Z0-9_-]+$/.test(pathname);
  if (
    !spa &&
    !pathname.startsWith("/assets/") &&
    !pathname.startsWith("/_expo/") &&
    pathname !== "/favicon.ico"
  )
    return false;
  const name = spa ? "index.html" : pathname.slice(1);
  const type = MIME[path.extname(name)];
  if (!type) return false;
  try {
    const base = await realpath(root);
    const resolved = await realpath(path.join(base, name));
    if (!resolved.startsWith(base + path.sep)) return false;
    const bytes = await readFile(resolved);
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    res.end(bytes);
    return true;
  } catch {
    return false;
  }
}
