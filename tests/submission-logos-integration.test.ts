import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { db } from '../lib/server/db';

void test(
  'logos deduplicate, survive retries, stay private until moderation and can be removed',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const connection = new URL(process.env.DATABASE_URL!);
    assert.equal(connection.pathname, '/ertad_test');
    assert.ok(['127.0.0.1', 'localhost'].includes(connection.hostname));
    const require = createRequire(import.meta.url);
    const headersModule = require('next/headers');
    const previousCookies = headersModule.cookies;
    let cookie: string | undefined;
    headersModule.cookies = async () => ({
      get: () => (cookie ? { value: cookie } : undefined),
    });
    const { submitJob } = await import('../lib/server/job-submissions');
    const { submissionDate, submissionSchema } =
      await import('../lib/job-submission');
    const yesterday = submissionDate(new Date(Date.now() - 86400000));
    const { mutateJob, publicJobs } = await import('../lib/server/jobs');
    const { sessionToken } = await import('../lib/server/auth');
    const { GET } = await import('../app/api/logos/[hash]/route');
    const { POST } = await import('../app/api/submissions/route');
    const { companyKey } = await import('../lib/company-key');
    const { saveCompany } = await import('../lib/server/companies');
    process.env.SESSION_SECRET ||=
      'isolated-submission-logo-test-secret-32-characters';
    const key = 'LOGOTEST' + randomUUID().replaceAll('-', '');
    const bytes = await sharp({
      create: {
        width: 24,
        height: 24,
        channels: 3,
        background: '#' + randomUUID().replaceAll('-', '').slice(0, 6),
      },
    })
      .png()
      .toBuffer();
    const base = {
      requestId: randomUUID(),
      title: 'ლოგოს საცდელი ვაკანსია',
      company: key,
      city: 'თბილისი',
      mode: 'ადგილზე',
      employmentType: 'სრული განაკვეთი',
      salaryFrom: '',
      salaryTo: '',
      salaryPeriod: 'თვე',
      deadline: submissionDate(new Date(Date.now() + 86400000 * 30)),
      description:
        'მომხმარებლის მომსახურება და კონსულტაცია სამუშაო დღეებში. გამოცდილება სასურველია.',
      contact: 'hr@example.com',
      consent: true,
      logo: `data:image/png;base64,${bytes.toString('base64')}`,
    };
    const ids: string[] = [];
    let hash = '';
    const getLogo = (path: string) =>
      GET(new Request(`https://jobx.ge${path}`), {
        params: Promise.resolve({ hash }),
      });
    try {
      const results = await Promise.all([
        submitJob(base, key),
        submitJob(base, key),
      ]);
      ids.push(results[0].id);
      assert.equal(results[0].id, results[1].id);
      let row = (await db().query('SELECT * FROM jobs WHERE id=$1', [ids[0]]))
        .rows[0];
      const url = row.draft.logoUrl;
      hash = url.split('/').pop();
      assert.match(hash, /^[a-f0-9]{64}$/);
      assert.equal(
        (
          await db().query(
            'SELECT count(*)::int n FROM submission_logos WHERE hash=$1',
            [hash],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db().query(
            'SELECT payload_hash FROM job_submissions WHERE job_id=$1',
            [ids[0]],
          )
        ).rows[0].payload_hash,
        createHash('sha256')
          .update(JSON.stringify(submissionSchema.parse(base)))
          .digest('hex'),
      );
      assert.equal(
        (
          await db().query(
            'SELECT 1 FROM company_profiles WHERE company_key=$1',
            [companyKey(key)],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await publicJobs(new URLSearchParams({ ids: ids[0] }))).total,
        0,
      );
      assert.equal((await getLogo(url)).status, 404);
      cookie = sessionToken();
      const preview = await getLogo(url);
      assert.equal(preview.status, 200);
      assert.equal(preview.headers.get('Cache-Control'), 'private, no-store');
      cookie = undefined;
      await assert.rejects(
        saveCompany({
          name: key,
          logoUrl: url,
          website: '',
          description: '',
          version: 0,
        }),
        /ჯერ/,
      );
      const changed = await submitJob({ ...base, logo: '' }, key);
      assert.equal(changed.id, ids[0]);
      assert.equal(
        (await db().query('SELECT draft FROM jobs WHERE id=$1', [ids[0]]))
          .rows[0].draft.logoUrl,
        url,
      );
      const origin = new URL(process.env.APP_URL || 'https://jobx.ge').origin;
      const retry = await POST(
        new Request(`${origin}/api/submissions`, {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, deadline: yesterday }),
        }),
      );
      assert.equal(retry.status, 200);
      const invalidRetry = await POST(
        new Request(`${origin}/api/submissions`, {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...base,
            deadline: yesterday,
            logo: 'data:image/png;base64,PHN2Zy8+',
          }),
        }),
      );
      assert.equal(invalidRetry.status, 400);
      const second = await submitJob({ ...base, requestId: randomUUID() }, key);
      ids.push(second.id);
      assert.equal(
        (
          await db().query(
            'SELECT count(*)::int n FROM submission_logos WHERE hash=$1',
            [hash],
          )
        ).rows[0].n,
        1,
      );
      // A missing upload rejects publication and rolls back placement changes
      // from the same transaction, without approving the original private logo.
      const missingLogo =
        '/api/logos/' + createHash('sha256').update(randomUUID()).digest('hex');
      await assert.rejects(
        mutateJob({
          id: ids[0],
          version: row.version,
          action: 'publish',
          placement: 'vip',
          draft: { ...row.draft, logoUrl: missingLogo },
        }),
        /ლოგო ვერ მოიძებნა/,
      );
      assert.deepEqual(
        (await db().query('SELECT * FROM jobs WHERE id=$1', [ids[0]])).rows[0],
        row,
      );
      assert.equal(
        (
          await db().query(
            'SELECT bonus_company_key FROM job_submissions WHERE job_id=$1',
            [ids[0]],
          )
        ).rows[0].bonus_company_key,
        null,
      );
      assert.equal(
        (
          await db().query(
            'SELECT approved_at FROM submission_logos WHERE hash=$1',
            [hash],
          )
        ).rows[0].approved_at,
        null,
      );
      assert.equal((await getLogo(url)).status, 404);
      await mutateJob({
        id: ids[0],
        version: row.version,
        action: 'publish',
        placement: 'standard',
      });
      row = (await db().query('SELECT * FROM jobs WHERE id=$1', [ids[0]]))
        .rows[0];
      assert.equal(
        (
          await db().query(
            'SELECT logo_url FROM company_profiles WHERE company_key=$1',
            [companyKey(key)],
          )
        ).rows[0].logo_url,
        url,
      );
      assert.equal(
        (await publicJobs(new URLSearchParams({ ids: ids[0] }))).jobs[0]
          .logoUrl,
        url,
      );
      const publicLogo = await getLogo(url);
      assert.equal(publicLogo.status, 200);
      assert.equal(
        publicLogo.headers.get('Cache-Control'),
        'public, max-age=31536000, immutable',
      );
      assert.equal(publicLogo.headers.get('Content-Type'), 'image/png');
      assert.equal(publicLogo.headers.get('X-Content-Type-Options'), 'nosniff');
      assert.equal(
        createHash('sha256')
          .update(Buffer.from(await publicLogo.arrayBuffer()))
          .digest('hex'),
        hash,
      );
      assert.equal((await getLogo(`${url}?x=1`)).status, 404);
      // Saving a draft removal leaves the public logo alone. Publication must
      // compare against the previous published logo, not the already-edited draft.
      await mutateJob({
        id: ids[0],
        version: row.version,
        action: 'save',
        draft: { ...row.draft, logoUrl: '' },
      });
      row = (await db().query('SELECT * FROM jobs WHERE id=$1', [ids[0]]))
        .rows[0];
      assert.equal(row.published.logoUrl, url);
      assert.equal(
        (
          await db().query(
            'SELECT logo_url FROM company_profiles WHERE company_key=$1',
            [companyKey(key)],
          )
        ).rows[0].logo_url,
        url,
      );
      await mutateJob({
        id: ids[0],
        version: row.version,
        action: 'publish',
        placement: 'standard',
      });
      assert.equal(
        (
          await db().query(
            'SELECT logo_url FROM company_profiles WHERE company_key=$1',
            [companyKey(key)],
          )
        ).rows[0].logo_url,
        '',
      );
      assert.equal(
        (await publicJobs(new URLSearchParams({ ids: ids[0] }))).jobs[0]
          .logoUrl,
        '',
      );
    } finally {
      headersModule.cookies = previousCookies;
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
      await db().query('DELETE FROM company_profiles WHERE company_key=$1', [
        companyKey(key),
      ]);
      if (hash)
        await db().query('DELETE FROM submission_logos WHERE hash=$1', [hash]);
      await db().end();
    }
  },
);
