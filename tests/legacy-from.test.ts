import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

void test('legacy from URLs retain useful filters and never redirect off-site', async () => {
  for (const path of [
    '/?city=batumi&from=https://example.com&paid=true',
    '/vacancies/example?preview=1&from=&from=/',
  ]) {
    const request = new NextRequest(`https://jobx.ge${path}`);
    const response = await proxy(request);
    const expected = new URL(request.url);
    expected.searchParams.delete('from');
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), expected.href);
    assert.equal(
      (await proxy(new NextRequest(expected))).headers.get('location'),
      null,
    );
  }
});

void test('form submissions are not redirected', async () => {
  const response = await proxy(
    new NextRequest('https://jobx.ge/post-job?from=/', { method: 'POST' }),
  );
  assert.equal(response.headers.get('location'), null);
});
