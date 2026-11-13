# Gluca — share-first MVP

Turn a day of glucose data into a graphic you choose to share. Runs entirely in the browser: no account, no server, no upload.

> Not a medical device. No dosing, treatment or diagnostic advice. No HIPAA or regulatory claim.

## Launch (Windows, macOS, Linux)

```bash
npm install
npm run build      # bundles src/ to dist/
npm run serve      # http://localhost:5173
```

Open the URL on your computer, or on an iPhone on the same Wi-Fi (use your computer's LAN address; the server binds to localhost by default, so use a tunnel or change the host in `scripts/serve.mjs` only for private testing). Nothing is deployed anywhere by these commands.

Useful URL options: `?telemetry=local` (shows an in-tab event counter; nothing leaves the tab), `?flags=eventLogging` (flag overrides; unfinished features stay hidden by default).

## Verify

```bash
npm run typecheck
npm test           # 59 unit tests: analytics, CSV parser, demo data, templates, telemetry, flags
npm run e2e        # Chromium: exports, alpha, safe areas, CSV import, privacy, layouts
```

`e2e` needs `playwright` (with Chromium) and `sharp` installed. Screenshots and exported PNGs are written to `$TMPDIR/gluca-e2e` (or `E2E_OUT`).

## Layout

| Path | What |
| --- | --- |
| `src/analytics.ts` | Duration-weighted stats (time in range, mean, coverage); gaps are never interpolated |
| `src/csv.ts` | Local Dexcom Clarity CSV parser; never keeps patient info or file name |
| `src/templates.ts`, `svg.ts` | Six templates built as one SVG used for both preview and export |
| `src/telemetry.ts`, `flags.ts` | Closed-spec analytics (off by default) and feature flags |
| `src/app.ts`, `index.html`, `app.css` | The browser app |
| `samples/clarity-sample.csv` | Synthetic Clarity-shaped file with fictional patient info |
| `docs/` | Vision, scope, validation plan, metrics, roadmap |

Font: Inter (SIL Open Font License 1.1), subset and embedded so exports look the same on every device.

## Porting to the Expo app

`src/` has no DOM dependency except `app.ts`. The analytics, CSV, copy, templates and telemetry modules can move into the Expo repo unchanged; replace the canvas export with `react-native-svg` + `view-shot` (or keep the web build in a WebView). The real repo has not been inspected yet.
