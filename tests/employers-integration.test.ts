import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/* Runs only against a separate test database: `RUN_DB_TESTS=1` with DATABASE_URL pointing at it. */
void test(
  'a near spelling is asked once, a merge joins it and a person on ss.ge is never asked',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const { db } = await import('../lib/server/db');
    const { employerCandidates, employerDirectory, decideEmployers } =
      await import('../lib/server/employers');
    const { employerIdentity } = await import('../lib/employer-identity');
    const rows = [
      ['Jibe Cash & Carry', 'jobs'],
      ['ჯიბე ქეშ & ქერი', 'ss'],
      ['ნინო', 'ss'],
      ['ნინა', 'ss'],
    ] as const;
    const ids = rows.map(() => randomUUID());
    const en = employerIdentity('Jibe Cash & Carry', ['jobs'])!;
    const ge = employerIdentity('ჯიბე ქეშ & ქერი', ['ss'])!;
    const [a, b] = en < ge ? [en, ge] : [ge, en];
    try {
      for (const [i, [company, source]] of rows.entries()) {
        const vacancy = {
          title: 'მოლარე',
          company,
          url: `https://example.test/${ids[i]}`,
        };
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
          [ids[i], vacancy],
        );
        await db().query(
          'INSERT INTO source_items(id,job_id,source_id,external_id,url,raw) VALUES($1::uuid,$1::uuid,$2,$1::text,$3,$4)',
          [ids[i], source, vacancy.url, vacancy],
        );
      }
      const mine = (list: { a: string; b: string }[]) =>
        list.filter(
          (c) =>
            [a, b].includes(c.a) ||
            [a, b].includes(c.b) ||
            /ნინ/.test(c.a + c.b),
        );
      assert.deepEqual(
        mine(await employerCandidates(1000)).map((c) => [c.a, c.b]),
        [[a, b]],
        'only the Jibe pair is asked; people named on ss.ge are not',
      );

      await decideEmployers({ a: ge, b: en, decision: 'merge' });
      assert.equal(
        mine(await employerCandidates(1000)).length,
        0,
        'an answered pair is not asked again',
      );
      const merged = await employerDirectory();
      assert.equal(merged.root(en), merged.root(ge), 'merged spellings join');

      await decideEmployers({ a: en, b: ge, decision: 'separate' });
      const separate = await employerDirectory();
      assert.notEqual(
        separate.root(en),
        separate.root(ge),
        'a later answer replaces the earlier one',
      );
      await assert.rejects(
        decideEmployers({ a: en, b: en, decision: 'merge' }),
      );
    } finally {
      await db().query('DELETE FROM employer_decisions WHERE a=$1 AND b=$2', [
        a,
        b,
      ]);
      await db().query(
        "DELETE FROM audit_log WHERE action='employer.decide' AND after_data->>'a'=$1",
        [a],
      );
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
