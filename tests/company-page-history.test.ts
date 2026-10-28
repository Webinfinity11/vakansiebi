import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

void test(
  'one vacancy establishes a company page that survives expiry, archive and purge; suppression still wins',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const { employerPages, employerPageSuppressed, employerRowsSql } =
      await import('../lib/server/employers');
    const { companiesEntries } = await import('../lib/server/sitemap-entries');
    const { publicJobs, clearPublicJobsCache } =
      await import('../lib/server/jobs');
    const { similarVacancies } =
      await import('../lib/server/similar-vacancies');
    const { employerSlug } = await import('../lib/employer-identity');
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const rule = randomUUID();
    const company = `Orchid ${randomUUID().slice(0, 8)}`;
    const slug = employerSlug(company);
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    const freshPages = () => {
      now += 1_800_001;
      clearPublicJobsCache();
      return employerPages();
    };
    const vacancy = {
      title: 'მოლარე',
      company,
      city: 'თბილისი',
      category: 'გაყიდვები',
      description: 'მოლარე. საკონტაქტო: company-history@example.test',
      logoUrl: 'https://example.test/logo.png',
      deadline: '2099-12-31',
      url: `https://example.test/${ids[0]}`,
    };
    async function add(
      id: string,
      value: typeof vacancy,
      status = 'published',
    ) {
      await db().query(
        `INSERT INTO jobs(id,draft,published,status,fingerprint,published_at)
        VALUES($1::uuid,$2,$2,$3,$1::text,now())`,
        [id, value, status],
      );
      await db().query(
        `INSERT INTO source_items(id,job_id,source_id,external_id,url,raw)
        VALUES($1::uuid,$1::uuid,'hr',$1::text,$2,$3)`,
        [id, value.url, value],
      );
    }
    try {
      await add(ids[0], vacancy);
      await add(ids[1], {
        ...vacancy,
        company: `Magnolia ${randomUUID().slice(0, 8)}`,
        url: `https://example.test/${ids[1]}`,
        description: 'მოლარე',
      });
      await add(
        ids[2],
        {
          ...vacancy,
          company: `Pending ${randomUUID().slice(0, 8)}`,
          url: `https://example.test/${ids[2]}`,
        },
        'pending',
      );
      const initial = await freshPages();
      const page = initial.bySlug.get(slug)!;
      assert.ok(page, 'a single vacancy creates the page');
      assert.equal(
        initial.byJob.get(ids[0]),
        slug,
        'vacancy links to its company',
      );
      assert.equal(
        initial.byJob.has(ids[2]),
        false,
        'unpublished evidence creates no page',
      );
      assert.ok(
        (await companiesEntries()).some((e) =>
          e.url.endsWith(encodeURIComponent(slug)),
        ),
      );

      await db().query(
        `UPDATE jobs SET published=published || '{"deadline":"2000-01-01"}'::jsonb WHERE id=$1`,
        [ids[0]],
      );
      assert.ok(
        (await freshPages()).bySlug.has(slug),
        'deadline alone cannot erase the page',
      );
      assert.equal(
        (
          await publicJobs(new URLSearchParams({ summary: '1' }), false, {
            jobIds: page.jobIds,
          })
        ).total,
        0,
      );
      assert.equal(
        (await companiesEntries()).some((e) =>
          e.url.endsWith(encodeURIComponent(slug)),
        ),
        false,
        'empty page leaves sitemap',
      );

      await db().query(
        "UPDATE jobs SET status='archived',published=NULL WHERE id=$1",
        [ids[0]],
      );
      let retained = (await freshPages()).bySlug.get(slug)!;
      assert.ok(retained, 'archive preserves page');
      assert.equal(retained.logoUrl, vacancy.logoUrl);
      await db().query('UPDATE source_items SET job_id=NULL WHERE job_id=$1', [
        ids[0],
      ]);
      await db().query('DELETE FROM jobs WHERE id=$1', [ids[0]]);
      retained = (await freshPages()).bySlug.get(slug)!;
      assert.ok(retained, 'physical purge preserves page and slug');
      const similar = await similarVacancies({
        ...retained.example,
        id: ids[0],
        description: '',
      } as Parameters<typeof similarVacancies>[0]);
      assert.ok(
        similar.some((item) => item.job.id === ids[1]),
        'past role finds active similar vacancies',
      );
      const history = (
        await db().query(
          'SELECT snapshot FROM employer_page_history WHERE job_id=$1',
          [ids[0]],
        )
      ).rows[0].snapshot;
      assert.equal(
        history.description,
        undefined,
        'history does not retain job description',
      );
      assert.deepEqual(history.emails, ['company-history@example.test']);
      assert.equal(await employerPageSuppressed(retained), false);
      await db().query(
        `INSERT INTO employer_suppressions(id,email,reason,actor) VALUES($1,'company-history@example.test','test','test')`,
        [rule],
      );
      assert.equal(
        await employerPageSuppressed(retained),
        true,
        'new email suppression wins over a warm cache even after purge',
      );
      assert.equal(
        (await freshPages()).bySlug.has(slug),
        false,
        'suppressed history cannot recreate a page',
      );
      assert.equal(
        (await db().query(employerRowsSql)).rows.some((r) =>
          r.ids.includes(ids[0]),
        ),
        false,
      );
    } finally {
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().query(
        'DELETE FROM employer_page_history WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
      await db().query('DELETE FROM employer_suppressions WHERE id=$1', [rule]);
      await db().end();
    }
  },
);
