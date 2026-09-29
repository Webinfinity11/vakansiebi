import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  trackingSchema,
  trackingUpdateSchema,
  publicTracking,
} from '../lib/tracking';

const migration = readFileSync(
  'db/migrations/049_tracking_settings.sql',
  'utf8',
);
const initial = JSON.parse(migration.split('$tracking$')[1]);
void test('existing counters and supplied Meta Pixel migrate without replacement IDs', () => {
  assert.deepEqual(trackingSchema.parse(initial), initial);
  assert.equal(initial.googleId, 'G-9S8J0W7QXM');
  assert.equal(initial.yandexId, '112737833');
  assert.equal(initial.topGeId, '118973');
  assert.match(initial.customHtml, /fbq\('init', '1422360353191134'\)/);
});
void test('disabled code remains editable but is absent from public configuration', () => {
  const settings = {
    ...initial,
    googleEnabled: false,
    yandexEnabled: false,
    topGeEnabled: false,
    customEnabled: false,
  };
  const visible = publicTracking(settings);
  for (const key of ['googleId', 'yandexId', 'topGeId', 'customHtml'] as const)
    assert.equal(visible[key], '');
  assert.notEqual(settings.customHtml, '');
  assert.deepEqual(trackingSchema.parse(visible), visible);
});
void test('tracking settings reject invalid IDs, empty enabled code, oversize snippets and absent versions', () => {
  for (const change of [
    { googleId: '" onload="alert(1)' },
    { yandexId: '0' },
    { topGeId: '-1' },
    { customHtml: ' ' },
    { customHtml: 'x'.repeat(50001) },
    { googleEnabled: 'true' },
  ])
    assert.equal(
      trackingSchema.safeParse({ ...initial, ...change }).success,
      false,
    );
  assert.equal(
    trackingUpdateSchema.safeParse({ settings: initial }).success,
    false,
  );
  assert.equal(
    trackingUpdateSchema.safeParse({ settings: initial, version: 1 }).success,
    true,
  );
});
