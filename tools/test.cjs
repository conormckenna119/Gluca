// Compile pure TypeScript tests without a platform-specific transpiler process.
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const build = path.join(root, ".test-build");
// Every plain .ts file under src/, server/ and tests/ (including shared test helpers) is transpiled; only tests/*.test.ts runs.
// New source and test files are picked up without editing this list.
function walk(dir) {
  return fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(`${dir}/${e.name}`)
        : e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")
          ? [`${dir}/${e.name}`]
          : [],
    );
}
const tests = fs
  .readdirSync(path.join(root, "tests"))
  .filter((f) => f.endsWith(".test.ts"))
  .sort()
  .map((f) => `tests/${f}`);
fs.rmSync(build, { recursive: true, force: true });
for (const file of [...walk("src"), ...walk("server"), ...walk("tests")]) {
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
for (const t of tests) require(path.join(build, t.replace(/\.ts$/, ".js")));
