import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { submitJob } from '../lib/server/job-submissions';
import { mutateJob } from '../lib/server/jobs';
import { deliverPublicationEmails } from '../lib/server/publication-email';
import {
  employerContacts,
  saveEmployerContact,
} from '../lib/server/employer-contacts';
import { companyKey } from '../lib/company-key';
import { submissionDate } from '../lib/job-submission';

void test(
  'publication mail is private, transactional, once per job, retryable and visible in the own-employer list',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    assert.ok(
      ['localhost', '127.0.0.1'].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      ),
    );
    const company = 'MAILTEST' + randomUUID().replaceAll('-', '');
    const key = companyKey(company);
    const saved = {
      INVOICE_EMAIL_ENABLED: process.env.INVOICE_EMAIL_ENABLED,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      APP_URL: process.env.APP_URL,
    };
    process.env.SESSION_SECRET ||=
      'isolated-test-secret-with-more-than-32-characters';
    process.env.INVOICE_EMAIL_ENABLED = 'true';
    process.env.RESEND_API_KEY = 'not-a-real-key';
    process.env.APP_URL = 'https://jobx.ge';
    const ids: string[] = [];
    const fetchBefore = globalThis.fetch;
    let fail = true;
    const calls: { key: string; body: string }[] = [];
    globalThis.fetch = async (url, init) => {
      assert.equal(
        url instanceof Request ? url.url : url.toString(),
        'https://api.resend.com/emails',
        'No real external requests in this test',
      );
      calls.push({
        key: new Headers(init?.headers).get('Idempotency-Key') || '',
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return Response.json(
        fail ? { message: 'temporary' } : { id: 'mock-provider-id' },
        { status: fail ? 500 : 200 },
      );
    };
    const base = {
      placement: 'standard',
      title: 'ბარისტა-მოლარე',
      company,
      city: 'თბილისი',
      mode: 'ადგილზე',
      employmentType: 'სრული განაკვეთი',
      salaryFrom: '',
      salaryTo: '',
      salaryPeriod: 'თვე',
      deadline: submissionDate(new Date(Date.now() + 30 * 86400000)),
      description:
        'ვეძებთ თანამშრომელს მომხმარებლებთან ურთიერთობისა და პროდუქციის გაყიდვის მიმართულებით.',
      contact: '+995 555 12 34 56',
      notificationEmail: 'private-owner@example.com',
      consent: true,
    };
    async function create() {
      const result = await submitJob(
        { ...base, requestId: randomUUID() },
        randomUUID(),
      );
      ids.push(result.id);
      return result.id;
    }
    async function action(id: string, action: string, extra = {}) {
      const row = (
        await db().query('SELECT version,draft FROM jobs WHERE id=$1', [id])
      ).rows[0];
      return mutateJob({
        id,
        version: row.version,
        action,
        ...(action === 'save' ? { draft: row.draft } : {}),
        ...extra,
      });
    }
    async function delivery(id: string) {
      return (
        await db().query(
          'SELECT * FROM publication_email_delivery WHERE job_id=$1',
          [id],
        )
      ).rows[0];
    }
    try {
      await assert.rejects(
        submitJob(
          { ...base, requestId: randomUUID(), notificationEmail: '' },
          company,
        ),
      );
      const id = await create();
      assert.equal(await delivery(id), undefined);
      const draft = (
        await db().query('SELECT draft FROM jobs WHERE id=$1', [id])
      ).rows[0].draft;
      assert.equal(
        JSON.stringify(draft).includes(base.notificationEmail),
        false,
      );
      assert.equal((await action(id, 'publish')).publicationEmailQueued, true);
      const original = await delivery(id);
      assert.deepEqual(original.payload.to, [base.notificationEmail]);
      assert.equal((await action(id, 'publish')).publicationEmailQueued, false);
      await action(id, 'save');
      assert.deepEqual((await delivery(id)).payload, original.payload);
      assert.equal(
        calls.length,
        0,
        'No network sends from the moderation transaction',
      );
      assert.equal((await deliverPublicationEmails(id)).failed, 1);
      assert.equal((await delivery(id)).status, 'pending');
      await db().query(
        'UPDATE publication_email_delivery SET next_attempt_at=now() WHERE job_id=$1',
        [id],
      );
      fail = false;
      const deliveries = await Promise.all([
        deliverPublicationEmails(id),
        deliverPublicationEmails(id),
      ]);
      assert.equal(
        deliveries.reduce((n, d) => n + d.sent, 0),
        1,
      );
      assert.equal((await delivery(id)).status, 'sent');
      await deliverPublicationEmails(id);
      assert.equal(calls.length, 2);
      assert.deepEqual(
        calls[0],
        calls[1],
        'Retries preserve the immutable provider payload and key',
      );
      assert.equal(calls[0].key, `jobx-publication/${id}`);

      const cancelled = await create();
      await action(cancelled, 'publish');
      await action(cancelled, 'archive');
      await deliverPublicationEmails(cancelled);
      assert.equal((await delivery(cancelled)).status, 'cancelled');
      assert.equal(calls.length, 2);

      const markedTest = await create();
      await db().query(
        'UPDATE job_submissions SET is_test=true WHERE job_id=$1',
        [markedTest],
      );
      assert.equal(
        (await action(markedTest, 'publish')).publicationEmailQueued,
        false,
      );
      assert.equal(await delivery(markedTest), undefined);

      const legacy = await create();
      await db().query(
        'UPDATE job_submissions SET notification_email=NULL WHERE job_id=$1',
        [legacy],
      );
      await assert.rejects(action(legacy, 'publish'), /ელფოსტა/);
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [legacy]))
          .rows[0].status,
        'pending',
      );
      assert.equal(await delivery(legacy), undefined);
      await action(legacy, 'publish', {
        notificationEmail: 'legacy-owner@example.com',
      });
      await db().query(
        "UPDATE publication_email_delivery SET first_attempt_at=now()-interval '24 hours' WHERE job_id=$1",
        [legacy],
      );
      await deliverPublicationEmails(legacy);
      assert.equal((await delivery(legacy)).status, 'failed');
      assert.equal(calls.length, 2, 'Expired idempotency windows never resend');

      const historical = await create();
      await db().query(
        "UPDATE jobs SET published_at=now()-interval '1 day' WHERE id=$1",
        [historical],
      );
      assert.equal(
        (await action(historical, 'publish')).publicationEmailQueued,
        false,
      );
      assert.equal(
        await delivery(historical),
        undefined,
        'No retrospective mail for historical re-publication',
      );

      let record = (await employerContacts()).find((e) => e.key === key)!;
      assert.ok(record);
      assert.equal(record.jobs.length, 4, 'Test submissions are excluded');
      assert.ok(record.emails.includes(base.notificationEmail));
      assert.ok(record.phones.includes('+995555123456'));
      assert.equal(record.jobs.find((j) => j.id === id)!.emailStatus, 'sent');
      assert.equal(record.version, 0);
      const note = await saveEmployerContact({
        key,
        version: 0,
        notes: 'სატესტო შენიშვნა',
        contacted: true,
      });
      assert.equal(note.version, 1);
      assert.ok(note.lastContactedAt);
      await assert.rejects(
        saveEmployerContact({ key, version: 0, notes: 'overwrite' }),
        /ჩანაწერი შეიცვალა/,
      );
      const next = await saveEmployerContact({
        key,
        version: 1,
        notes: 'განახლებული შენიშვნა',
      });
      assert.equal(next.lastContactedAt, note.lastContactedAt);
      await assert.rejects(
        saveEmployerContact({ key: randomUUID(), version: 0, notes: '' }),
        /ვერ მოიძებნა/,
      );
      await assert.rejects(
        saveEmployerContact({ key, version: 2, notes: 'x'.repeat(4001) }),
      );
      record = (await employerContacts()).find((e) => e.key === key)!;
      assert.equal(record.notes, next.notes);
      process.env.INVOICE_EMAIL_ENABLED = 'false';
      assert.equal((await deliverPublicationEmails()).disabled, true);
    } finally {
      globalThis.fetch = fetchBefore;
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await db().query(
        'DELETE FROM employer_contact_notes WHERE company_key=$1',
        [key],
      );
      await db().query(
        'DELETE FROM job_submissions WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
      await db().query('DELETE FROM audit_log WHERE job_id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query(
        'DELETE FROM source_items WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
