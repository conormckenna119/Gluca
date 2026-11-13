// Builds the static site into dist/. No network access, no runtime dependencies.
// Run: node scripts/build.mjs   (esbuild is resolved from node_modules or from ESBUILD_PATH)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD_PATH ?? 'esbuild');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'src/app.ts')],
  bundle: true, format: 'iife', target: ['es2020', 'safari15'], minify: true,
  outfile: path.join(dist, 'app.js'), legalComments: 'none', logLevel: 'info',
});
fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
fs.copyFileSync(path.join(root, 'app.css'), path.join(dist, 'app.css'));
if (fs.existsSync(path.join(root, 'samples'))) fs.cpSync(path.join(root, 'samples'), path.join(dist, 'samples'), { recursive: true });
console.log('built', dist);
