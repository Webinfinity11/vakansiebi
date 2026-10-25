import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { db } from '../lib/server/db';
import { publicJobs, clearPublicJobsCache } from '../lib/server/jobs';
import { refreshLandingCounts } from '../worker/landing-counts';
import { eligibleLandings } from '../lib/seo-landing';

void test(
  'profession conditions count the actual title matches and never widen an empty reviewed role',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'keywords_' + randomUUID().replaceAll('-', '');
    const admin = new Client({ connectionString: url.href });
    const pool = new Pool({
      connectionString: url.href,
      options: `-c search_path=${schema},public`,
    });
    const globals = globalThis as unknown as { ertadPool?: Pool };
    const previous = globals.ertadPool;
    await admin.connect();
    t.after(async () => {
      clearPublicJobsCache();
      globals.ertadPool = previous;
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path=${schema},public`);
    for (const file of readdirSync('db/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      await admin.query(readFileSync('db/migrations/' + file, 'utf8'));
    globals.ertadPool = pool;
    await db().query("INSERT INTO sources(id,name) VALUES('hr','HR')");
    const ids: string[] = [];
    for (let index = 0; index < 15; index++) {
      const id = randomUUID();
      if (index < 12) ids.push(id);
      const title =
        index < 12
          ? index % 2
            ? 'ჭურჭლის მრეცხავი'
            : 'Dishwasher'
          : ['ავტომრეცხავი', 'სამრეცხაოს თანამშრომელი', 'მზარეული'][index - 12];
      const job = {
        title,
        company: `Keyword fixture ${index}`,
        city: 'თბილისი',
        category: 'მომსახურება',
        salary:
          index < 10 || index >= 12 ? '100 ლარი / დღე' : '2000 ლარი / თვე',
        salaryMin: index < 10 || index >= 12 ? 100 : 2000,
        salaryPeriod: index < 10 || index >= 12 ? 'დღე' : 'თვე',
        currency: 'GEL',
        mode: '',
        employmentType: 'სრული განაკვეთი',
        description:
          'ჩვენს გუნდში ჭურჭლის მრეცხავი უკვე მუშაობს. ეს სხვა პოზიციის აღწერაა.',
        source: 'hr.ge',
        url: `https://www.hr.ge/announcement/${900000 + index}/fixture`,
        deadline: '2099-01-01',
        datePosted: '2026-10-25',
      };
      await db().query(
        "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
        [id, job],
      );
      await db().query(
        "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now())",
        [id, job.url, job],
      );
    }
    const params = new URLSearchParams({
      q: 'ჭურჭლის მრეცხავი',
      salaryPeriod: 'day',
      city: 'თბილისი',
    });
    clearPublicJobsCache();
    const answer = await publicJobs(params);
    assert.equal(answer.total, 10);
    assert.ok(answer.jobs.every((job) => ids.includes(job.id)));
    await refreshLandingCounts({ force: true });
    const census = (
      await db().query(
        "SELECT category,city,trait,role,subcategory,count FROM landing_counts WHERE role='ჭურჭლის მრეცხავი'",
      )
    ).rows;
    const daily = census.find(
      (row) => row.city === 'თბილისი' && row.trait === 'daily',
    );
    assert.equal(daily.count, answer.total);
    assert.ok(eligibleLandings(census).includes(daily));
    assert.equal(census.find((row) => !row.city && !row.trait).count, 12);
    await db().query(
      "UPDATE jobs SET status='archived' WHERE id = ANY($1::uuid[])",
      [ids],
    );
    clearPublicJobsCache();
    assert.equal(
      (await publicJobs(params)).total,
      0,
      'description-only matches cannot fill a profession landing',
    );
    assert.ok(
      (
        await publicJobs(
          new URLSearchParams({ q: 'ჭურჭლის მრეცხავი', deep: 'true' }),
        )
      ).total > 0,
      'the reader can still explicitly search descriptions',
    );
    await refreshLandingCounts({ force: true });
    const remaining = (
      await db().query(
        "SELECT category,city,trait,role,subcategory,count FROM landing_counts WHERE role='ჭურჭლის მრეცხავი'",
      )
    ).rows;
    assert.equal(eligibleLandings(remaining).length, 0);
  },
);
