import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { submitJob } from '../lib/server/job-submissions';
import { mutateJob, publicJobs } from '../lib/server/jobs';
import { placementDeadline } from '../lib/placement-deadline';

test('paid activation preserves the full term without reopening manually closed vacancies',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' }, async () => {
    const original = process.env.DATABASE_URL!;
    const url = new URL(original);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const schema = 'placement_deadline_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: original });
    await c.connect();
    process.env.SESSION_SECRET = 'local-placement-deadline-test-secret-over-32-characters';
    process.env.INVOICE_EMAIL_ENABLED = 'false';
    const day = (offset: number) => placementDeadline(undefined, new Date(Date.now() + offset * 86400000), 0);
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort())
        await c.query(readFileSync('db/migrations/' + file, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      await db().query('INSERT INTO billing_settings(payee_name,bank_name,iban) VALUES($1,$2,$3)',
        ['TEST ONLY recipient', 'TEST ONLY bank', 'GE98ZZ0000000000000000']);

      for (const scenario of ['pending', 'five', 'sixty', 'expired', 'archived-expired', 'manual-archive', 'manual-reject', 'rollback'] as const) {
        const placement = scenario === 'sixty' ? 'premium' : 'vip';
        const received = await submitJob({
          requestId: randomUUID(), placement, title: 'TEST deadline ' + scenario,
          company: 'TEST deadline company', category: 'ტექნოლოგიები', city: 'თბილისი',
          mode: 'ადგილზე', employmentType: 'სრული განაკვეთი',
          salaryFrom: '', salaryTo: '', salaryPeriod: 'თვე', deadline: day(5),
          description: 'Isolated local test vacancy for paid placement deadlines. No real vacancy or payment.',
          contact: 'test@example.com', notificationEmail: 'test@example.com',
          billingEmail: '', consent: true, fax: '',
        }, 'deadline-test-' + randomUUID());
        const read = async () => (await db().query('SELECT * FROM jobs WHERE id=$1', [received.id])).rows[0];
        const invoice = async () => (await db().query('SELECT * FROM job_invoices WHERE job_id=$1', [received.id])).rows[0];
        const act = async (action: string) => mutateJob({ id: received.id, version: (await read()).version, action });
        await act('confirm-payment');
        assert.equal((await invoice()).activated_at, null, 'payment alone does not activate');
        const oldDeadline = day(scenario === 'sixty' ? 60 : ['expired', 'archived-expired'].includes(scenario) ? -2 : 5);
        await db().query(`UPDATE jobs SET draft=jsonb_set(draft,'{deadline}',to_jsonb($2::text)),
          published=jsonb_set(draft,'{deadline}',to_jsonb($2::text)),status='published' WHERE id=$1`, [received.id, oldDeadline]);
        if (scenario === 'pending')
          await db().query("UPDATE jobs SET status='pending',published=NULL WHERE id=$1", [received.id]);
        if (scenario === 'archived-expired')
          await db().query("UPDATE jobs SET status='archived',published=NULL,automation_reason='expired' WHERE id=$1", [received.id]);

        if (scenario === 'manual-archive' || scenario === 'manual-reject') {
          await act(scenario === 'manual-archive' ? 'archive' : 'reject');
          await assert.rejects(act('publish'), /ჩარიცხვა/);
          assert.equal((await read()).status, scenario === 'manual-archive' ? 'archived' : 'rejected');
          assert.equal((await invoice()).activated_at, null);
          assert.equal((await publicJobs(new URLSearchParams({ ids: received.id }))).total, 0);
          continue;
        }

        const before = await read();
        if (scenario === 'rollback') {
          await assert.rejects(mutateJob({ id: received.id, version: before.version, action: 'publish' },
            undefined, async () => { throw Error('billing callback rollback'); }), /billing callback rollback/);
          assert.deepEqual(await read(), before);
          assert.equal((await invoice()).activated_at, null);
          assert.equal((await db().query("SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='placement.approved'", [received.id])).rows[0].n, 0);
          continue;
        }
        await act('publish');
        const after = await read();
        const inv = await invoice();
        const expected = placementDeadline(oldDeadline, inv.activated_at, 30);
        assert.equal(after.draft.deadline, expected);
        assert.equal(after.published.deadline, expected);
        assert.equal(after.status, 'published');
        assert.equal(after.version, before.version + 1, 'one moderation version increment');
        assert.equal(after.placement_expires_at.getTime() - inv.activated_at.getTime(), 30 * 86400000);
        assert.equal((await publicJobs(new URLSearchParams({ ids: received.id }))).total, 1, 'expired vacancy is publicly open again');
        const audit = (await db().query("SELECT after_data FROM audit_log WHERE job_id=$1 AND action='placement.approved'", [received.id])).rows;
        assert.equal(audit.length, 1);
        assert.equal(audit[0].after_data.deadline, expected);
        await act('publish');
        assert.equal((await read()).published.deadline, expected);
        assert.equal((await invoice()).activated_at.getTime(), inv.activated_at.getTime());
        assert.equal((await read()).placement_expires_at.getTime(), after.placement_expires_at.getTime());
      }
    } finally {
      await db().end();
      process.env.DATABASE_URL = original;
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    }
  });
