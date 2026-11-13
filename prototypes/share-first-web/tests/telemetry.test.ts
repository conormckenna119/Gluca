import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetry } from '../src/telemetry';
import { DEFAULT_FLAGS, parseOverrides, resolveFlags, configureFlags, isEnabled } from '../src/flags';

test('telemetry is off by default and records nothing', () => {
  const t = createTelemetry();
  t.track('app_opened');
  t.track('export_started', { template: 'humorous', format: 'story_1080x1920' });
  assert.equal(t.mode(), 'off');
  assert.equal(t.events().length, 0);
});

test('local mode records allowed events and properties', () => {
  const t = createTelemetry({ mode: 'local', now: () => 1000, sessionId: 's1' });
  t.track('export_succeeded', { template: 'transparent_overlay', format: 'transparent_png' });
  assert.deepEqual(t.events(), [
    { name: 'export_succeeded', props: { template: 'transparent_overlay', format: 'transparent_png' }, at: 1000, session: 's1' },
  ]);
});

test('free text, numbers and unknown keys are dropped, not recorded', () => {
  const t = createTelemetry({ mode: 'local' });
  const hostile = {
    template: 'minimal_trace',
    filename: 'clarity_export_jane_doe.csv',
    average_glucose: 134,
    caption: 'my a1c is 6.1',
    format: 'story_1080x1920 ; 142 mg/dL',
  } as never;
  t.track('export_started', hostile);
  const [e] = t.events();
  assert.deepEqual(e.props, { template: 'minimal_trace' });
  assert.equal(t.dropped().props, 4);
  assert.ok(!JSON.stringify(t.events()).match(/jane|a1c|134|142|mg\/dL/));
});

test('unknown event names are dropped', () => {
  const t = createTelemetry({ mode: 'local' });
  t.track('glucose_value_viewed' as never);
  assert.equal(t.events().length, 0);
  assert.equal(t.dropped().events, 1);
});

test('feedback answers are limited to fixed choices', () => {
  const t = createTelemetry({ mode: 'local' });
  t.track('feedback_submitted', { shared_externally: 'yes', felt_represented: '4' });
  t.track('feedback_submitted', { shared_externally: 'I posted it on my story' } as never);
  assert.deepEqual(t.events()[0].props, { shared_externally: 'yes', felt_represented: '4' });
  assert.deepEqual(t.events()[1].props, {});
});

test('buffer is capped, counts carry no values, clear resets everything', () => {
  const t = createTelemetry({ mode: 'local', maxEvents: 3 });
  for (let i = 0; i < 5; i++) t.track('app_opened');
  t.track('demo_started');
  assert.equal(t.events().length, 3);
  assert.deepEqual(t.counts(), { app_opened: 2, demo_started: 1 });
  t.clear();
  assert.equal(t.events().length, 0);
});

test('turning telemetry back off stops recording', () => {
  const t = createTelemetry({ mode: 'local' });
  t.track('app_opened');
  t.setMode('off');
  t.track('demo_started');
  assert.equal(t.events().length, 1);
});

test('share sheet is recorded as opened, never as published', () => {
  const t = createTelemetry({ mode: 'local' });
  t.track('share_sheet_opened', { template: 'daily_recap', format: 'story_1080x1920' });
  assert.equal(t.events()[0].name, 'share_sheet_opened');
  assert.ok(!t.events().some((e) => (e.name as string).includes('publish') || (e.name as string).includes('posted')));
});

test('flags: MVP on, everything beyond it off by default', () => {
  assert.equal(DEFAULT_FLAGS.shareFirstMvp, true);
  assert.equal(DEFAULT_FLAGS.localCsvImport, true);
  for (const k of ['communityFeed', 'clubs', 'accounts', 'dexcomApi', 'appleHealth', 'wrapped', 'eventLogging'] as const) {
    assert.equal(DEFAULT_FLAGS[k], false, k);
  }
});

test('flag overrides parse, ignore unknown names and bad values', () => {
  assert.deepEqual(parseOverrides('communityFeed, clubs=false ,nope,wrapped=maybe,shareFirstMvp=false'), {
    communityFeed: true, clubs: false, shareFirstMvp: false,
  });
  assert.deepEqual(parseOverrides(undefined), {});
  assert.equal(resolveFlags('wrapped').wrapped, true);
  configureFlags('vizGallery');
  assert.equal(isEnabled('vizGallery'), true);
  configureFlags(undefined);
  assert.equal(isEnabled('vizGallery'), false);
});
