import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  authoredReply,
  explicitRemoval,
  readRemovalToken,
  removalToken,
  removalSender,
  verifyRemovalWebhook,
} from '../lib/employer-opt-out';

import {
  removalCompanyNames,
  removalCompanyKeys,
} from '../lib/employer-removal-input';

void test('company removal preserves commas and only separates new lines', () => {
  assert.deepEqual(
    removalCompanyNames('  ლიბერთი, ბაზისბანკ ჯგუფი\r\n\n სხვა კომპანია  '),
    ['ლიბერთი, ბაზისბანკ ჯგუფი', 'სხვა კომპანია'],
  );
  assert.deepEqual(
    removalCompanyKeys(['შ.პ.ს. Example']),
    removalCompanyKeys(['Example']),
  );
  assert.deepEqual(removalCompanyKeys(['ა']), []);
});

void test('an address inside a display name cannot impersonate the real sender', () => {
  assert.equal(
    removalSender('Company <OWNER@example.com>'),
    'owner@example.com',
  );
  assert.equal(
    removalSender('"owner@example.com" <attacker@evil.com>'),
    'attacker@evil.com',
  );
  assert.equal(
    removalSender('owner@example.com <attacker@evil.com>'),
    'attacker@evil.com',
  );
  assert.equal(removalSender('not an email'), null);
});

void test('removal links are recipient/job scoped, signed and expire; reading them changes nothing', () => {
  const before = process.env.REMOVAL_LINK_SECRET;
  process.env.REMOVAL_LINK_SECRET =
    'removal-test-secret-with-more-than-32-characters';
  try {
    const job = randomUUID();
    const now = Date.now();
    const token = removalToken(job, 'OWNER@example.com', now)!;
    assert.equal(readRemovalToken(token, now)?.job, job);
    assert.equal(readRemovalToken(token, now)?.email, 'owner@example.com');
    assert.equal(readRemovalToken(`${token}x`, now), null);
    assert.equal(readRemovalToken(token, now + 181 * 86400000), null);
    const [body, sig] = token.split('.');
    const altered = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body, 'base64url').toString()),
        email: 'attacker@example.com',
      }),
    ).toString('base64url');
    assert.equal(readRemovalToken(`${altered}.${sig}`, now), null);
  } finally {
    if (before === undefined) delete process.env.REMOVAL_LINK_SECRET;
    else process.env.REMOVAL_LINK_SECRET = before;
  }
});

void test('only explicit new instructions opt out; quoted footers and negated removals do not', () => {
  for (const text of [
    'წაშალეთ, როცა სხვა წყაროს იყენებთ თანხმობა უნდა აიღოთ',
    'ამოიღეთ ჩვენი ვაკანსია',
    'აღარ განათავსოთ ჩვენი ვაკანსიები',
    'არ მსურს ვაკანსიის განთავსება',
    'unsubscribe',
    'Please remove our job listing',
  ])
    assert.equal(explicitRemoval(text), true, text);
  for (const text of [
    'გმადლობთ',
    'არ წაშალოთ ჩვენი ვაკანსია',
    'Please do not remove our listing',
    'Thanks\nOn Thu, Company wrote:\nunsubscribe',
    'გამარჯობა\n> წაშალეთ',
    'სხვა კითხვა მაქვს\n---------- Forwarded message ---------\nწაშალეთ',
  ])
    assert.equal(explicitRemoval(text), false, text);
  assert.equal(
    authoredReply('წაშალეთ\n\nOn Thu, JOBX wrote:\nold content'),
    'წაშალეთ',
  );
});

void test('receiving webhook rejects unsigned, edited and replayed payloads', () => {
  const secret = randomBytes(32);
  const now = Date.now();
  const stamp = String(Math.floor(now / 1000));
  const id = 'msg_test';
  const body = '{"type":"email.received"}';
  const signature = createHmac('sha256', secret)
    .update(`${id}.${stamp}.${body}`)
    .digest('base64');
  const headers = new Headers({
    'svix-id': id,
    'svix-timestamp': stamp,
    'svix-signature': `v1,${signature}`,
  });
  const key = `whsec_${secret.toString('base64')}`;
  assert.equal(verifyRemovalWebhook(body, headers, key, now), true);
  assert.equal(verifyRemovalWebhook(body + ' ', headers, key, now), false);
  assert.equal(verifyRemovalWebhook(body, headers, key, now + 301000), false);
  assert.equal(verifyRemovalWebhook(body, new Headers(), key, now), false);
});

void test(
  'authenticated withdrawal removes all employer listings, blocks reimports and queues one real confirmation',
  {
    skip: process.env.RUN_DB_TESTS !== '1',
  },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const { recordRemovalRequest, deliverRemovalConfirmations } =
      await import('../lib/server/removal-requests');
    const { releaseEmployer, previewEmployerRemoval } =
      await import('../lib/server/employer-removals');
    const { mutateJob } = await import('../lib/server/jobs');
    const tag = randomUUID();
    const email = `remove-${tag}@example.com`;
    const company = `Removal Test, ${tag}`;
    const jobs: string[] = [];
    let requestId: string | undefined;
    let ruleId: string | undefined;
    const oldFetch = globalThis.fetch,
      oldKey = process.env.RESEND_API_KEY;
    let sent = 0;
    async function add(name = company, contact = email) {
      const id = randomUUID();
      jobs.push(id);
      const vacancy = {
        title: 'Removal fixture',
        company: name,
        description: `Apply: ${contact}`,
        url: `https://www.hr.ge/announcement/${id}`,
        deadline: '2099-01-01',
        facts: [],
      };
      await db().query(
        "INSERT INTO jobs(id,draft,published,status,fingerprint) VALUES($1::uuid,$2,$2,'published',$1::text)",
        [id, vacancy],
      );
      return id;
    }
    try {
      const a = await add();
      const b = await add(company, 'other@example.com');
      const safe = await add(`Unrelated ${tag}`, `${email}.evil`);
      const legal = await add(`შ.პ.ს ${company}`, 'legal@example.com');
      const draftOnly = await add(company, 'draft@example.com');
      await db().query(
        "UPDATE jobs SET published=NULL,status='pending' WHERE id=$1",
        [draftOnly],
      );
      const publishedOnly = await add(company, 'published@example.com');
      await db().query(
        "UPDATE jobs SET draft=jsonb_set(draft,'{company}',to_jsonb($2::text)) WHERE id=$1",
        [publishedOnly, `Different ${tag}`],
      );
      const preview = await previewEmployerRemoval({
        companyNames: removalCompanyNames(company),
      });
      assert.equal(preview.total, 5);
      assert.equal(preview.published, 4);
      assert.deepEqual(
        preview.companies.map((r) => r.name).sort(),
        [company, `შ.პ.ს ${company}`].sort(),
      );
      assert.equal(
        (await previewEmployerRemoval({ companyNames: [`No match ${tag}`] }))
          .total,
        0,
      );
      assert.equal(
        (await previewEmployerRemoval({ email })).total,
        1,
        'email suffix must not match in preview',
      );
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [a])).rows[0]
          .status,
        'published',
        'preview is read-only',
      );
      const sourceId = `test:${tag}`;
      const input = {
        sourceId,
        sender: email,
        source: 'email' as const,
        text: 'წაშალეთ ჩვენი ვაკანსიები',
        authenticated: true,
      };
      const result = await recordRemovalRequest(input);
      requestId = result.id;
      const rows = (
        await db().query(
          'SELECT id,status,published,automation_paused,employer_suppression_id FROM jobs WHERE id=ANY($1)',
          [[a, b, safe, legal, draftOnly, publishedOnly]],
        )
      ).rows;
      for (const id of [a, b, legal, draftOnly, publishedOnly]) {
        const row = rows.find((r) => r.id === id);
        assert.equal(row.status, 'rejected');
        assert.equal(row.published, null);
        assert.equal(row.automation_paused, true);
        ruleId = row.employer_suppression_id;
      }
      assert.equal(
        rows.find((r) => r.id === safe).status,
        'published',
        'email suffix must not match',
      );
      const imported = await add('Another spelling', email);
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [imported]))
          .rows[0].status,
        'rejected',
      );
      const renamed = await add(company, 'new-contact@example.com');
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [renamed]))
          .rows[0].status,
        'rejected',
      );
      const legalAlias = await add(
        `შ.პ.ს ${company}`,
        'legal-alias@example.com',
      );
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [legalAlias]))
          .rows[0].status,
        'rejected',
        'legal form changes must not bypass suppression',
      );
      const row = (
        await db().query('SELECT version FROM jobs WHERE id=$1', [a])
      ).rows[0];
      await assert.rejects(
        () => mutateJob({ id: a, version: row.version, action: 'publish' }),
        /ბლოკირება/,
      );
      await db().query(
        "UPDATE jobs SET status='published',published=draft,automation_paused=false WHERE id=$1",
        [a],
      );
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [a])).rows[0]
          .status,
        'rejected',
        'older publishers cannot bypass DB protection',
      );
      process.env.RESEND_API_KEY = 'test-only-key';
      globalThis.fetch = async (input, init) => {
        assert.equal(input, 'https://api.resend.com/emails');
        assert.equal(typeof init?.body, 'string');
        const payload = JSON.parse(init?.body as string);
        assert.deepEqual(payload.to, [email]);
        assert.ok(payload.text.includes('ამოღებულია'));
        assert.equal(
          (
            await db().query(
              "SELECT count(*)::int n FROM jobs WHERE employer_suppression_id=$1 AND status='published'",
              [ruleId],
            )
          ).rows[0].n,
          0,
        );
        sent++;
        return Response.json({ id: randomUUID() });
      };
      await deliverRemovalConfirmations(requestId);
      assert.equal((await recordRemovalRequest(input)).id, requestId);
      await deliverRemovalConfirmations(requestId);
      assert.equal(
        sent,
        1,
        'duplicate mail or webhook does not duplicate confirmation',
      );
      await releaseEmployer(ruleId!);
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [a])).rows[0]
          .status,
        'rejected',
        'release never republishes old jobs',
      );
      const future = await add();
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [future]))
          .rows[0].status,
        'published',
      );
      const forged = await recordRemovalRequest({
        sourceId: `untrusted:${tag}`,
        sender: email,
        source: 'email',
        text: 'წაშალეთ',
        authenticated: false,
      });
      assert.equal(
        (
          await db().query(
            'SELECT status FROM employer_removal_requests WHERE id=$1',
            [forged.id],
          )
        ).rows[0].status,
        'review',
      );
      await db().query('DELETE FROM employer_removal_requests WHERE id=$1', [
        forged.id,
      ]);
      const subjectRequest = await recordRemovalRequest({
        sourceId: `subject:${tag}`,
        sender: email,
        source: 'email',
        subject: 'unsubscribe',
        text: '',
        authenticated: true,
      });
      assert.equal(
        (
          await db().query(
            'SELECT status FROM employer_removal_requests WHERE id=$1',
            [subjectRequest.id],
          )
        ).rows[0].status,
        'removed',
      );
      const contrary = await recordRemovalRequest({
        sourceId: `contrary:${tag}`,
        sender: email,
        source: 'email',
        subject: 'unsubscribe',
        text: 'Please do not remove our listing',
        authenticated: true,
      });
      const contraryRow = (
        await db().query(
          'SELECT status,confirmation_status FROM employer_removal_requests WHERE id=$1',
          [contrary.id],
        )
      ).rows[0];
      assert.equal(contraryRow.status, 'review');
      assert.equal(contraryRow.confirmation_status, null);
    } finally {
      globalThis.fetch = oldFetch;
      if (oldKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = oldKey;
      await db().query(
        'DELETE FROM employer_removal_requests WHERE sender=$1',
        [email],
      );
      await db().query('DELETE FROM removed_vacancies WHERE job_id=ANY($1)', [
        jobs,
      ]);
      await db().query(
        "DELETE FROM audit_log WHERE job_id=ANY($1) OR after_data->>'email'=$2 OR after_data->>'id'=$3",
        [jobs, email, ruleId || ''],
      );
      await db().query(
        'DELETE FROM google_indexing_queue WHERE job_id=ANY($1)',
        [jobs],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1)', [jobs]);
      await db().query('DELETE FROM employer_suppressions WHERE email=$1', [
        email,
      ]);
      await db().end();
    }
  },
);
