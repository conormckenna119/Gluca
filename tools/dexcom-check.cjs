// Read-only readiness check. Outputs booleans/public callback only, never credentials, sessions or readings.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const root = path.resolve(__dirname, "..");
const { loadEnv, readConfig, validateConfig } = require("../server/config.ts");
const c = readConfig(loadEnv(root));
let mode;
try {
  mode = validateConfig(c).mode;
} catch {
  mode = "invalid_configuration";
}
const summary = {
  mode,
  environment: c.environment,
  clientIdPresent: !!c.clientId,
  clientSecretPresent: !!c.clientSecret,
  encryptionKeyPresent: !!c.tokenEncryptionKey,
  sessionSecretPresent: !!c.sessionSecret,
  callbackToRegister: c.redirectUri || `${c.appBaseUrl}/api/dexcom/callback`,
  diagnosticsEnabled: !!c.diagnosticsEnabled,
  databasePresent: false,
  connectedSandboxAccounts: 0,
};
const file = path.resolve(root, c.databasePath);
summary.databasePresent = fs.existsSync(file);
if (summary.databasePresent) {
  let db;
  try {
    db = new (require("node:sqlite").DatabaseSync)(file, { readOnly: true });
    summary.connectedSandboxAccounts = Number(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM dexcom_connections d JOIN account_credentials a ON a.user_id=d.user_id WHERE d.environment='sandbox' AND d.status='connected'",
        )
        .get().n,
    );
  } catch {
    summary.databaseInspection =
      "Expected authenticated Stage 2 schema unavailable.";
  } finally {
    db?.close();
  }
}
console.log(JSON.stringify(summary, null, 2));
console.log(
  "Readiness only: no OAuth or live Dexcom data request was performed. Use the authenticated development viewer for live verification.",
);
