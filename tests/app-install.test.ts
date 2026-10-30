import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installDismissed,
  installPage,
  installPlatform,
} from '../lib/app-install';

void test('installation guidance recognizes iPhones, desktop-mode iPads and Android without treating Macs as phones', () => {
  assert.equal(
    installPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'),
    'ios',
  );
  assert.equal(
    installPlatform('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'),
    'ios',
  );
  assert.equal(
    installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5),
    'ios',
  );
  assert.equal(
    installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 0),
    'desktop',
  );
  assert.equal(
    installPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9)'),
    'android',
  );
  assert.equal(
    installPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    'desktop',
  );
});

void test('installation declines stay quiet for exactly seven days and malformed storage does not break the visit', () => {
  const now = Date.parse('2026-10-25T12:00:00Z');
  const week = 7 * 86_400_000;
  assert.equal(installDismissed(String(now), now), true);
  assert.equal(installDismissed(String(now - week + 1), now), true);
  assert.equal(installDismissed(String(now - week), now), false);
  for (const value of [null, '', 'NaN', '0'])
    assert.equal(installDismissed(value, now), false);
});
void test('installation offers stay out of applications, CV editing, administration and invoices', () => {
  for (const path of ['/', '/map', '/companies', '/vacancies/example'])
    assert.equal(installPage(path), true);
  for (const path of [
    '/admin',
    '/post-job',
    '/cv',
    '/swipe',
    '/invoices/123',
    '/business',
  ])
    assert.equal(installPage(path), false);
});
