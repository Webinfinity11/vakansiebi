import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

void test('private Swipe downloads and application lists reject missing and invalid admin sessions before storage', async () => {
  const require = createRequire(import.meta.url);
  const headers = require('next/headers');
  const original = headers.cookies;
  let token: string | undefined;
  headers.cookies = async () => ({
    get: () => (token ? { value: token } : undefined),
  });
  try {
    const { GET } = await import('../app/api/admin/swipe/download/route');
    const { GET: list } = await import('../app/api/admin/swipe/route');
    for (const value of [undefined, 'invalid']) {
      token = value;
      const response = await GET(
        new Request('http://localhost/api/admin/swipe/download?id=invalid'),
      );
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(
        (await list(new Request('http://localhost/api/admin/swipe'))).status,
        401,
      );
    }
  } finally {
    headers.cookies = original;
  }
});
