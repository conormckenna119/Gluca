import { createServer } from "node:http";
import path from "node:path";
import { loadEnv, readConfig } from "./config";
import { createApp } from "./app";

const root = path.resolve(__dirname, "..");
const config = readConfig(loadEnv(root));
if (config.databasePath !== ":memory:" && !path.isAbsolute(config.databasePath))
  config.databasePath = path.join(root, config.databasePath);

try {
  const { handler, validation } = createApp({ config });
  console.log(`Gluca backend mode: ${validation.mode}`);
  if (validation.mode === "mock") {
    console.log(
      "Mock mode: Dexcom routes answer 503 until credentials are configured.",
    );
  }
  for (const p of validation.problems) console.log(`Config problem: ${p}`);
  createServer(handler).listen(config.port, "127.0.0.1", () => {
    console.log(`Listening on http://127.0.0.1:${config.port}`);
  });
} catch (e) {
  console.error(e instanceof Error ? e.message : "Failed to start.");
  process.exit(1);
}
