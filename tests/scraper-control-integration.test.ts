import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server/db';
import { wakeScraper } from '../lib/server/scraper-control';
void test(
  'simultaneous admin requests dispatch once, and a rejected GitHub request can be retried',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const token = process.env.GITHUB_ACTIONS_TOKEN;
    process.env.GITHUB_ACTIONS_TOKEN = 'fixture';
    let calls = 0;
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response('{}', { status: 200 });
    });
    try {
      await db().query("DELETE FROM audit_log WHERE action='scraper.dispatch'");
      const results = await Promise.all([
        wakeScraper(),
        wakeScraper(),
        wakeScraper(),
      ]);
      assert.equal(results.filter((r) => r.dispatched).length, 1);
      assert.equal(calls, 1);
      assert.equal((await wakeScraper()).dispatched, false);
      assert.equal(calls, 1);
      await db().query("DELETE FROM audit_log WHERE action='scraper.dispatch'");
      fetch.mock.mockImplementation(
        async () => new Response('', { status: 403 }),
      );
      assert.equal((await wakeScraper()).dispatched, false);
      fetch.mock.mockImplementation(
        async () => new Response('{}', { status: 200 }),
      );
      assert.equal((await wakeScraper()).dispatched, true);
    } finally {
      await db().query("DELETE FROM audit_log WHERE action='scraper.dispatch'");
      fetch.mock.restore();
      if (token === undefined) delete process.env.GITHUB_ACTIONS_TOKEN;
      else process.env.GITHUB_ACTIONS_TOKEN = token;
      await db().end();
    }
  },
);
