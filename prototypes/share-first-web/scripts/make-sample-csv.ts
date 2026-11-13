// Writes a synthetic, Clarity-shaped CSV (fictional patient info, extra non-glucose rows) for testing the importer.
// Run: npx tsx scripts/make-sample-csv.ts samples/clarity-sample.csv
import fs from 'node:fs';
import { generateDemo } from '../src/demo';

const out = process.argv[2] ?? 'samples/clarity-sample.csv';
const rs = generateDemo('2026-11-12', 14, 15.5);
const iso = (t: number) => new Date(t).toISOString().slice(0, 19);
const lines = [
  'Index,Timestamp (YYYY-MM-DDThh:mm:ss),Event Type,Event Subtype,Patient Info,Device Info,Source Device ID,Glucose Value (mg/dL),Insulin Value (u),Carb Value (grams),Duration (hh:mm:ss),Glucose Rate of Change (mg/dL/min),Transmitter Time (Long Integer),Transmitter ID',
  ',,FirstName,Sample,,,,,,,,,,',
  ',,LastName,Person,,,,,,,,,,',
  ',,Device,Dexcom G7 (synthetic),,,,,,,,,,',
];
// Real files put the header after a preamble; mirror that by moving the header below it.
const header = lines.shift() as string;
lines.push(header);
let i = 1;
for (const r of rs) {
  lines.push(`${i++},${iso(r.t)},EGV,,,,SYNTH-0001,${r.mgdl},,,,,,`);
  if (i % 97 === 0) lines.push(`${i++},${iso(r.t + 1000)},Insulin,Fast-Acting,,,,,2.0,,,,,`); // non-glucose rows must be ignored
}
fs.mkdirSync('samples', { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log('wrote', out, rs.length, 'EGV rows');
