import test from 'node:test';
import assert from 'node:assert/strict';
import { installDismissed, installPage } from '../lib/app-install';

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
