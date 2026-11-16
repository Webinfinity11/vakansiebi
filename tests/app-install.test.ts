import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canWaitForInstall,
  canPromptAfterWait,
  chromeInstallIntent,
  isInAppBrowser,
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

void test('embedded browser detection covers popular apps and Android webviews', () => {
  for (const ua of [
    'Mozilla/5.0 [FBAN/FBIOS;FBAV/491.0]',
    'Mozilla/5.0 Android FB_IAB/FB4A',
    'Mozilla/5.0 Instagram 123',
    'Mozilla/5.0 Messenger/123',
    'Mozilla/5.0 TikTok/123',
    'Mozilla/5.0 musical_ly_2024',
    'Mozilla/5.0 BytedanceWebview',
    'Mozilla/5.0 Line/14.0',
    'Mozilla/5.0 (Linux; Android 15; Pixel; wv) Chrome/130.0',
    'Mozilla/5.0 (Linux; Android;wv) Chrome/130.0',
    'Mozilla/5.0 MicroMessenger/8.0',
  ])
    assert.equal(isInAppBrowser(ua), true, ua);
  for (const ua of [
    'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1',
    'Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130',
    'Mozilla/5.0 (Macintosh) Version/18.0 Safari/605.1',
  ])
    assert.equal(isInAppBrowser(ua), false, ua);
});

void test('wait only in browsers that can deliver a native install event', () => {
  assert.equal(canWaitForInstall('Android Chrome/130.0'), true);
  assert.equal(canWaitForInstall('Windows Chrome/130.0 Edg/130.0'), true);
  assert.equal(canWaitForInstall('Android; wv) Chrome/130.0'), false);
  assert.equal(canWaitForInstall('iPhone CriOS/130.0'), false);
  assert.equal(canWaitForInstall('Macintosh Chrome/130.0', 5), false);
  assert.equal(canWaitForInstall('Android Firefox/130.0'), false);
});

void test('delayed prompts require current transient activation, not past activation', () => {
  assert.equal(canPromptAfterWait({ isActive: true }), true);
  assert.equal(canPromptAfterWait({ isActive: false }), false);
  assert.equal(canPromptAfterWait(undefined), false);
});

void test('Chrome intent keeps the current path and query without allowing fragment injection', () => {
  assert.equal(
    chromeInstallIntent(
      'https://jobx.ge/vacancies/example?city=tbilisi#Intent;package=evil;end',
    ),
    'intent://jobx.ge/vacancies/example?city=tbilisi#Intent;scheme=https;package=com.android.chrome;end',
  );
  assert.equal(
    chromeInstallIntent('https://jobx.ge/'),
    'intent://jobx.ge/#Intent;scheme=https;package=com.android.chrome;end',
  );
});
