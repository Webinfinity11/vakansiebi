import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

void test(
  'Blob failure or missing token never blocks delivery; Swipe summaries count status, CV type, candidates and period boundaries',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const { sendSwipeApplication } = await import('../lib/server/swipe-apply');
    const { swipeSummary } = await import('../lib/server/analytics');
    const savedFetch = globalThis.fetch;
    const savedToken = process.env.BLOB_READ_WRITE_TOKEN;
    const savedTo = process.env.SWIPE_APPLY_TO;
    const jobs: string[] = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    let emails = 0;
    globalThis.fetch = async (input, init) => {
      assert.equal(
        input,
        'https://api.resend.com/emails',
        'no real Blob or email request may escape this test',
      );
      assert.equal(typeof init?.body, 'string');
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(body.to, ['delivered@resend.dev']);
      emails++;
      return Response.json({ id: randomUUID() });
    };
    try {
      process.env.SWIPE_APPLY_TO = 'delivered@resend.dev';
      for (const id of jobs)
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint) VALUES($1::uuid,$2,$2,'published',$3)",
          [
            id,
            {
              title: 'Swipe test',
              company: '',
              description: 'CV: jobs@example.com',
              facts: [],
              deadline: '2099-01-01',
            },
            id,
          ],
        );
      for (const id of jobs)
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id) VALUES($1,'hr',$2,'https://example.com',$1)",
          [id, id],
        );
      for (let index = 0; index < 2; index++) {
        if (index === 0)
          process.env.BLOB_READ_WRITE_TOKEN = 'invalid-test-token';
        else delete process.env.BLOB_READ_WRITE_TOKEN;
        const sent = await sendSwipeApplication(
          {
            job: jobs[index],
            name: 'Test',
            email: `${jobs[0]}@example.com`,
            phone: '',
            cv: { kind: 'upload', pdf: Buffer.from('%PDF-1.4 test') },
          },
          jobs[0],
        );
        const row = (
          await db().query(
            'SELECT status,cv_file FROM swipe_applications WHERE id=$1',
            [sent.id],
          )
        ).rows[0];
        assert.deepEqual(row, { status: 'sent', cv_file: null });
      }
      assert.equal(emails, 2);
      // Put fixtures in an isolated historic window, including one delayed delivery.
      await db().query(
        "UPDATE swipe_applications SET created_at='2001-01-01',sent_at='2001-01-03' WHERE job_id=ANY($1::uuid[])",
        [jobs],
      );
      await db().query(
        "UPDATE swipe_applications SET cv_kind='jobx' WHERE job_id=$1",
        [jobs[1]],
      );
      for (const [index, status, at] of [
        [2, 'failed', '2001-01-03'],
        [3, 'sent', '2001-01-04'],
      ] as const) {
        await db().query(
          `INSERT INTO swipe_applications(job_id,candidate_key,candidate_name,candidate_email,client_hash,cv_kind,recipient,status,created_at,sent_at)
      VALUES($1,$2,'Test','test@example.com',$2,'upload','delivered@resend.dev',$3,$4,$4)`,
          [jobs[index], 'a'.repeat(64), status, at],
        );
      }
      const summary = await swipeSummary(
        ['2001-01-03', '2001-01-04'],
        [
          { value: 'swipe_open', count: 9 },
          { value: 'swipe_skip', count: 4 },
        ],
      );
      assert.deepEqual(
        { ...summary, latest: [] },
        {
          opens: 9,
          skips: 4,
          sends: 2,
          candidates: 1,
          failed: 1,
          upload: 1,
          jobx: 1,
          latest: [],
        },
      );
      assert.equal(summary.latest.length, 2);
      assert.ok(
        summary.latest.every((row) => jobs.slice(0, 2).includes(row.jobId)),
      );
    } finally {
      globalThis.fetch = savedFetch;
      if (savedToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = savedToken;
      if (savedTo === undefined) delete process.env.SWIPE_APPLY_TO;
      else process.env.SWIPE_APPLY_TO = savedTo;
      await db().query(
        'DELETE FROM source_items WHERE job_id=ANY($1::uuid[])',
        [jobs],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [jobs]);
      await db().end();
    }
  },
);
