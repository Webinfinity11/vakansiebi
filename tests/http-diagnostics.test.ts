import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { httpDiagnostic } from '../worker/http-diagnostics';
import { SourceHttpError } from '../worker/http';
const body = readFileSync('tests/fixtures/ss-next/challenge.html', 'utf8');

void test('HTTP failures retain only bounded, allowlisted and redacted diagnostics', () => {
  const headers = new Headers({
    server: 'cloudflare',
    'cf-ray': 'a518d542cdc318a4-TBS',
    'cf-mitigated': 'challenge',
    'content-type': 'text/html; charset=utf-8',
    'set-cookie': 'session=header-secret-123456789',
    authorization: 'Bearer header-secret-123456789',
  });
  for (const status of [403, 429, 500, 503, 599]) {
    const diagnostic = httpDiagnostic(status, headers, body);
    const fields = JSON.parse(diagnostic);
    assert.deepEqual(Object.keys(fields), [
      'status',
      'server',
      'cf-mitigated',
      'cf-ray',
      'content-type',
      'body',
    ]);
    assert.equal(fields.status, status);
    assert.equal(fields.server, 'cloudflare');
    assert.equal(fields['cf-mitigated'], 'challenge');
    assert.equal(fields['cf-ray'], 'a518d542cdc318a4-TBS');
    assert.equal(fields['content-type'], 'text/html');
    assert.match(fields.body, /Justamoment/);
    assert.ok(!/secret|session=|Bearer|https:|\s/.test(fields.body));
    assert.ok(fields.body.length <= 200);
    assert.ok(new SourceHttpError(status, diagnostic).message.length <= 500);
  }
  for (const status of [200, 401, 404, 410])
    assert.equal(httpDiagnostic(status, headers, body), '');
  assert.equal(new SourceHttpError(404).message, 'Source returned HTTP 404');
});

void test('diagnostics suppress environment secrets and credential-like plain text before truncating', () => {
  const previous = process.env.AUDIT_TEST_SECRET;
  process.env.AUDIT_TEST_SECRET = 'some locally configured credential';
  try {
    const result = httpDiagnostic(
      503,
      new Headers(),
      `Error ${process.env.AUDIT_TEST_SECRET}\n{"password":"sensitive-value", "access_token":"sensitive-token"}\nhttps://host.test/?key=sensitive-url\n${'x'.repeat(1000)}`,
    );
    assert.ok(!result.includes('sensitive'));
    assert.ok(!result.includes(process.env.AUDIT_TEST_SECRET));
    assert.ok(
      !httpDiagnostic(
        503,
        new Headers(),
        process.env.AUDIT_TEST_SECRET.replaceAll(' ', '&#32;'),
      ).includes('locally'),
    );
    assert.ok(result.length <= 421);
  } finally {
    if (previous === undefined) delete process.env.AUDIT_TEST_SECRET;
    else process.env.AUDIT_TEST_SECRET = previous;
  }
});
