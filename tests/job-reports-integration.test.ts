import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Client, type Pool } from 'pg';
import { resetRateLimits } from '../lib/server/rate-limit';

void test(
  'report routes store once, enforce the 24-hour open-reason rule and let only an admin list and resolve reports',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'reports_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: url.href });
    const saved = {
      DATABASE_URL: process.env.DATABASE_URL,
      APP_URL: process.env.APP_URL,
      SESSION_SECRET: process.env.SESSION_SECRET,
    };
    const globalDb = globalThis as unknown as { ertadPool?: Pool };
    const previousPool = globalDb.ertadPool;
    const require = createRequire(import.meta.url);
    const headersModule = require('next/headers');
    const originalCookies = headersModule.cookies;
    let token: string | undefined;
    // Same pre-import cookie adapter as auth.test.ts; authentication itself stays real.
    headersModule.cookies = async () => ({
      get: (name: string) =>
        name === 'ertad_admin' && token ? { value: token } : undefined,
    });
    const origin = 'http://localhost:3110';
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations')
        .filter((f) => f.endsWith('.sql'))
        .sort())
        await client.query(readFileSync('db/migrations/' + file, 'utf8'));
      // Reapplying the new migration must be harmless.
      await client.query(
        readFileSync('db/migrations/024_job_reports.sql', 'utf8'),
      );
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      process.env.APP_URL = origin;
      process.env.SESSION_SECRET =
        'isolated-job-reports-test-secret-at-least-32-characters';
      delete globalDb.ertadPool;
      const { POST } = await import('../app/api/jobs/[id]/report/route');
      const { GET, PATCH } = await import('../app/api/admin/reports/route');
      const { sessionToken } = await import('../lib/server/auth');
      const request = (
        path: string,
        method = 'GET',
        input?: unknown,
        requestOrigin = origin,
      ) =>
        new Request(`${origin}${path}`, {
          method,
          headers: {
            origin: requestOrigin,
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.0.2.10',
          },
          ...(input === undefined ? {} : { body: JSON.stringify(input) }),
        });
      const report = (id: string, reason = 'wrong', note?: string) =>
        POST(request(`/api/jobs/${id}/report`, 'POST', { reason, note }), {
          params: Promise.resolve({ id }),
        });
      const list = () => GET(request('/api/admin/reports?open=1'));
      const resolve = (id: string, resolved = true) =>
        PATCH(request('/api/admin/reports', 'PATCH', { id, resolved }));
      const id = randomUUID(),
        concurrentId = randomUUID();
      for (const jobId of [id, concurrentId])
        await client.query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint) VALUES($1,$2,$2,'published',$3)",
          [jobId, { title: 'სატესტო ვაკანსია', company: 'სატესტო კომპანია' }, jobId],
        );

      assert.equal((await list()).status, 401);
      assert.equal((await resolve('1')).status, 401);
      token = 'invalid';
      assert.equal((await list()).status, 401);
      token = sessionToken();
      assert.equal((await report(randomUUID())).status, 404);
      const first = await report(id, 'wrong', '  არასწორი გრაფიკი  ');
      assert.equal(first.status, 201);
      assert.equal((await first.json()).alreadyReceived, false);
      const duplicate = await report(id, 'wrong', 'არ უნდა ჩაანაცვლოს');
      assert.equal(duplicate.status, 200);
      assert.equal((await duplicate.json()).message, 'უკვე მიღებულია');
      let rows = (
        await client.query('SELECT * FROM job_reports WHERE job_id=$1', [id])
      ).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].note, 'არასწორი გრაფიკი');
      assert.equal(rows[0].resolved_at, null);
      assert.deepEqual(Object.keys(rows[0]).sort(), [
        'created_at',
        'id',
        'job_id',
        'note',
        'reason',
        'resolved_at',
      ]);
      const firstId = rows[0].id;
      const openResponse = await list();
      assert.equal(openResponse.status, 200);
      assert.equal(
        openResponse.headers.get('Cache-Control'),
        'private, no-store',
      );
      const open = (await openResponse.json()).reports;
      assert.equal(open.length, 1);
      assert.equal(open[0].title, 'სატესტო ვაკანსია');
      assert.equal(open[0].url, `/vacancies/${id}`);

      for (const invalidId of ['0', '-1', 'bad', '9223372036854775808'])
        assert.equal((await resolve(invalidId)).status, 400);
      assert.equal((await resolve(firstId, false)).status, 400);
      assert.equal(
        (
          await PATCH(
            request(
              '/api/admin/reports',
              'PATCH',
              { id: firstId, resolved: true },
              'https://example.com',
            ),
          )
        ).status,
        403,
      );
      assert.equal((await resolve('9223372036854775807')).status, 404);
      const closed = await resolve(firstId);
      assert.equal(closed.status, 200);
      const closedAt = (await closed.json()).report.resolved_at;
      assert.ok(closedAt);
      assert.equal(
        (await (await resolve(firstId)).json()).report.resolved_at,
        closedAt,
      );
      assert.equal((await (await list()).json()).reports.length, 0);
      assert.equal(
        (await (await GET(request('/api/admin/reports'))).json()).reports
          .length,
        1,
      );
      assert.equal(
        (await report(id)).status,
        201,
        'a resolved report does not suppress a new one',
      );

      resetRateLimits();
      assert.equal(
        (await report(id, 'expired')).status,
        201,
        'different reasons remain separate',
      );
      await client.query(
        "UPDATE job_reports SET created_at=now()-interval '23 hours 59 minutes' WHERE job_id=$1 AND reason='expired'",
        [id],
      );
      assert.equal(
        (await report(id, 'expired')).status,
        200,
        'open same reason within 24 hours is a duplicate',
      );
      await client.query(
        "UPDATE job_reports SET created_at=now()-interval '24 hours 1 minute' WHERE job_id=$1 AND reason='expired'",
        [id],
      );
      assert.equal(
        (await report(id, 'expired')).status,
        201,
        'an older open report does not suppress a new one',
      );
      const concurrent = await Promise.all([
        report(concurrentId),
        report(concurrentId),
        report(concurrentId),
      ]);
      assert.deepEqual(concurrent.map((r) => r.status).sort((a, b) => a - b), [200, 200, 201]);
      rows = (
        await client.query('SELECT * FROM job_reports WHERE job_id=$1', [
          concurrentId,
        ])
      ).rows;
      assert.equal(
        rows.length,
        1,
        'concurrent reports cannot create duplicates',
      );
      assert.equal((await report(concurrentId)).status, 429);
      await client.query('DELETE FROM jobs WHERE id=$1', [concurrentId]);
      assert.equal(
        (
          await client.query('SELECT * FROM job_reports WHERE job_id=$1', [
            concurrentId,
          ])
        ).rowCount,
        0,
      );
    } finally {
      if (globalDb.ertadPool && globalDb.ertadPool !== previousPool)
        await globalDb.ertadPool.end();
      globalDb.ertadPool = previousPool;
      headersModule.cookies = originalCookies;
      resetRateLimits();
      for (const name of [
        'DATABASE_URL',
        'APP_URL',
        'SESSION_SECRET',
      ] as const) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    }
  },
);
