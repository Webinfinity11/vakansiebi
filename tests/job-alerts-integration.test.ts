import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import {
  requestJobAlert,
  manageJobAlert,
  prepareJobDigests,
  deliverJobAlerts,
} from '../lib/server/job-alerts';
import { readSearch } from '../lib/search-state';
import { alertToken } from '../lib/job-alerts';

void test(
  'confirmed alerts obey filters, deduplicate vacancies, retry once and cancel safely',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const pool = db();
    const email = `alert-${randomUUID()}@example.invalid`;
    const company = 'ALERTTEST' + randomUUID().replaceAll('-', '');
    const settings = {
      JOB_ALERTS_ENABLED: 'true',
      RESEND_API_KEY: 'not-a-real-key',
      SESSION_SECRET: 'alert-integration-signing-secret-for-tests-only',
      APP_URL: 'https://jobx.ge',
    };
    const filters = readSearch(
      new URLSearchParams({
        q: company,
        city: 'tbilisi',
        paid: 'true',
        salaryFrom: '1000',
      }),
    );
    const ids: string[] = [];
    let subscriptionId = '';
    const sent: { key: string; body: string }[] = [];
    let fail = true;
    const request: typeof fetch = async (_url, init) => {
      sent.push({
        key: new Headers(init?.headers).get('Idempotency-Key') || '',
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return Response.json(fail ? {} : { id: 'provider-fixture' }, {
        status: fail ? 503 : 200,
      });
    };
    try {
      const deliveryId = await requestJobAlert(email, filters, pool, settings);
      assert.ok(deliveryId);
      const row = (
        await pool.query(
          'SELECT * FROM job_alert_subscriptions WHERE email=$1',
          [email],
        )
      ).rows[0];
      subscriptionId = row.id;
      assert.equal(
        await requestJobAlert(email, filters, pool, settings),
        null,
        'repeat requests do not send more mail',
      );
      assert.equal(
        (await prepareJobDigests({ pool, settings, subscriptionId })).prepared,
        0,
      );
      assert.equal(
        (
          await deliverJobAlerts({
            pool,
            settings,
            request,
            id: deliveryId!,
            limit: 1,
          })
        ).failed,
        1,
      );
      await pool.query(
        "UPDATE job_alert_deliveries SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
        [deliveryId],
      );
      fail = false;
      assert.equal(
        (
          await deliverJobAlerts({
            pool,
            settings,
            request,
            id: deliveryId!,
            limit: 1,
          })
        ).sent,
        1,
      );
      assert.equal(sent[0].key, sent[1].key);
      assert.equal(sent[0].body, sent[1].body);
      const token = alertToken(
        row.id,
        row.nonce,
        'confirm',
        settings.SESSION_SECRET,
        Date.now() + 86400000,
      );
      assert.ok(await manageJobAlert(token, 'confirm', pool, settings));
      assert.ok(await manageJobAlert(token, 'confirm', pool, settings));
      await pool.query(
        "UPDATE job_alert_subscriptions SET cursor_at=now()-interval '1 hour',next_digest_at=now()-interval '1 minute' WHERE id=$1",
        [row.id],
      );
      for (const [title, city, salary, publishedAt] of [
        ['მოლარე', 'თბილისი', 1200, 'now()'],
        ['მოლარე', 'თბილისი', 1200, 'now()'],
        ['ძველი', 'თბილისი', 1500, "now()-interval '2 days'"],
        ['დაბალი ხელფასი', 'თბილისი', 500, 'now()'],
        ['სხვა ქალაქი', 'ბათუმი', 1400, 'now()'],
      ] as const) {
        const id = randomUUID();
        ids.push(id);
        const vacancy = {
          title,
          company,
          city,
          category: 'მომსახურება',
          salary: `${salary} ლარი`,
          salaryMin: salary,
          currency: 'GEL',
          salaryPeriod: 'თვე',
          mode: '',
          description:
            'ვეძებთ თანამშრომელს ჩვენს გუნდში. სამუშაო ადგილი მითითებულ ქალაქშია.',
          url: `https://www.hr.ge/announcement/${id}/test`,
          source: 'hr.ge',
          deadline: '2099-01-01',
          datePosted: new Date().toISOString().slice(0, 10),
        };
        await pool.query(
          `INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,${publishedAt})`,
          [id, vacancy],
        );
        await pool.query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now())",
          [id, vacancy.url, vacancy],
        );
      }
      assert.equal(
        (await prepareJobDigests({ pool, settings, subscriptionId })).prepared,
        1,
      );
      const digest = (
        await pool.query(
          "SELECT * FROM job_alert_deliveries WHERE subscription_id=$1 AND kind='digest'",
          [row.id],
        )
      ).rows[0];
      assert.match(digest.payload.subject, /1 ახალი ვაკანსია/);
      assert.ok(!digest.payload.text.includes('დაბალი ხელფასი'));
      assert.ok(!digest.payload.text.includes('სხვა ქალაქი'));
      assert.ok(!digest.payload.text.includes('ძველი'));
      await pool.query(
        "UPDATE job_alert_subscriptions SET cursor_at=now()-interval '1 hour',next_digest_at=now()-interval '1 minute' WHERE id=$1",
        [row.id],
      );
      assert.equal(
        (await prepareJobDigests({ pool, settings, subscriptionId })).prepared,
        0,
        'grouped vacancy is never queued again',
      );
      const cancel = alertToken(
        row.id,
        row.nonce,
        'unsubscribe',
        settings.SESSION_SECRET,
      );
      assert.ok(await manageJobAlert(cancel, 'unsubscribe', pool, settings));
      assert.equal(
        (await deliverJobAlerts({ pool, settings, request, id: digest.id }))
          .sent,
        0,
      );
      assert.equal(
        await manageJobAlert(token, 'confirm', pool, settings),
        false,
        'old confirmation cannot reactivate an unsubscribe',
      );
      assert.equal(
        (
          await pool.query(
            'SELECT status FROM job_alert_deliveries WHERE id=$1',
            [digest.id],
          )
        ).rows[0].status,
        'cancelled',
      );
    } finally {
      if (subscriptionId)
        await pool.query('DELETE FROM job_alert_subscriptions WHERE id=$1', [
          subscriptionId,
        ]);
      await pool.query(
        'DELETE FROM source_items WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
      await pool.query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await pool.end();
    }
  },
);
