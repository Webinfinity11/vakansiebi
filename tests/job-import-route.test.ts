import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { POST } from '../app/api/job-import/route';
import { readJobImportFile } from '../lib/server/job-import-file';
import { ApiError } from '../lib/server/auth';
import { rateLimit, resetRateLimits } from '../lib/server/rate-limit';
import { maxCvBytes } from '../lib/cv-upload';

const origin = process.env.APP_URL
  ? new URL(process.env.APP_URL).origin
  : 'http://127.0.0.1:3270';
async function request(
  bytes?: Uint8Array,
  filename = 'vacancy.txt',
  ip = 'import-test',
) {
  const data = new FormData();
  const content =
    bytes ??
    (await readFile(
      new URL('./fixtures/job-import/sales-manager.txt', import.meta.url),
    ));
  data.set('file', new File([new Uint8Array(content)], filename));
  return new Request(origin + '/api/job-import', {
    method: 'POST',
    body: data,
    headers: { Origin: origin, 'x-forwarded-for': ip },
  });
}
test('anonymous TXT upload returns fields and private no-store', async () => {
  resetRateLimits();
  const response = await POST(await request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const result = await response.json();
  assert.equal(result.fields.title, 'გაყიდვების მენეჯერი');
  assert.equal(result.fields.salaryBasis, 'დარიცხული');
  assert.deepEqual(result.found, Object.keys(result.fields));
});
test('size header is rejected before the body is consumed', async () => {
  const req = new Request(origin, {
    method: 'POST',
    body: 'unread',
    headers: { 'content-length': String(maxCvBytes + 100001) },
  });
  await assert.rejects(
    readJobImportFile(req),
    (e: unknown) => e instanceof ApiError && e.status === 413,
  );
  assert.equal(req.bodyUsed, false);
});
test('invalid formats, executable TXT and actual oversize are rejected', async () => {
  for (const [bytes, filename, status] of [
    [Buffer.from('MZexecutable'), 'fake.txt', 415],
    [Buffer.from('plain text'), 'fake.pdf', 415],
    [Buffer.from('PKfake zip'), 'fake.docx', 415],
    [Buffer.from('PKfake zip'), 'fake.odt', 415],
    [Buffer.from('plain text'), 'fake.exe', 415],
    [new Uint8Array(maxCvBytes + 1).fill(97), 'large.txt', 413],
  ] as const) {
    await assert.rejects(
      readJobImportFile(await request(bytes, filename)),
      (e: unknown) => e instanceof ApiError && e.status === status,
    );
  }
});
test('sixth request is limited with Retry-After', async () => {
  resetRateLimits();
  for (let i = 0; i < 5; i++)
    assert.equal((await POST(await request())).status, 200);
  const response = await POST(await request());
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.deepEqual(await response.json(), {
    error: 'ძალიან ბევრი მცდელობაა. სცადეთ მოგვიანებით.',
  });
});
test('hour quota remains enforced when minute quota is available', async () => {
  resetRateLimits();
  for (let i = 0; i < 30; i++)
    rateLimit('job-import:h:import-test', { limit: 30, windowMs: 3600000 });
  const response = await POST(await request());
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 3500);
});
test('foreign origin is refused before file extraction', async () => {
  resetRateLimits();
  const req = await request();
  req.headers.set('Origin', 'https://foreign.example');
  assert.equal((await POST(req)).status, 403);
});
