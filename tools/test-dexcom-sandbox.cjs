// Trusted backend-side live command. Secrets remain in this process; output is an allowlisted summary only.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const root = path.resolve(__dirname, "..");
const calls = [];
function blocked(reason) {
  console.log(JSON.stringify({ result: "BLOCKED", reason }));
  process.exitCode = 2;
}
async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const {
    readConfig,
    loadEnv,
    validateConfig,
  } = require("../server/config.ts");
  const config = readConfig(loadEnv(root));
  if (
    validateConfig(config).mode !== "dexcom" ||
    !config.diagnosticsEnabled ||
    config.nodeEnvironment === "production"
  )
    return blocked(
      "Configure sandbox credentials, keys and development diagnostics locally.",
    );
  const file = path.resolve(root, config.databasePath);
  if (!fs.existsSync(file))
    return blocked(
      "Create/sign in to a Gluca sandbox account and authorize Sandbox User - G7 in /settings.",
    );
  // Existing private token vault only. No migrations or raw-history tables are written by this command.
  const db = new (require("node:sqlite").DatabaseSync)(file);
  try {
    const accounts = db
      .prepare(
        "SELECT d.user_id FROM dexcom_connections d JOIN account_credentials a ON a.user_id=d.user_id WHERE d.status='connected' AND d.environment='sandbox' AND (? IS NULL OR a.username=?)",
      )
      .all(
        option("--username")?.toLowerCase() ?? null,
        option("--username")?.toLowerCase() ?? null,
      );
    if (accounts.length !== 1)
      return blocked(
        "Exactly one matching authorized account is required. Use --username with your local Gluca username if necessary.",
      );
    const { createApp } = require("../server/app.ts"),
      { verifySandbox } = require("../server/dexcom/sandbox-verification.ts");
    const nativeFetch = globalThis.fetch;
    const app = createApp({
      config,
      db,
      log: () => {},
      fetch: async (input, init) => {
        const url = new URL(String(input));
        if (url.origin !== "https://sandbox-api.dexcom.com")
          throw Error("host");
        const reply = await nativeFetch(input, init);
        calls.push({ endpoint: url.pathname, status: reply.status });
        return reply;
      },
    });
    const verified = await verifySandbox(
      app.deps,
      accounts[0].user_id,
      option("--day"),
    );
    const synchronization=process.argv.includes('--sync')?await require('../server/dexcom/sync-verification.ts').verifySynchronization(app.deps,accounts[0].user_id):undefined;
    const stateEvidence = !!db
      .prepare(
        "SELECT 1 FROM oauth_states o JOIN sessions s ON s.id_hash=o.session_id_hash WHERE s.user_id=? AND o.used_at IS NOT NULL LIMIT 1",
      )
      .get(accounts[0].user_id);
    const out = path.join(root, ".dexcom-verification");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "sandbox-story.svg"), verified.svg);
    console.log(
      JSON.stringify(
        {
          ...verified.summary,
          synchronization,
          oauth: {
            existingAuthorizationReused: true,
            authenticatedOwner: true,
            consumedStateEvidence: stateEvidence,
            usableEncryptedConnection: true,
          },
          http: calls,
          svgArtifact: ".dexcom-verification/sandbox-story.svg",
        },
        null,
        2,
      ),
    );
  } finally {
    db.close();
  }
}
main().catch((e) => {
  if (e?.message === "BLOCKED_G7")
    return blocked(
      "Connected account does not show Sandbox User - G7 device metadata. Reauthorize G7 in /settings.",
    );
  if (e?.message === "BLOCKED" || e?.code === "needs_reconnect")
    return blocked("Authorize Sandbox User - G7 again in /settings.");
  console.log(
    JSON.stringify({
      result: "FAIL",
      http: calls,
      reason:
        "Live sandbox verification failed. No fallback data was used; details intentionally exclude upstream bodies and secrets.",
      errorCode:
        typeof e?.code === "string" &&
        [
          "bad_range",
          "rate_limited",
          "unavailable",
          "unexpected_schema",
          "upstream_rejected",
          "forbidden",
        ].includes(e.code)
          ? e.code
          : "verification_failed",
    }),
  );
  process.exitCode = 1;
});
