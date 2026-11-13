// End-to-end checks in real Chromium against the built site (dist/).
// Run: npm run build && npm run e2e        (needs playwright and sharp resolvable; see README)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cleanReadings, computeStats, parseYmd } from '../src/analytics';
import { parseGlucoseCsv } from '../src/csv';
import { FORMATS } from '../src/formats';
import { TEMPLATE_ORDER } from '../src/templates';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = require('playwright') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharp = require('sharp') as any;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 5199, BASE = `http://127.0.0.1:${PORT}/`;
const outDir = process.env.E2E_OUT ?? path.join(os.tmpdir(), 'gluca-e2e');
fs.mkdirSync(outDir, { recursive: true });

let passed = 0; const failures: string[] = [];
function check(ok: boolean, name: string, detail = ''): void {
  if (ok) { passed++; } else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log('  FAIL', name, detail); }
}
const section = (s: string) => console.log(`\n# ${s}`);

async function main(): Promise<void> {
  const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    await run(browser);
  } finally { await browser.close(); server.kill(); }
  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length) { console.log(failures.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function newPage(browser: any, opts: Record<string, unknown> = {}, url = BASE) {
  const ctx = await browser.newContext({ acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  const requests: string[] = [];
  page.on('request', (r: { url(): string }) => requests.push(r.url()));
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(e.message));
  page.on('console', (m: { type(): string; text(): string }) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  return { page, ctx, requests, errors };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exportPng(page: any, file: string): Promise<Buffer> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  const p = path.join(outDir, file);
  await dl.saveAs(p);
  return fs.readFileSync(p);
}

// bounding box of clearly visible pixels (alpha > 50%), so soft shadows don't count as content
async function alphaBox(buf: Buffer): Promise<{ top: number; bottom: number; left: number; right: number } | null> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = info.height, bottom = -1, left = info.width, right = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 128) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x; }
  }
  return bottom < 0 ? null : { top, bottom, left, right };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function run(browser: any): Promise<void> {
  // ---------------------------------------------------------------- 1. landing + demo, time to first graphic, no network
  section('landing, demo and time to first graphic');
  {
    const { page, ctx, requests, errors } = await newPage(browser, { viewport: { width: 390, height: 844 } });
    check(await page.locator('h1').innerText() === 'Create your glucose story.', 'landing headline');
    check(await page.locator('#btn-demo').isVisible() && await page.locator('#lbl-import').isVisible() && await page.locator('#btn-milestone').isVisible(), 'three entry points visible');
    check(await page.locator('#debug').isHidden(), 'analytics panel hidden by default');
    const t0 = Date.now();
    await page.click('#btn-demo');
    await page.waitForSelector('#preview svg');
    const ms = Date.now() - t0;
    check(ms < 3000, 'default graphic appears quickly after one tap', `${ms} ms`);
    console.log(`  time from "Try demo data" tap to graphic: ${ms} ms`);
    const text = await page.locator('#preview').innerHTML();
    check(/DEMO DATA/.test(text), 'preview carries the demo-data label');
    const li = await page.locator('#contents li').allInnerTexts();
    check(li.some((x: string) => /demo data/i.test(x)), '"what is on this image" lists the demo label');
    check(requests.every((u: string) => u.startsWith(BASE)), 'no requests leave localhost', requests.filter((u: string) => !u.startsWith(BASE)).join(', '));
    check(errors.length === 0, 'no console errors', errors.join(' | '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- 2. export every template x format, plus transparent + safe areas
  section('exports: dimensions, alpha, blank-ness, safe areas, determinism');
  {
    const { page, ctx } = await newPage(browser, { viewport: { width: 1280, height: 900 } }, `${BASE}?telemetry=local`);
    await page.click('#btn-demo');
    await page.waitForSelector('#preview svg');
    const safe: Record<string, number> = { story: 250, portrait: 110, square: 90 };
    for (const template of TEMPLATE_ORDER) {
      await page.click(`#templates button[data-template="${template}"]`);
      for (const fmt of ['story', 'portrait', 'square'] as const) {
        await page.click(`[data-format="${fmt}"]`);
        const { w, h } = FORMATS[fmt];
        // opaque export
        if (await page.locator('#transparent').isChecked()) await page.click('#transparent'); // uncheck (overlay defaults to transparent)
        let buf = await exportPng(page, `${template}-${fmt}.png`);
        let meta = await sharp(buf).metadata();
        check(meta.width === w && meta.height === h, `${template}/${fmt} opaque is ${w}x${h}`, `${meta.width}x${meta.height}`);
        const st = await sharp(buf).stats();
        check(st.channels.slice(0, 3).some((c: { stdev: number }) => c.stdev > 6), `${template}/${fmt} opaque is not blank`);
        const corner = await sharp(buf).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
        check(corner[3] === 255, `${template}/${fmt} opaque corner is solid`);
        // transparent export
        await page.click('#transparent');
        buf = await exportPng(page, `${template}-${fmt}-transparent.png`);
        meta = await sharp(buf).metadata();
        check(meta.width === w && meta.height === h && meta.hasAlpha === true, `${template}/${fmt} transparent is ${w}x${h} with alpha`);
        const c2 = await sharp(buf).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
        check(c2[3] === 0, `${template}/${fmt} transparent corner has alpha 0`);
        const box = await alphaBox(buf);
        check(!!box, `${template}/${fmt} transparent has visible content`);
        if (box) {
          const m = safe[fmt];
          // the footer mark and every element sit inside the safe margins (the margins are top and bottom only)
          check(box.top >= m - 2 && box.bottom <= h - m + 2, `${template}/${fmt} content stays inside ${m}px safe margins`, `top ${box.top}, bottom ${h - 1 - box.bottom} from edge`);
          check(box.left >= 40 && box.right <= w - 40, `${template}/${fmt} content keeps side margins`, `left ${box.left}, right ${w - 1 - box.right}`);
        }
      }
      // leave transparent unchecked for the next template's first step (clicking a template resets it to its default)
    }
    // determinism: same settings twice give identical pixels (font embedded, no timing dependence)
    await page.click(`#templates button[data-template="daily_recap"]`);
    await page.click('[data-format="story"]');
    if (await page.locator('#transparent').isChecked()) await page.click('#transparent');
    const a = await sharp(await exportPng(page, 'det-a.png')).raw().toBuffer();
    const b = await sharp(await exportPng(page, 'det-b.png')).raw().toBuffer();
    check(a.equals(b), 'two exports of the same settings are pixel-identical');
    // the embedded font is actually in use in the page
    const fontOk = await page.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d')!;
      c.font = '700 100px GlucaInter, serif'; const w1 = c.measureText('Glucose 123').width;
      c.font = '700 100px serif'; const w2 = c.measureText('Glucose 123').width;
      return { loaded: document.fonts.check('700 20px GlucaInter'), differs: Math.abs(w1 - w2) > 1 };
    });
    check(fontOk.loaded && fontOk.differs, 'embedded Inter font is loaded and used');
    // telemetry recorded export events but nothing that could carry a value
    const dbg = await page.locator('#debug-pre').innerText();
    check(/export_succeeded/.test(dbg) && !/\d{2,3} ?mg/i.test(dbg), 'local analytics counted exports and holds no readings');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 3. CSV import: privacy + numbers cross-checked
  section('CSV import');
  {
    const csvPath = path.join(root, 'samples/clarity-sample.csv');
    const text = fs.readFileSync(csvPath, 'utf8');
    const { page, ctx, requests } = await newPage(browser, { viewport: { width: 1280, height: 900 } }, `${BASE}?telemetry=local`);
    await page.setInputFiles('#file', csvPath);
    await page.waitForSelector('#preview svg');
    const body = await page.locator('body').innerText();
    const html = await page.content();
    for (const secret of ['Sample', 'Person', 'SYNTH-0001', 'clarity-sample', 'Dexcom G7 (synthetic)']) {
      check(!body.includes(secret) && !html.includes(secret), `imported identifier "${secret}" is never shown`);
    }
    check(requests.every((u: string) => u.startsWith(BASE)), 'import makes no external request');
    check(!(await page.locator('#preview').innerHTML()).includes('DEMO DATA'), 'imported data is not labelled as demo');
    // numbers on screen match an independent computation from the file
    const parsed = parseGlucoseCsv(text);
    const rs = cleanReadings(parsed.readings).readings;
    const anchor = await page.inputValue('#date');
    const day = parseYmd(anchor) as number;
    const expected = computeStats(rs, day, day + 86_400_000);
    const tir = Math.round((expected.tir as number) * 100);
    await page.click('#custom-d summary');
    await page.check('[data-show="tir"]'); await page.check('[data-show="avg"]'); await page.check('[data-show="readings"]');
    const items = (await page.locator('#contents li').allInnerTexts()).join('\n');
    check(new RegExp(`Time in range: ${tir}%`).test(items), `time in range on screen equals computed ${tir}%`, items);
    check(new RegExp(`Average glucose: ${Math.round(expected.avg as number)} mg/dL`).test(items), 'average on screen equals computed');
    check(new RegExp(`Number of readings: ${expected.readings}\\b`).test(items), `reading count equals computed ${expected.readings}`);
    // peek at telemetry for leaks
    const dbg = await page.locator('#debug-pre').innerText();
    check(/import_succeeded/.test(dbg) && !/Sample|SYNTH|clarity/.test(dbg), 'import analytics contain no filename or identifiers');
    // remove data
    await page.click('#data-d summary');
    await page.click('#btn-remove');
    check(await page.locator('#landing').isVisible() && await page.locator('#studio').isHidden(), 'remove imported data returns to start');
    check((await page.inputValue('#file').catch(() => '')) === '', 'file input is cleared');
    check(!(await page.content()).includes('SYNTH'), 'no trace of the file remains in the page');
    await ctx.close();
  }
  {
    // unit missing from the header: the app must ask, not guess
    const csv = 'Timestamp,Glucose Value\n2026-11-10T00:00:00,5.5\n2026-11-10T00:05:00,5.8\n2026-11-10T00:10:00,6.1\n';
    const { page, ctx } = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await page.setInputFiles('#file', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('#import-unit:not([hidden])');
    check(await page.locator('#studio').isHidden(), 'no graphic until the unit is chosen');
    await page.click('#import-unit [data-unit="mmol"]');
    await page.waitForSelector('#preview svg');
    check(true, 'choosing a unit continues the import');
    // bad file
    await page.click('#reset');
    await page.setInputFiles('#file', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('hello,world\n1,2\n') });
    await page.waitForSelector('#import-status .err');
    check((await page.locator('#import-status').innerText()).length > 10, 'a non-glucose file gets a clear error');
    check(await page.locator('#studio').isHidden(), 'bad file does not open the studio');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 4. share sheet wording + telemetry
  section('share sheet');
  {
    const { page, ctx } = await newPage(browser, { viewport: { width: 390, height: 844 } }, `${BASE}?telemetry=local`);
    await page.addInitScript(() => {
      const nav = navigator as unknown as Record<string, unknown>;
      nav.canShare = () => true;
      nav.share = async () => undefined;
    });
    await page.reload();
    await page.click('#btn-demo'); await page.waitForSelector('#preview svg');
    check(await page.locator('#btn-share').isVisible(), 'share button appears when the browser can share files');
    await page.click('#btn-share');
    await page.waitForFunction(() => /share sheet/i.test(document.getElementById('export-status')?.textContent ?? ''));
    const st = await page.locator('#export-status').innerText();
    check(!/\b(posted to|published|shared to instagram)\b/i.test(st) && /never posts/i.test(st), 'share wording does not claim a post was made', st);
    check(/share_sheet_opened/.test(await page.locator('#debug-pre').innerText()), 'share_sheet_opened recorded (not "shared")');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 5. mobile + desktop layout, light/dark
  section('layout: 375 / 430 / 1280, light + dark');
  for (const [w, h] of [[375, 812], [430, 932], [1280, 900]] as const) {
    for (const scheme of ['dark', 'light'] as const) {
      const { page, ctx } = await newPage(browser, { viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
      const tag = `${w}-${scheme}`;
      await page.screenshot({ path: path.join(outDir, `landing-${tag}.png`), fullPage: true });
      await page.click('#btn-demo'); await page.waitForSelector('#preview svg');
      await page.waitForTimeout(200);
      await page.click('#custom-d summary');
      await page.screenshot({ path: path.join(outDir, `studio-${tag}.png`), fullPage: true });
      const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      check(sw.sw <= sw.iw, `no horizontal scroll at ${tag}`, `${sw.sw} > ${sw.iw}`);
      const small = await page.evaluate(() => {
        const bad: string[] = [];
        const sel = 'button, summary, a, label.check, label.chip, input[type=text], input[type=date], input[type=number], label.btn';
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || el.classList.contains('skip')) continue;
          if (el.closest('[hidden]')) continue;
          if (r.height < 43.5 || (el.tagName === 'BUTTON' && r.width < 43.5)) bad.push(`${el.tagName.toLowerCase()}#${el.id || el.textContent?.trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return bad;
      });
      check(small.length === 0, `touch targets are at least 44px at ${tag}`, small.join('; '));
      const noOverflow = await page.evaluate(() => {
        const svg = document.querySelector('#preview svg') as SVGElement; const r = svg.getBoundingClientRect();
        return r.right <= window.innerWidth + 1 && r.left >= -1;
      });
      check(noOverflow, `preview fits the viewport at ${tag}`);
      await ctx.close();
    }
  }

  // ---------------------------------------------------------------- 6. keyboard: the import control works without a mouse
  section('accessibility basics');
  {
    const { page, ctx } = await newPage(browser, { viewport: { width: 390, height: 844 } });
    const focusable = await page.evaluate(() => Array.from(document.querySelectorAll('#landing button, #landing [role=button]')).every((e) => (e as HTMLElement).tabIndex >= 0));
    check(focusable, 'landing actions are keyboard focusable');
    check((await page.locator('html').getAttribute('lang')) === 'en', 'document language set');
    await page.click('#btn-demo'); await page.waitForSelector('#preview svg');
    check((await page.locator('#preview svg').getAttribute('role')) === 'img' && ((await page.locator('#preview svg').getAttribute('aria-label')) ?? '').length > 20, 'preview has a text alternative describing its contents');
    await ctx.close();
  }
}

void main().catch((e) => { console.error(e); process.exit(1); });
