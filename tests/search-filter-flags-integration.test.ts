import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { searchPlan } from '../lib/server/search-plan';

// Exercise the real preview SQL, not a copied TS regex: changing a live pattern
// without migrating the stored expression must fail this parity test.
void test(
  'stored filter flags match live draft answers and refresh on snapshot writes',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.ok(['/jobx_company_local', '/ertad_test'].includes(url.pathname));
    const schema = 'filter_flags_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: url.href });
    await client.connect();
    t.after(async () => {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    });
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path=${schema},public`);
    for (const file of readdirSync('db/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await client.query('BEGIN');
      try {
        await client.query(readFileSync('db/migrations/' + file, 'utf8'));
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    await client.query(
      "INSERT INTO sources(id,name) VALUES('flags','Filter fixtures')",
    );
    // Expected answers are entry-level, part-time, internship, daily, respectively.
    const fixtures: {
      name: string;
      patch: Record<string, unknown>;
      flags: boolean[];
    }[] = [
      { name: 'ordinary', patch: {}, flags: [false, false, false, false] },
      {
        name: 'English entry',
        patch: { description: 'No experience required.' },
        flags: [true, false, false, false],
      },
      {
        name: 'English prior entry',
        patch: { description: 'No prior experience is necessary.' },
        flags: [true, false, false, false],
      },
      {
        name: 'English required',
        patch: { description: '2 years experience required.' },
        flags: [false, false, false, false],
      },
      {
        name: 'Georgian entry',
        patch: { description: 'გამოცდილების გარეშე' },
        flags: [true, false, false, false],
      },
      {
        name: 'Georgian optional',
        patch: { description: 'გამოცდილება არ არის აუცილებელი.' },
        flags: [true, false, false, false],
      },
      {
        name: 'negated requirement',
        patch: {
          description: 'გამოცდილების გარეშე. არ უნდა ჰქონდეს გამოცდილება.',
        },
        flags: [true, false, false, false],
      },
      {
        name: 'conflicting requirement',
        patch: { description: 'გამოცდილების გარეშე. გამოცდილება აუცილებელია.' },
        flags: [false, false, false, false],
      },
      {
        name: 'required with facts',
        patch: {
          description: 'უნდა ჰქონდეს სამუშაო გამოცდილება.',
          facts: [{ label: 'გამოცდილება', value: 'გამოცდილების გარეშე' }],
        },
        flags: [false, false, false, false],
      },
      {
        name: 'beginner facts',
        patch: { facts: [{ label: 'გამოცდილება', value: 'დამწყები' }] },
        flags: [true, false, false, false],
      },
      {
        name: 'graduate facts',
        patch: { facts: [{ label: 'გამოცდილება', value: 'კურსდამთავრებული' }] },
        flags: [true, false, false, false],
      },
      {
        name: 'graduate description',
        patch: {
          description: 'კურსდამთავრებული, 2 years experience required.',
        },
        flags: [false, false, false, false],
      },
      {
        name: 'part time field',
        patch: { employmentType: 'ნახევარი განაკვეთი' },
        flags: [false, true, false, false],
      },
      {
        name: 'part time title',
        patch: { title: 'Part-time assistant' },
        flags: [false, true, false, false],
      },
      {
        name: 'part time description',
        patch: { description: 'სამუშაო გრაფიკი: ნახევარი განაკვეთი' },
        flags: [false, true, false, false],
      },
      {
        name: 'English schedule',
        patch: { description: 'Work schedule: part-time' },
        flags: [false, true, false, false],
      },
      {
        name: 'unavailable Georgian',
        patch: {
          description: 'სამუშაო გრაფიკი: ნახევარი განაკვეთი არ განიხილება.',
        },
        flags: [false, false, false, false],
      },
      {
        name: 'unavailable English',
        patch: {
          description: 'Work schedule: part-time. We do not offer part-time.',
        },
        flags: [false, false, false, false],
      },
      {
        name: 'structured wins exclusion',
        patch: {
          employmentType: 'part-time',
          description: 'We do not offer part-time.',
        },
        flags: [false, true, false, false],
      },
      {
        name: 'past part time',
        patch: { description: 'Experience in part-time roles required.' },
        flags: [false, false, false, false],
      },
      {
        name: 'internship field',
        patch: { employmentType: 'სტაჟირება' },
        flags: [false, false, true, false],
      },
      {
        name: 'internship title',
        patch: { title: 'Paid internship' },
        flags: [false, false, true, false],
      },
      {
        name: 'internship offer',
        patch: { description: 'კომპანია აცხადებს ანაზღაურებად სტაჟირებას.' },
        flags: [false, false, true, false],
      },
      {
        name: 'English intern offer',
        patch: { description: 'We are hiring an intern.' },
        flags: [false, false, true, false],
      },
      {
        name: 'supervising interns',
        patch: { description: 'Supervising interns and training employees.' },
        flags: [false, false, false, false],
      },
      {
        name: 'daily title',
        patch: { title: 'დღიური სამუშაო' },
        flags: [false, false, false, true],
      },
      {
        name: 'daily description',
        patch: { description: 'გვჭირდება ერთდღიანი სამუშაო.' },
        flags: [false, false, false, true],
      },
      {
        name: 'English daily',
        patch: { description: 'One-day work available.' },
        flags: [false, false, false, true],
      },
      {
        name: 'day labour',
        patch: { employmentType: 'Day labour' },
        flags: [false, false, false, true],
      },
      {
        name: 'daily duration',
        patch: { description: 'დღიური სამუშაოს ხანგრძლივობა 8 საათია.' },
        flags: [false, false, false, false],
      },
      {
        name: 'daily salary newline',
        patch: { description: 'ხელფასი: დღიური\nსამუშაო მუდმივია.' },
        flags: [false, false, false, false],
      },
      {
        name: 'NFKC and uppercase',
        patch: {
          title: 'ＰＡＲＴ－ＴＩＭＥ',
          description: 'ＮＯ ＥＸＰＥＲＩＥＮＣＥ ＲＥＱＵＩＲＥＤ',
        },
        flags: [true, true, false, false],
      },
      {
        name: 'nullable fields',
        patch: {
          title: '',
          company: null,
          city: null,
          description: null,
          facts: null,
          employmentType: null,
        },
        flags: [false, false, false, false],
      },
    ];
    const ids: string[] = [];
    for (const fixture of fixtures) {
      const id = randomUUID();
      ids.push(id);
      const job = {
        title: 'Assistant',
        company: 'Fixture',
        city: 'თბილისი',
        category: 'სხვა',
        description: '',
        employmentType: '',
        deadline: '2099-01-01',
        ...fixture.patch,
      };
      await client.query(
        "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
        [id, job],
      );
      await client.query(
        "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'flags',$1::text,$2,$1::uuid,$3,now())",
        [id, `https://example.com/${id}`, job],
      );
    }
    const filters = [
      ['entryLevel=true', 'search_entry_level', 'entry_level'],
      ['employment=part-time', 'search_part_time', 'employment_match'],
      ['employment=internship', 'search_internship', 'employment_match'],
      ['employment=daily', 'search_daily', 'employment_match'],
    ];
    for (const [index, [params, column, answer]] of filters.entries()) {
      const stored = (
        await client.query(`SELECT id,${column} AS flag FROM jobs`)
      ).rows;
      for (const preview of [true, false]) {
        const plan = searchPlan(new URLSearchParams(params), preview);
        if (!preview) {
          assert.equal(
            plan.args.length,
            0,
            'public filters bind no unused regex parameters',
          );
          assert.ok(!plan.cte.includes('regexp_replace('));
          assert.ok(!plan.cte.includes('search_document'));
        }
        const rows = (
          await client.query(
            `${plan.cte} SELECT id,${answer} AS flag FROM searchable j`,
            plan.args,
          )
        ).rows;
        assert.equal(rows.length, fixtures.length);
        for (const [i, fixture] of fixtures.entries()) {
          const actual = rows.find((row) => row.id === ids[i])!.flag;
          assert.equal(
            actual,
            fixture.flags[index],
            `${fixture.name}: ${params}, preview=${preview}`,
          );
          assert.equal(
            stored.find((row) => row.id === ids[i])!.flag,
            actual,
            `${fixture.name}: stored/preview parity`,
          );
        }
        // Also execute the actual filter and metric queries to catch unused binds.
        await client.query(
          `${plan.cte} SELECT id FROM searchable j WHERE ${plan.where}`,
          plan.args,
        );
        await client.query(plan.metrics, plan.args);
      }
    }
    await client.query(
      `UPDATE jobs SET published=jsonb_set(published,'{description}','"No experience required"') WHERE id=$1`,
      [ids[0]],
    );
    assert.equal(
      (
        await client.query('SELECT search_entry_level FROM jobs WHERE id=$1', [
          ids[0],
        ])
      ).rows[0].search_entry_level,
      true,
    );
    const draftPlan = searchPlan(new URLSearchParams('entryLevel=true'), true);
    const draft = await client.query(
      `${draftPlan.cte} SELECT entry_level FROM searchable WHERE id='${ids[0]}'`,
      draftPlan.args,
    );
    assert.equal(
      draft.rows[0].entry_level,
      false,
      'draft preview remains independent of published flags',
    );
    await client.query(
      `UPDATE jobs SET published=jsonb_set(published,'{description}','"2 years experience required"') WHERE id=$1`,
      [ids[0]],
    );
    assert.equal(
      (
        await client.query('SELECT search_entry_level FROM jobs WHERE id=$1', [
          ids[0],
        ])
      ).rows[0].search_entry_level,
      false,
    );
  },
);
