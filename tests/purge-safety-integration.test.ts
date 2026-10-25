import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { db } from '../lib/server/db';
import { purgeEnded } from '../worker/purge';
import { discoverItems, stageVacancy } from '../worker/importer';
import { pendingNewItemsSql } from '../worker/new-only';
import type { Vacancy } from '../lib/types';

void test(
  'bounded cleanup preserves business history, snapshots, locked records and import tombstones',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.equal(url.pathname, '/ertad_test');
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    const schema = 'purge_' + randomUUID().replaceAll('-', '');
    const admin = new Client({ connectionString: url.href });
    const pool = new Pool({
      connectionString: url.href,
      options: `-c search_path=${schema},public`,
    });
    const globals = globalThis as unknown as { ertadPool?: Pool };
    const previous = globals.ertadPool;
    await admin.connect();
    t.after(async () => {
      globals.ertadPool = previous;
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path=${schema},public`);
    for (const name of readdirSync('db/migrations')
      .filter((n) => n.endsWith('.sql'))
      .sort())
      await admin.query(readFileSync('db/migrations/' + name, 'utf8'));
    globals.ertadPool = pool;
    await db().query(
      "INSERT INTO sources(id,name) VALUES('hr','hr.ge') ON CONFLICT(id) DO NOTHING",
    );
    const raw = {
      title: 'უცვლელი ვაკანსია',
      company: 'Fixture',
      city: 'თბილისი',
      category: 'სხვა',
      description:
        'სრული ტექსტი: ხელფასი 1500 ლარი, სამუშაო პირობები და საკონტაქტო ინფორმაცია.',
      salary: '1500 ლარი',
      salaryMin: 1500,
      currency: 'GEL',
      salaryPeriod: 'თვე',
      mode: '',
      source: 'hr.ge',
      url: 'https://www.hr.ge/announcement/123/fixture',
      deadline: '2099-01-01',
      datePosted: new Date().toISOString().slice(0, 10),
    } satisfies Vacancy;
    const job = async (
      days: number,
      reason = 'expired',
      status = 'archived',
    ) => {
      const id = randomUUID();
      await db().query(
        `INSERT INTO jobs(id,draft,published,status,fingerprint,automation_managed,automation_reason,updated_at)
        VALUES($1::uuid,$2,$2,$3,$1::text,true,$4,now()-make_interval(days=>$5))`,
        [id, raw, status, reason, days],
      );
      return id;
    };
    const expired = await job(2);
    const removed = await job(8, 'removed');
    const unverified = await job(15, 'unverified');
    const editor = await job(31, 'manual', 'rejected');
    const fresh = await job(0);
    const active = await job(31, 'manual', 'published');
    const protectedIds: string[] = [];
    for (const status of ['sending', 'sent', 'failed']) {
      const id = await job(40);
      protectedIds.push(id);
      await db().query(
        `INSERT INTO swipe_applications(job_id,candidate_key,candidate_name,candidate_email,client_hash,cv_kind,recipient,status)
        VALUES($1,$2,'Fixture','candidate@example.com',$2,'upload','employer@example.com',$3)`,
        [id, 'a'.repeat(64), status],
      );
    }
    const submitted = await job(40);
    protectedIds.push(submitted);
    await db().query(
      `INSERT INTO job_submissions(request_id,job_id,client_hash,payload_hash) VALUES($1,$2,'fixture','fixture')`,
      [randomUUID(), submitted],
    );
    const invoiced = await job(40);
    protectedIds.push(invoiced);
    await db().query(
      `INSERT INTO job_invoices(id,token,job_id,amount_gel,service_days,payer_name,vacancy_title,payee_name,bank_name,iban)
      VALUES($1::uuid,$1::text,$2,10,30,'Fixture','Fixture','Fixture','Fixture','Fixture')`,
      [randomUUID(), invoiced],
    );
    for (const id of [expired, removed, unverified, editor]) {
      await db().query(
        `INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,next_check_at)
        VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,'infinity')`,
        [id, raw.url, raw],
      );
      await db().query(
        "INSERT INTO audit_log(job_id,action,actor,before_data,after_data) VALUES($1,'source.imported','fixture',NULL,$2)",
        [id, raw],
      );
    }
    const before = (
      await db().query(
        'SELECT id,draft,published FROM jobs WHERE id=ANY($1::uuid[]) ORDER BY id',
        [[fresh, active, ...protectedIds]],
      )
    ).rows;
    const dry = await purgeEnded();
    assert.deepEqual(
      [dry.expired, dry.removed, dry.unverified, dry.editor, dry.applied],
      [1, 1, 1, 1, false],
    );
    assert.equal(
      (await db().query('SELECT count(*)::int n FROM jobs')).rows[0].n,
      11,
    );
    await assert.rejects(
      purgeEnded({ apply: true, batchSize: 201 }),
      /batch size/,
    );

    // An editor holds the oldest record: the cleanup must skip it immediately.
    await admin.query('BEGIN');
    await admin.query('SELECT id FROM jobs WHERE id=$1 FOR UPDATE', [editor]);
    try {
      const first = await purgeEnded({ apply: true, batchSize: 2 });
      assert.equal(
        first.expired + first.removed + first.unverified + first.editor,
        2,
      );
      assert.equal(first.editor, 0);
      assert.equal(
        (await db().query('SELECT count(*)::int n FROM swipe_applications'))
          .rows[0].n,
        3,
      );
    } finally {
      await admin.query('ROLLBACK');
    }
    await purgeEnded({ apply: true, batchSize: 2 });
    const remaining = await purgeEnded();
    assert.equal(
      remaining.expired +
        remaining.removed +
        remaining.unverified +
        remaining.editor,
      0,
    );
    assert.deepEqual(
      (
        await db().query(
          'SELECT id,draft,published FROM jobs WHERE id=ANY($1::uuid[]) ORDER BY id',
          [[fresh, active, ...protectedIds]],
        )
      ).rows,
      before,
    );
    const tombstones = (
      await db().query('SELECT id,job_id,raw FROM source_items ORDER BY id')
    ).rows;
    assert.equal(tombstones.length, 4);
    assert.ok(tombstones.every((r) => r.job_id === null));
    for (const row of tombstones) {
      assert.deepEqual(
        row.raw,
        raw,
        'full original source content remains intact',
      );
      assert.equal(
        await discoverItems('hr', [{ externalId: row.id, url: raw.url }]),
        0,
      );
      assert.equal(
        await stageVacancy(row.id, raw),
        'unchanged',
        'a purged posting cannot return',
      );
    }
    assert.equal(
      (await db().query(pendingNewItemsSql('id'), ['hr', 200])).rowCount,
      0,
    );
    assert.equal(
      (await db().query('SELECT count(*)::int n FROM audit_log')).rows[0].n,
      0,
    );
    assert.equal(
      (await db().query('SELECT count(*)::int n FROM swipe_applications'))
        .rows[0].n,
      3,
    );
  },
);
