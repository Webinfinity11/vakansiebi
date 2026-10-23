import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { sampleCv } from '../lib/cv';

let token: string | undefined;

void test('private Swipe downloads and application lists reject missing and invalid admin sessions before storage', async () => {
  const require = createRequire(import.meta.url);
  const headers = require('next/headers');
  const original = headers.cookies;
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

void test('admin can open and download a JOBX application PDF; expired and missing CVs stay unavailable', async () => {
  const require = createRequire(import.meta.url);
  const headers = require('next/headers');
  const originalCookies = headers.cookies;
  const savedSecret = process.env.SESSION_SECRET;
  const savedDatabase = process.env.DATABASE_URL;
  const globals = globalThis as unknown as { ertadPool?: Pool };
  const savedPool = globals.ertadPool;
  process.env.SESSION_SECRET = 'swipe-admin-test-secret-at-least-32-characters';
  process.env.DATABASE_URL = 'postgres://localhost/unused_mock_database';
  const { sessionToken } = await import('../lib/server/auth');
  token = sessionToken();
  headers.cookies = async () => ({ get: () => ({ value: token }) });
  const id = randomUUID();
  let available = true;
  let kind = 'jobx';
  let applicationExists = true;
  globals.ertadPool = {
    query: async (sql: string, params: string[]) => {
      assert.equal(params[0], id);
      if (sql.includes('FROM swipe_applications'))
        return {
          rows: applicationExists
            ? [{ cv_file: null, cv_kind: kind, resume_id: id }]
            : [],
        };
      assert.ok(sql.includes('expires_at>now()'));
      return { rows: available ? [{ cv: sampleCv('ka'), photo: null }] : [] };
    },
  } as unknown as Pool;
  try {
    const { GET } = await import('../app/api/admin/swipe/download/route');
    for (const [query, disposition] of [
      ['&view=1', 'inline'],
      ['', 'attachment'],
    ]) {
      const response = await GET(
        new Request(
          `http://localhost/api/admin/swipe/download?id=${id}${query}`,
        ),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.ok(
        response.headers.get('content-disposition')?.startsWith(disposition),
      );
      const pdf = Buffer.from(await response.arrayBuffer());
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert.ok(pdf.length > 1000);
    }
    available = false;
    assert.equal(
      (
        await GET(
          new Request(
            `http://localhost/api/admin/swipe/download?id=${id}&view=1`,
          ),
        )
      ).status,
      404,
    );
    kind = 'upload';
    assert.equal(
      (
        await GET(
          new Request(
            `http://localhost/api/admin/swipe/download?id=${id}&view=1`,
          ),
        )
      ).status,
      404,
    );
    applicationExists = false;
    assert.equal(
      (
        await GET(
          new Request(`http://localhost/api/admin/swipe/download?id=${id}`),
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await GET(
          new Request('http://localhost/api/admin/swipe/download?id=invalid'),
        )
      ).status,
      400,
    );
  } finally {
    headers.cookies = originalCookies;
    globals.ertadPool = savedPool;
    if (savedSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = savedSecret;
    if (savedDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedDatabase;
  }
});
