import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { POST } from '../app/api/jobs/[id]/report/route';
import { resetRateLimits } from '../lib/server/rate-limit';

const origin = 'http://localhost:3110';
const globalDb = globalThis as unknown as { ertadPool?: Pool };
const saved = {
  APP_URL: process.env.APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  pool: globalDb.ertadPool,
};
beforeEach(() => {
  process.env.APP_URL = origin;
  process.env.DATABASE_URL = 'postgresql://ertad@127.0.0.1:55432/ertad_test';
  globalDb.ertadPool = {
    connect() {
      throw Error('Invalid requests must never reach storage');
    },
  } as unknown as Pool;
  resetRateLimits();
});
afterEach(() => {
  for (const name of ['APP_URL', 'DATABASE_URL'] as const) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  globalDb.ertadPool = saved.pool;
  resetRateLimits();
});

function post(input: unknown, id: string = randomUUID(), ip = '192.0.2.1') {
  return POST(
    new Request(`${origin}/api/jobs/${id}/report`, {
      method: 'POST',
      headers: {
        origin,
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify(input),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function storage({ duplicate = false, missing = false } = {}) {
  const inserts: unknown[][] = [];
  const commands: string[] = [];
  let released = 0;
  globalDb.ertadPool = {
    connect: async () => ({
      async query(sql: string, values: unknown[] = []) {
        commands.push(sql);
        if (sql.includes('FROM jobs'))
          return {
            rowCount: missing ? 0 : 1,
            rows: missing ? [] : [{ id: values[0] }],
          };
        if (sql.includes('SELECT id FROM job_reports'))
          return {
            rowCount: duplicate ? 1 : 0,
            rows: duplicate ? [{ id: '1' }] : [],
          };
        if (sql.startsWith('INSERT INTO job_reports')) inserts.push(values);
        return { rowCount: 1, rows: [] };
      },
      release() {
        released++;
      },
    }),
  } as unknown as Pool;
  return { inserts, commands, released: () => released };
}

void test('reports reject invalid reasons, notes and vacancy IDs before storage', async () => {
  for (const input of [
    {},
    null,
    [],
    { reason: 'spam' },
    { reason: 1 },
    { reason: 'wrong', note: null },
    { reason: 'wrong', note: 42 },
    { reason: 'wrong', note: 'ა'.repeat(301) },
    { reason: 'wrong', note: 'invalid\u0000text' },
  ]) {
    const response = await post(input);
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.match((await response.json()).error, /შეამოწმე/);
  }
  assert.equal((await post({ reason: 'other' }, 'bad-id')).status, 400);
});

void test('reports reject cross-origin, missing origin, wrong content type, malformed and oversized bodies', async () => {
  const id = randomUUID();
  const cases = [
    {
      origin: 'https://example.com',
      type: 'application/json',
      body: '{}',
      status: 403,
    },
    { origin: '', type: 'application/json', body: '{}', status: 403 },
    { origin, type: 'text/plain', body: '{}', status: 415 },
    { origin, type: 'application/json', body: '{', status: 400 },
    { origin, type: 'application/json', body: 'a'.repeat(200001), status: 413 },
  ];
  for (const item of cases) {
    const response = await POST(
      new Request(`${origin}/api/jobs/${id}/report`, {
        method: 'POST',
        headers: {
          ...(item.origin ? { origin: item.origin } : {}),
          'Content-Type': item.type,
        },
        body: item.body,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(response.status, item.status);
  }
});

void test('all four reasons accept optional notes up to 300 characters and store only report fields', async () => {
  const state = storage();
  const notes = [undefined, '', '  შესამოწმებელია  ', 'ა'.repeat(300)];
  for (const [index, reason] of [
    'expired',
    'wrong',
    'duplicate',
    'other',
  ].entries()) {
    const id = randomUUID();
    const response = await post(
      {
        reason,
        note: notes[index],
        ip: 'ignored',
        cookie: 'ignored',
        resolved_at: '2026-01-01',
      },
      id,
    );
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), {
      received: true,
      alreadyReceived: false,
      message: 'მიღებულია',
    });
    assert.deepEqual(state.inserts[index], [
      id,
      reason,
      notes[index]?.trim() || null,
    ]);
  }
  assert.equal(state.released(), 4);
});

void test('an existing open report returns the duplicate acknowledgement without inserting or replacing its note', async () => {
  const state = storage({ duplicate: true });
  const response = await post({ reason: 'wrong', note: 'changed note' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    received: true,
    alreadyReceived: true,
    message: 'უკვე მიღებულია',
  });
  assert.equal(state.inserts.length, 0);
  assert.equal(state.commands.at(-1), 'COMMIT');
  assert.equal(state.released(), 1);
});

void test('a missing vacancy is not reported and releases its transaction', async () => {
  const state = storage({ missing: true });
  const response = await post({ reason: 'expired' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'ვაკანსია ვერ მოიძებნა' });
  assert.equal(state.inserts.length, 0);
  assert.equal(state.commands.at(-1), 'ROLLBACK');
  assert.equal(state.released(), 1);
});

void test('reports allow three attempts per hour per address and vacancy, including retries', async () => {
  const state = storage({ duplicate: true });
  const id = randomUUID();
  for (let index = 0; index < 3; index++)
    assert.equal((await post({ reason: 'wrong' }, id)).status, 200);
  const limited = await post({ reason: 'other' }, id.toUpperCase());
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 3500);
  assert.equal(state.released(), 3, 'limited request does not reach storage');
  assert.equal((await post({ reason: 'wrong' }, randomUUID())).status, 200);
  assert.equal((await post({ reason: 'wrong' }, id, '192.0.2.2')).status, 200);
});
