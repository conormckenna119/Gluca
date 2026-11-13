// Developer script: renders every template with synthetic data to PNGs, using sharp (not a runtime dependency of the app).
// Run: NODE_PATH=<dir with sharp> npx tsx scripts/render-samples.ts <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cleanReadings, parseYmd } from '../src/analytics';
import { generateDemo } from '../src/demo';
import { FORMAT_ORDER } from '../src/formats';
import { defaultSettings, makeArtModel } from '../src/model';
import { buildArtwork, TEMPLATE_ORDER } from '../src/templates';

const sharp = createRequire(import.meta.url)('sharp');
const out = process.argv[2] ?? 'out';
fs.mkdirSync(out, { recursive: true });
const readings = cleanReadings(generateDemo('2026-11-12')).readings;
const only = process.argv[3];

(async () => {
  for (const template of TEMPLATE_ORDER) {
    for (const format of FORMAT_ORDER) {
      if (only && !`${template}-${format}`.includes(only)) continue;
      const s = { ...defaultSettings(template), format };
      // 2026-11-11 is a day with a sensor gap in the demo data; 2026-11-12 is the partial day
      const anchor = parseYmd(process.env.DAY ?? '2026-11-11') as number;
      const art = buildArtwork(makeArtModel(readings, 'demo', anchor, s, { embedFont: false }));
      await sharp(Buffer.from(art.svg)).png().toFile(path.join(out, `${template}-${format}.png`));
    }
  }
  console.log('rendered to', out);
})();
