// Compile pure TypeScript tests without a platform-specific transpiler process.
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const build = path.join(root, ".test-build");
for (const file of [
  "src/types.ts",
  "src/analytics.ts",
  "src/csv.ts",
  "src/providers.ts",
  "src/story.ts",
  "src/art/analytics.ts",
  "src/art/brand.ts",
  "src/art/copy.ts",
  "src/art/font-data.ts",
  "src/art/formats.ts",
  "src/art/model.ts",
  "src/art/svg.ts",
  "src/art/templates.ts",
  "src/art/telemetry.ts",
  "tests/core.test.ts",
]) {
  const out = path.join(build, file.replace(/\.ts$/, ".js"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
  );
}
require(path.join(build, "tests/core.test.js"));
