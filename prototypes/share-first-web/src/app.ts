// Browser entry point. Everything runs locally: no network requests, no storage, no account.
import { DAY_MS, DEFAULT_RANGE, cleanReadings, dayStart, formatGlucose, fromMmol, parseYmd, toMmol, ymd, type Reading, type Unit } from './analytics';
import { BRAND } from './brand';
import { TONES, TONE_LABEL, captionFor, headlineFor, type Tone } from './copy';
import { parseGlucoseCsv, type DateOrder } from './csv';
import { generateDemo } from './demo';
import { FONT_FACES } from './font-data';
import { configureFlags, isEnabled } from './flags';
import { FORMATS, FORMAT_ORDER, telemetryFormat, type FormatId } from './formats';
import { defaultSettings, makeArtModel, withTemplate, type Settings } from './model';
import { SWATCHES, type Measure } from './svg';
import { TEMPLATE_INFO, TEMPLATE_ORDER, buildArtwork, type ShowOptions } from './templates';
import { telemetry } from './telemetry';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const qa = <T extends HTMLElement>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel));

// ---------- configuration from the URL (no storage) ----------
const params = new URLSearchParams(location.search);
configureFlags(params.get('flags') ?? undefined);
if (params.get('telemetry') === 'local') telemetry.setMode('local'); // never 'remote': there is no remote sink

// ---------- state ----------
type Source = 'demo' | 'csv';
interface State {
  readings: Reading[];
  source: Source | null;
  anchor: number;
  s: Settings;
  toneIndex: number;
  pendingCsv: { text: string; unit?: Unit; dateOrder?: DateOrder } | null;
}
const state: State = { readings: [], source: null, anchor: 0, s: defaultSettings('daily_recap'), toneIndex: 0, pendingCsv: null };

// ---------- font + measuring ----------
let measure: Measure = (t, size) => t.length * size * 0.58;
async function loadFont(): Promise<void> {
  try {
    await Promise.all(Object.entries(FONT_FACES).map(async ([w, b64]) => {
      const bin = atob(b64); const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const face = new FontFace('GlucaInter', buf.buffer, { weight: w });
      await face.load(); document.fonts.add(face);
    }));
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) measure = (t, size, weight) => { ctx.font = `${weight} ${size}px GlucaInter, sans-serif`; return ctx.measureText(t).width; };
  } catch { /* fall back to the approximate measurer and system fonts */ }
}

// ---------- helpers ----------
const dataBounds = (): { first: number; last: number } | null => {
  if (!state.readings.length) return null;
  return { first: dayStart(state.readings[0].t), last: dayStart(state.readings[state.readings.length - 1].t) };
};
const hasData = (): boolean => state.readings.length > 0;

/** Default anchor: the most recent day that is mostly complete, else the most recent day. */
function pickAnchor(): number {
  const b = dataBounds(); if (!b) return 0;
  const lastCount = state.readings.filter((r) => r.t >= b.last).length;
  return lastCount >= 0.8 * 288 || b.last === b.first ? b.last : b.last - DAY_MS;
}

function show(id: 'landing' | 'studio'): void {
  $('landing').hidden = id !== 'landing'; $('studio').hidden = id !== 'studio'; $('reset').hidden = id !== 'studio';
  if (id === 'landing') window.scrollTo(0, 0);
}

// ---------- rendering ----------
let raf = 0;
function schedule(): void { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

function currentArtwork(embedFont: boolean) {
  return buildArtwork(makeArtModel(state.readings, state.source === 'demo' ? 'demo' : 'csv', state.anchor, state.s, { embedFont, measure }));
}

function render(): void {
  if ($('studio').hidden) return;
  const s = state.s;
  const art = currentArtwork(false);
  const pv = $('preview');
  pv.innerHTML = art.svg;
  pv.classList.toggle('opaque', !s.transparent);
  pv.firstElementChild?.setAttribute('role', 'img');
  pv.firstElementChild?.setAttribute('aria-label', `Preview: ${art.contents.join('. ')}`);
  const ul = $('contents'); ul.textContent = '';
  for (const c of art.contents) { const li = document.createElement('li'); li.textContent = c; ul.appendChild(li); }

  // data bar
  const needsData = TEMPLATE_INFO[s.template].needsData;
  $('databar').hidden = !hasData() || !needsData;
  const b = dataBounds();
  if (b) {
    const di = $<HTMLInputElement>('date'); di.min = ymd(b.first); di.max = ymd(b.last); di.value = ymd(state.anchor);
    $<HTMLButtonElement>('prev').disabled = state.anchor <= b.first; $<HTMLButtonElement>('next').disabled = state.anchor >= b.last;
  }
  $('source-note').textContent = state.source === 'demo'
    ? 'Demo data: synthetic, not a real person. It is always labelled on the image.'
    : hasData() ? `Your file: ${state.readings.length.toLocaleString()} readings, ${ymd(b!.first)} to ${ymd(b!.last)}. Shown only on this screen.` : '';
  qa('[data-period]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.period === s.period)));
  $<HTMLButtonElement>('prev').setAttribute('aria-label', s.period === 'day' ? 'Previous day' : 'Previous 7 days (shift by one day)');

  // format, theme, unit, transparency
  qa('[data-format]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.format === s.format)));
  qa('[data-theme]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.theme === s.theme)));
  qa('[data-unitset]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.unitset === s.unit)));
  $<HTMLInputElement>('transparent').checked = s.transparent;
  qa<HTMLButtonElement>('#swatches button').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.hex === s.accent)));

  // templates
  qa<HTMLButtonElement>('#templates button').forEach((el) => {
    const t = el.dataset.template as Settings['template'];
    el.setAttribute('aria-pressed', String(t === s.template));
    el.disabled = TEMPLATE_INFO[t].needsData && !hasData();
    el.title = el.disabled ? 'This template needs glucose data. Try demo data or import a file.' : '';
  });

  // tones
  qa<HTMLButtonElement>('#tones button').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.tone === s.tone)));
  const setIf = (id: string, v: string) => { const el = $<HTMLInputElement>(id); if (document.activeElement !== el) el.value = v; };
  setIf('headline', s.headline); setIf('caption', s.caption); setIf('milestoneBig', s.milestoneBig);
  $('milestone-field').hidden = s.template !== 'milestone';
  $('stats').hidden = !needsData;
  for (const el of qa<HTMLInputElement>('[data-show]')) el.checked = s.show[el.dataset.show as keyof ShowOptions];
  const u = s.unit;
  const conv = (mg: number) => (u === 'mgdl' ? String(Math.round(mg)) : toMmol(mg).toFixed(1));
  setIf('rlow', conv(s.range.low)); setIf('rhigh', conv(s.range.high));
  $<HTMLInputElement>('rlow').step = $<HTMLInputElement>('rhigh').step = u === 'mgdl' ? '1' : '0.1';

  // data panel
  $('data-d').hidden = state.source !== 'csv';
  $('data-summary').textContent = 'Your readings live only in this tab’s memory. Removing them clears them immediately; closing the tab does too.';
  $<HTMLButtonElement>('btn-share').hidden = !canShareFiles();
  renderDebug();
}

function renderDebug(): void {
  const el = $('debug');
  el.hidden = telemetry.mode() !== 'local';
  if (!el.hidden) $('debug-pre').textContent = JSON.stringify({ mode: telemetry.mode(), counts: telemetry.counts(), dropped: telemetry.dropped() }, null, 2);
}
const track: typeof telemetry.track = (n, p) => { telemetry.track(n, p); renderDebug(); };

// ---------- entering the studio ----------
function enterStudio(source: Source): void {
  state.source = source;
  state.anchor = pickAnchor();
  const template = hasData() ? 'daily_recap' : 'milestone';
  state.s = withTemplate(state.s, template);
  state.toneIndex = 0;
  show('studio');
  render();
  track('template_selected', { template, source });
}

function startDemo(): void {
  track('demo_started');
  state.readings = cleanReadings(generateDemo()).readings;
  enterStudio('demo');
}
function startMilestone(): void {
  state.readings = [];
  enterStudio('csv'); // no demo label: a milestone graphic contains no glucose data
}

function resetAll(): void {
  state.readings = []; state.source = null; state.pendingCsv = null; state.s = defaultSettings('daily_recap');
  $<HTMLInputElement>('file').value = '';
  $('import-status').textContent = ''; $('import-unit').hidden = true; $('import-dates').hidden = true; $('export-status').textContent = '';
  show('landing');
  renderDebug();
}

// ---------- CSV import ----------
function importStatus(kind: 'ok' | 'err', msg: string, items: string[] = []): void {
  const box = $('import-status'); box.textContent = '';
  const p = document.createElement('p'); p.className = kind; p.textContent = msg; box.appendChild(p);
  if (items.length) { const ul = document.createElement('ul'); for (const i of items) { const li = document.createElement('li'); li.textContent = i; ul.appendChild(li); } box.appendChild(ul); }
}

function runImport(): void {
  const pend = state.pendingCsv; if (!pend) return;
  const res = parseGlucoseCsv(pend.text, { unit: pend.unit, dateOrder: pend.dateOrder });
  $('import-unit').hidden = true; $('import-dates').hidden = true;
  if (!res.ok) {
    if (res.needsUnit) { $('import-unit').hidden = false; importStatus('err', res.message ?? 'Choose a unit to continue.'); return; }
    track('import_failed', { reason: res.error ?? 'unknown' });
    state.pendingCsv = null;
    importStatus('err', res.message ?? 'That file could not be read.');
    return;
  }
  if (res.ambiguousDates && !pend.dateOrder) { $('import-dates').hidden = false; importStatus('ok', 'Almost there. One question about dates.'); return; }
  const { readings } = cleanReadings(res.readings);
  state.pendingCsv = null; // raw text is dropped as soon as it is parsed
  if (!readings.length) { track('import_failed', { reason: 'no_valid_rows' }); importStatus('err', 'No usable glucose readings were found in that file.'); return; }
  state.readings = readings;
  track('import_succeeded');
  const notes = [...res.warnings];
  if (res.counts.rejected) notes.push(`${res.counts.rejected} row${res.counts.rejected === 1 ? '' : 's'} could not be read and were skipped.`);
  importStatus('ok', `Imported ${readings.length.toLocaleString()} readings.`, notes.slice(0, 5));
  if (res.sourceUnit) state.s = { ...state.s, unit: res.sourceUnit };
  enterStudio('csv');
}

async function onFile(file: File): Promise<void> {
  track('import_started');
  if (file.size > 60 * 1024 * 1024) { track('import_failed', { reason: 'unsupported_format' }); importStatus('err', 'That file is larger than 60 MB. Export a shorter period from Clarity and try again.'); return; }
  try {
    const text = await file.text();
    state.pendingCsv = { text };
    runImport();
  } catch {
    track('import_failed', { reason: 'parse_error' });
    importStatus('err', 'That file could not be read.');
  }
}

// ---------- export / share ----------
const canShareFiles = (): boolean => {
  try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; }
};
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

async function renderPng(): Promise<{ blob: Blob; name: string }> {
  const art = currentArtwork(true); // font embedded so the PNG is identical on every device
  const url = URL.createObjectURL(new Blob([art.svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = art.width; canvas.height = art.height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('no canvas');
    ctx.drawImage(img, 0, 0, art.width, art.height);
    // some engines decode embedded fonts lazily: draw a second time so the first frame can't use a fallback face
    await new Promise((r) => setTimeout(r, 60));
    ctx.clearRect(0, 0, art.width, art.height); ctx.drawImage(img, 0, 0, art.width, art.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('toBlob failed');
    const s = state.s;
    return { blob, name: `gluca-${s.template.replace(/_/g, '-')}-${s.transparent ? 'transparent-' : ''}${s.format}-${art.width}x${art.height}.png` };
  } finally { URL.revokeObjectURL(url); }
}

async function doExport(share: boolean): Promise<void> {
  const s = state.s; const ev = { template: s.template, format: telemetryFormat(s.format, s.transparent) };
  const status = $('export-status'); status.textContent = 'Preparing…';
  const btns = qa<HTMLButtonElement>('#btn-export, #btn-share'); btns.forEach((b) => (b.disabled = true));
  track('export_started', ev);
  try {
    const { blob, name } = await renderPng();
    track('export_succeeded', ev);
    if (share && canShareFiles()) {
      const file = new File([blob], name, { type: 'image/png' });
      track('share_sheet_opened', ev);
      try { await navigator.share({ files: [file] }); status.textContent = 'The share sheet was opened. Gluca can’t see what you choose and never posts anything for you.'; }
      catch (e) { status.textContent = (e as Error).name === 'AbortError' ? 'Share cancelled. Nothing was sent.' : 'Sharing isn’t available here. Use Export PNG to save the image.'; }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      status.textContent = `Saved ${FORMATS[s.format].w}×${FORMATS[s.format].h} PNG${s.transparent ? ' with a transparent background' : ''}. Nothing was posted.`
        + (isIOS ? ' On iPhone, if it opened as a picture, press and hold it and choose Save Image.' : '')
        + (s.transparent ? ' Some apps fill transparent areas with black, so layer it in an editor or Stories first.' : '');
    }
  } catch {
    track('export_failed', { ...ev, reason: 'render' });
    status.textContent = 'Something went wrong while creating the image. Try another format or template.';
  } finally { btns.forEach((b) => (b.disabled = false)); }
}

// ---------- wiring ----------
function set(patch: Partial<Settings>): void { state.s = { ...state.s, ...patch }; schedule(); }
function setShow(patch: Partial<ShowOptions>): void { state.s = { ...state.s, show: { ...state.s.show, ...patch } }; schedule(); }

function shiftAnchor(days: number): void {
  const b = dataBounds(); if (!b) return;
  state.anchor = Math.max(b.first, Math.min(b.last, state.anchor + days * DAY_MS)); schedule();
}

function init(): void {
  $('brand-name').textContent = BRAND.name;
  document.title = `${BRAND.name} — ${BRAND.tagline.replace(/\.$/, '')}`;
  $('lbl-import').hidden = !isEnabled('localCsvImport');

  // templates strip
  const tpl = $('templates');
  for (const t of TEMPLATE_ORDER) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.template = t;
    b.innerHTML = `<span></span><small></small>`;
    (b.firstElementChild as HTMLElement).textContent = TEMPLATE_INFO[t].label; (b.lastElementChild as HTMLElement).textContent = TEMPLATE_INFO[t].blurb;
    tpl.appendChild(b);
  }
  tpl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-template]'); if (!b || b.disabled) return;
    const t = b.dataset.template as Settings['template'];
    state.s = withTemplate(state.s, t); state.toneIndex = 0; schedule();
    track('template_selected', { template: t, source: state.source === 'demo' ? 'demo' : 'csv' });
  });

  // tones
  const tones = $('tones');
  for (const t of TONES) { const b = document.createElement('button'); b.type = 'button'; b.dataset.tone = t; b.textContent = TONE_LABEL[t]; tones.appendChild(b); }
  tones.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tone]'); if (!b) return;
    const tone = b.dataset.tone as Tone; state.toneIndex = 0;
    set(tone === 'custom' ? { tone } : { tone, headline: headlineFor(tone, 0), caption: captionFor(tone, 0) });
  });
  $('shuffle').addEventListener('click', () => {
    const tone: Tone = state.s.tone === 'custom' ? 'minimal' : state.s.tone;
    state.toneIndex += 1; set({ tone, headline: headlineFor(tone, state.toneIndex), caption: captionFor(tone, state.toneIndex) });
  });

  // swatches
  const sw = $('swatches');
  for (const [name, hex] of Object.entries(SWATCHES)) {
    if (name === 'ink') continue;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.hex = hex; b.style.background = hex; b.setAttribute('aria-label', name);
    sw.appendChild(b);
  }
  sw.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-hex]'); if (b) set({ accent: b.dataset.hex as string }); });

  // landing
  $('btn-demo').addEventListener('click', startDemo);
  $('btn-milestone').addEventListener('click', startMilestone);
  const fileInput = $<HTMLInputElement>('file');
  fileInput.addEventListener('change', () => { const f = fileInput.files?.[0]; if (f) void onFile(f); });
  $('lbl-import').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  $('import-unit').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-unit]'); if (b && state.pendingCsv) { state.pendingCsv.unit = b.dataset.unit as Unit; runImport(); } });
  $('import-dates').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-order]'); if (b && state.pendingCsv) { state.pendingCsv.dateOrder = b.dataset.order as DateOrder; runImport(); } });
  $('reset').addEventListener('click', resetAll);
  $('btn-remove').addEventListener('click', resetAll);

  // studio
  qa('[data-period]').forEach((el) => el.addEventListener('click', () => set({ period: el.dataset.period as 'day' | 'week' })));
  $('prev').addEventListener('click', () => shiftAnchor(-1));
  $('next').addEventListener('click', () => shiftAnchor(1));
  $<HTMLInputElement>('date').addEventListener('change', (e) => {
    const v = parseYmd((e.target as HTMLInputElement).value); const b = dataBounds();
    if (v !== null && b) { state.anchor = Math.max(b.first, Math.min(b.last, v)); schedule(); }
  });
  qa('[data-format]').forEach((el) => el.addEventListener('click', () => set({ format: el.dataset.format as FormatId })));
  qa('[data-theme]').forEach((el) => el.addEventListener('click', () => set({ theme: el.dataset.theme as 'dark' | 'light' })));
  qa('[data-unitset]').forEach((el) => el.addEventListener('click', () => set({ unit: el.dataset.unitset as Unit })));
  $<HTMLInputElement>('transparent').addEventListener('change', (e) => set({ transparent: (e.target as HTMLInputElement).checked }));
  for (const el of qa<HTMLInputElement>('[data-show]')) el.addEventListener('change', () => setShow({ [el.dataset.show as string]: el.checked } as Partial<ShowOptions>));
  $<HTMLInputElement>('headline').addEventListener('input', (e) => set({ tone: 'custom', headline: (e.target as HTMLInputElement).value }));
  $<HTMLInputElement>('caption').addEventListener('input', (e) => set({ tone: 'custom', caption: (e.target as HTMLInputElement).value }));
  $<HTMLInputElement>('milestoneBig').addEventListener('input', (e) => set({ milestoneBig: (e.target as HTMLInputElement).value }));
  const rangeInput = (id: 'rlow' | 'rhigh') => $<HTMLInputElement>(id).addEventListener('change', (e) => {
    const raw = parseFloat((e.target as HTMLInputElement).value.replace(',', '.')); if (!Number.isFinite(raw)) { schedule(); return; }
    const mg = state.s.unit === 'mgdl' ? raw : fromMmol(raw);
    const next = { ...state.s.range, [id === 'rlow' ? 'low' : 'high']: Math.round(mg) };
    if (next.low >= 40 && next.high <= 400 && next.low < next.high) set({ range: next }); else schedule();
  });
  rangeInput('rlow'); rangeInput('rhigh');

  $('btn-export').addEventListener('click', () => void doExport(false));
  $('btn-share').addEventListener('click', () => void doExport(true));
  $('custom-d').addEventListener('toggle', (e) => { if ((e.target as HTMLDetailsElement).open) track('customization_opened', { template: state.s.template }); });

  $('fb').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const shared = String(f.get('shared') ?? ''); const rep = String(f.get('rep') ?? '');
    if (!shared && !rep) { $('fb-status').textContent = 'Pick an answer first, or skip this. It’s optional.'; return; }
    track('feedback_submitted', { shared_externally: shared as 'yes', felt_represented: rep as '1' });
    $('fb-status').textContent = 'Thanks. Counted in this tab only.';
  });

  if (!DEFAULT_RANGE) throw new Error('unreachable'); // keeps the import used for tree-shaking checks in tests
  void formatGlucose; void FORMAT_ORDER;
  track('app_opened');
  void loadFont().then(schedule);
}

init();
