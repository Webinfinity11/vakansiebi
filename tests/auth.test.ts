import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import {
  verifyPassword,
  verifySession,
  sessionToken,
  checkOrigin,
} from '../lib/server/auth';
process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-tests-only';
process.env.ADMIN_PASSWORD_HASH =
  'salt:' + scryptSync('test-password', 'salt', 64).toString('hex');
process.env.APP_URL = 'http://localhost:3000';
void test('admin password verification rejects incorrect and oversized input', () => {
  assert.equal(verifyPassword('test-password'), true);
  assert.equal(verifyPassword('bad'), false);
  assert.equal(verifyPassword('x'.repeat(300)), false);
});
void test('signed sessions reject tampering, missing values and expiration', () => {
  const token = sessionToken();
  assert.equal(verifySession(token), true);
  assert.equal(verifySession(token + 'x'), false);
  assert.equal(verifySession(undefined), false);
  assert.equal(verifySession('1.nonce.deadbeef'), false);
});
void test('mutations require same-origin browser requests', () => {
  assert.doesNotThrow(() =>
    checkOrigin(
      new Request('http://localhost:3000/api/admin/jobs', {
        headers: { origin: 'http://localhost:3000' },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(
      new Request('http://localhost:3000/api/admin/jobs', {
        headers: { origin: 'https://evil.test' },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(new Request('http://localhost:3000/api/admin/jobs')),
  );
});

for (const { nodeEnv, appUrl, secure } of [
  { nodeEnv: 'production', appUrl: 'https://example.test', secure: true },
  { nodeEnv: 'production', appUrl: 'http://example.test', secure: true },
  { nodeEnv: 'production', appUrl: '', secure: true },
  { nodeEnv: 'development', appUrl: 'https://example.test', secure: true },
  { nodeEnv: 'development', appUrl: 'http://localhost:3000', secure: false },
] as const) {
  void test(`admin session cookie attributes and root-path clearing (${nodeEnv}, APP_URL=${JSON.stringify(appUrl)})`, async () => {
    const { execFileSync } = await import('node:child_process');
    // Mock before the first ESM import in an isolated process: the existing auth
    // imports and their environment must remain unchanged for the other tests.
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        const headersModule = require('next/headers');
        const { ResponseCookies } = require('next/dist/compiled/@edge-runtime/cookies');
        const headers = new Headers();
        const store = new ResponseCookies(headers);
        const writes = [];
        headersModule.cookies = async () => ({
          set(...args) { writes.push(args); store.set(...args); },
          delete(name) { store.delete(name); },
        });
        const { setSession, clearSession } = await import('./lib/server/auth.ts');
        await setSession('test-session');
        const setCookie = headers.get('set-cookie');
        await clearSession();
        console.log(JSON.stringify({ writes, setCookie, cleared: headers.get('set-cookie') }));
      `,
      ],
      {
        cwd: new URL('../', import.meta.url),
        env: {
          ...process.env,
          APP_URL: appUrl,
          NODE_ENV: nodeEnv,
        },
        encoding: 'utf8',
        timeout: 15_000,
      },
    );
    const result = JSON.parse(output);
    assert.deepEqual(result.writes, [
      [
        'ertad_admin',
        'test-session',
        {
          httpOnly: true,
          secure,
          sameSite: 'strict',
          path: '/',
          maxAge: 12 * 3600,
        },
      ],
    ]);
    assert.match(result.setCookie, /^ertad_admin=test-session; path=\//i);
    assert.match(result.setCookie, /; max-age=43200(?:;|$)/i);
    assert.equal(/; secure(?:;|$)/i.test(result.setCookie), secure);
    assert.match(result.setCookie, /; httponly(?:;|$)/i);
    assert.match(result.setCookie, /; samesite=strict(?:;|$)/i);
    assert.equal(
      result.cleared,
      'ertad_admin=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
  });
}
