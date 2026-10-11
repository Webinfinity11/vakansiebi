import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { mutateJob } from '../lib/server/jobs';
import { purgeEnded } from '../worker/purge';
import { fingerprint } from '../worker/adapters';
import type { Vacancy } from '../lib/types';

const vacancy = (marker: string, deadline = ''): Vacancy => ({
  title: marker + ' მოლარე',
  company: 'ფიქსტურა',
  city: 'თბილისი',
  category: 'გაყიდვები',
  salary: '',
  salaryMin: null,
  currency: '',
  salaryPeriod: '',
  mode: '',
  description: 'ვაკანსიის ტექსტი, საკმარისად გრძელი გამოქვეყნებისთვის.',
  url: 'https://www.hr.ge/announcement/' + marker,
  source: 'hr.ge',
  deadline,
  datePosted: '',
  logoUrl: '',
  employmentType: '',
  facts: [],
  applicationLinks: [],
  warnings: [],
});

void test(
  'publishing untouched keeps a vacancy in automation; an edit takes it out; ended hand-managed ones are archived and an old archive is deleted',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const marker = 'PUBAUTO' + Date.now();
    const plain = randomUUID();
    const edited = randomUUID();
    const ended = randomUUID();
    const old = randomUUID();
    const ids = [plain, edited, ended, old];
    try {
      for (const id of [plain, edited]) {
        const v = vacancy(marker + id.slice(0, 4));
        await db().query(
          `INSERT INTO jobs(id,draft,status,fingerprint) VALUES($1,$2,'pending',$3)`,
          [id, v, fingerprint(v)],
        );
      }
      await mutateJob({ id: plain, version: 1, action: 'publish' });
      let row = (await db().query('SELECT * FROM jobs WHERE id=$1', [plain]))
        .rows[0];
      assert.equal(row.status, 'published');
      assert.equal(
        row.automation_paused,
        false,
        'a plain publish does not pause',
      );
      assert.equal(row.automation_managed, true, 'and hands it to automation');

      const draft = {
        ...vacancy(marker + edited.slice(0, 4)),
        title: 'შეცვლილი',
      };
      await mutateJob({ id: edited, version: 1, action: 'publish', draft });
      row = (await db().query('SELECT * FROM jobs WHERE id=$1', [edited]))
        .rows[0];
      assert.equal(row.automation_paused, true, 'an edited publish pauses');

      const past = vacancy(marker + 'e', '2020-01-01');
      await db().query(
        `INSERT INTO jobs(id,draft,published,status,fingerprint,automation_managed,automation_paused)
         VALUES($1,$2,$2,'published',$3,false,true)`,
        [ended, past, fingerprint(past)],
      );
      const gone = vacancy(marker + 'o');
      await db().query(
        `INSERT INTO jobs(id,draft,status,fingerprint,automation_managed,automation_paused,updated_at)
         VALUES($1,$2,'rejected',$3,false,true,now() - interval '40 days')`,
        [old, gone, fingerprint(gone)],
      );
      const result = await purgeEnded({ apply: true });
      assert.ok(result.archived >= 1);
      row = (await db().query('SELECT status FROM jobs WHERE id=$1', [ended]))
        .rows[0];
      assert.equal(
        row.status,
        'archived',
        'an ended hand-managed vacancy is archived',
      );
      assert.equal(
        (await db().query('SELECT 1 FROM jobs WHERE id=$1', [old])).rowCount,
        0,
        'a month-old rejection is deleted',
      );
    } finally {
      await db().query('DELETE FROM audit_log WHERE job_id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
