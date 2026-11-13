// Baseline screenshot script for the Gluca Expo web app.
// Usage: node tools/screenshots.mjs [outDir]   (default docs/screenshots/baseline)
// Requires the web dev server already running at BASE_URL (default http://localhost:8081).
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
const STORAGE_KEY = 'gluca-demo-v1';
const SEED_POST_ID = 'seed-0';
const HEIGHT = 2400;
const THEMES = ['dark', 'light'];
const WIDTHS = [375, 430, 1280];
const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'glucose', path: '/glucose' },
  { name: 'create', path: '/create' },
  { name: 'explore', path: '/explore' },
  { name: 'profile', path: '/profile' },
  { name: 'settings', path: '/settings' },
  { name: 'import', path: '/import' },
  { name: 'post', path: `/post/${SEED_POST_ID}` },
  { name: 'welcome', path: '/welcome' },
];

const outDir = path.resolve(process.argv[2] ?? 'docs/screenshots/baseline');

async function readDark(page) {
  return page.evaluate((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw).dark : undefined;
    } catch {
      return undefined;
    }
  }, STORAGE_KEY);
}

// A fresh context is redirected to /welcome. Complete it through the real UI once, then confirm it was saved.
async function completeWelcome(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Try demo data', exact: true }).click();
  await page.getByRole('button', { name: 'Export PNG / Share', exact: true }).waitFor();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const seen = await page.evaluate((key) => {
      try {
        return JSON.parse(window.localStorage.getItem(key) ?? '{}').seenWelcome;
      } catch {
        return undefined;
      }
    }, STORAGE_KEY);
    if (seen === true) return;
    await page.waitForTimeout(100);
  }
  throw new Error('welcome completion was not saved');
}

// Sets the theme through the real Settings UI, then confirms the saved state.
async function setThemeViaUI(page, theme) {
  const wantDark = theme === 'dark';
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Default seed is dark; only click if the saved state differs.
  let dark = await readDark(page);
  if (dark === undefined) dark = true;
  if (dark !== wantDark) {
    const label = dark ? 'Use light theme' : 'Use dark theme';
    await page.getByText(label, { exact: true }).first().click();
    // Wait for the save effect to write the new state to localStorage.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if ((await readDark(page)) === wantDark) break;
      await page.waitForTimeout(100);
    }
  }
  const finalDark = await readDark(page);
  if (finalDark !== wantDark) {
    throw new Error(`theme switch failed: wanted dark=${wantDark}, saved dark=${finalDark}`);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const results = [];

  try {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: HEIGHT } });
        try {
          // One setup page per context: switch theme through the UI and confirm it persisted.
          const setupPage = await context.newPage();
          let setupError = null;
          try {
            await completeWelcome(setupPage);
            await setThemeViaUI(setupPage, theme);
          } catch (err) {
            setupError = String(err.message ?? err);
          }
          await setupPage.close();

          for (const route of ROUTES) {
            const name = `${route.name}-${width}-${theme}`;
            const errors = [];
            const page = await context.newPage();
            page.on('console', (msg) => {
              if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
            });
            page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
            if (setupError) errors.push(`theme setup: ${setupError}`);
            try {
              await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' });
              await page.waitForTimeout(800);
              await page.screenshot({ path: path.join(outDir, `${name}.png`) });
            } catch (err) {
              errors.push(`navigation/screenshot: ${String(err.message ?? err).split('\n')[0]}`);
            }
            await page.close();
            results.push({ name, route: route.name, width, theme, errors });
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  // Summary table.
  const failed = results.filter((r) => r.errors.length > 0);
  console.log('');
  console.log('name'.padEnd(26) + 'width'.padEnd(7) + 'theme'.padEnd(8) + 'status'.padEnd(8) + 'errors');
  console.log('-'.repeat(90));
  for (const r of results) {
    const status = r.errors.length === 0 ? 'ok' : 'ERROR';
    const first = r.errors[0] ? r.errors[0].slice(0, 120) : '';
    const more = r.errors.length > 1 ? ` (+${r.errors.length - 1} more)` : '';
    console.log(
      r.name.padEnd(26) + String(r.width).padEnd(7) + r.theme.padEnd(8) + status.padEnd(8) + first + more,
    );
  }
  console.log('-'.repeat(90));
  console.log(`shots: ${results.length}, ok: ${results.length - failed.length}, with errors: ${failed.length}`);
  console.log(`output: ${outDir}`);

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
