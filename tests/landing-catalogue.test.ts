import test from 'node:test';
import assert from 'node:assert/strict';
import { cities } from '../lib/cities';
import { categories } from '../lib/types';
import { roleVocabulary } from '../lib/search-language';
import {
  eligibleLandings,
  landingCopy,
  landingDescription,
  landingFor,
  landingHeading,
  landingIndexable,
  landingLinks,
  landingPath,
  minimumLandingJobs,
  relatedLandings,
  traitKeys,
  type LandingCount,
} from '../lib/seo-landing';

function completeCatalogue(): LandingCount[] {
  const rows: LandingCount[] = [];
  for (const category of [null, ...categories.filter((x) => x !== 'სხვა')])
    for (const city of [null, ...cities])
      for (const trait of [null, ...traitKeys]) {
        if (category || city || trait)
          rows.push({ category, city, trait, role: null, count: 20 });
      }
  for (const { label: role } of roleVocabulary)
    for (const city of [null, ...cities])
      rows.push({ category: null, city, trait: null, role, count: 20 });
  return eligibleLandings(rows);
}

void test('every eligible combination can be reached from the compact footer', () => {
  const rows = completeCatalogue();
  const roots = landingLinks(rows);
  assert.ok(
    roots.length < 80,
    'only single-dimension links belong in the footer',
  );
  const reached = new Set(roots.map((row) => row.path));
  for (const path of reached) {
    const landing = landingFor(new URLSearchParams(path.slice(2)))!;
    const children = relatedLandings(landing, rows);
    assert.ok(
      children.length <= 20,
      `${path} has too many immediate neighbours`,
    );
    assert.equal(
      new Set(children.map((row) => row.path)).size,
      children.length,
    );
    for (const child of children) reached.add(child.path);
  }
  assert.deepEqual([...reached].sort(), rows.map(landingPath).sort());
});

void test('thin pages remain searches but disappear from all navigation and indexing', () => {
  assert.equal(minimumLandingJobs, 10);
  const rows: LandingCount[] = [
    { category: 'გაყიდვები', city: null, trait: null, count: 40 },
    { category: 'გაყიდვები', city: 'ბათუმი', trait: null, count: 9 },
    { category: null, city: 'ბათუმი', trait: null, count: 9 },
    { category: null, city: 'ფოთი', trait: null, count: 10 },
    { category: null, city: 'მცხეთა', trait: null, count: 0 },
  ];
  for (const row of rows) {
    const landing = landingFor(new URLSearchParams(landingPath(row).slice(2)))!;
    assert.ok(landing, 'a thin filter is still usable');
    assert.equal(
      landingIndexable(landing, rows),
      row.count >= minimumLandingJobs,
    );
    assert.equal(
      landingIndexable(landing, null),
      true,
      'database failure preserves indexing',
    );
    assert.equal(
      landingIndexable(landing, []),
      false,
      'successful empty census is not a failure',
    );
  }
  assert.deepEqual(
    landingLinks(rows).map((row) => row.path),
    [landingPath(rows[0]), landingPath(rows[3])],
  );
  assert.deepEqual(
    relatedLandings(
      landingFor(new URLSearchParams('category=გაყიდვები'))!,
      rows,
    ),
    [],
  );
  assert.equal(eligibleLandings(rows).length, 2);
});

void test('every landing has a distinct heading and description, including condition combinations', () => {
  const rows = completeCatalogue();
  assert.equal(new Set(rows.map(landingHeading)).size, rows.length);
  assert.equal(new Set(rows.map(landingCopy)).size, rows.length);
  assert.equal(new Set(rows.map(landingDescription)).size, rows.length);
  for (const row of rows) assert.ok(!landingCopy(row).includes('undefined'));
});

void test('stored counts use one SELECT and reject empty, stale and failed reads', async (t) => {
  const { db } = await import('../lib/server/db');
  const { allLandingCounts, landingCountsMaxAgeMs } =
    await import('../lib/server/sitemap-data');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://kapana@localhost:5432/ertad_test';
  const now = Date.now();
  const row = {
    category: 'გაყიდვები',
    city: null,
    trait: null,
    role: null,
    count: 12,
    computed_at: new Date(now),
  };
  let rows = [row];
  let fail = false;
  const statements: string[] = [];
  t.mock.method(db(), 'query', async (query: { text: string }) => {
    statements.push(query.text);
    if (fail) throw new Error('unavailable');
    return { rows };
  });
  try {
    assert.deepEqual(await allLandingCounts(now), [row]);
    assert.equal(statements.length, 1);
    assert.match(statements[0], /FROM landing_counts$/);
    assert.doesNotMatch(statements[0], /jobs|searchable/);
    assert.deepEqual(await allLandingCounts(now + landingCountsMaxAgeMs), [
      row,
    ]);
    await assert.rejects(
      allLandingCounts(now + landingCountsMaxAgeMs + 1),
      /stale/,
    );
    rows = [];
    await assert.rejects(allLandingCounts(now), /unavailable/);
    rows = [row];
    fail = true;
    await assert.rejects(allLandingCounts(now), /unavailable/);
    fail = false;
    assert.deepEqual(await allLandingCounts(now), [row], 'failure is retried');
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

void test('background census groups once and publishes atomically, only when due', async (t) => {
  const { db } = await import('../lib/server/db');
  const { refreshLandingCounts } = await import('../worker/landing-counts');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://kapana@localhost:5432/ertad_test';
  const statements: string[] = [];
  let fresh = false;
  let locked = true;
  let fail = false;
  let releases = 0;
  t.mock.method(db(), 'connect', async () => ({
    async query(sql: string) {
      statements.push(sql);
      if (sql.includes('pg_try_advisory_xact_lock'))
        return { rows: [{ ok: locked }] };
      if (sql.startsWith('SELECT 1 FROM landing_counts'))
        return { rowCount: fresh ? 1 : 0 };
      if (fail && sql.includes('INSERT INTO landing_counts'))
        throw new Error('write failed');
      return { rows: [] };
    },
    release() {
      releases++;
    },
  }));
  try {
    assert.ok((await refreshLandingCounts())! > 100);
    const reads = statements.filter((sql) => sql.startsWith('WITH'));
    assert.ok(reads.length > 10);
    assert.match(reads[0], /row_number\(\) OVER/);
    assert.ok(
      reads.slice(1).every((sql) => !sql.includes('row_number() OVER')),
    );
    assert.ok(reads.slice(1).every((sql) => sql.includes('::uuid[]')));
    assert.ok(statements.includes('DELETE FROM landing_counts'));
    assert.equal(statements.at(-1), 'COMMIT');
    statements.length = 0;
    fresh = true;
    assert.equal(await refreshLandingCounts(), null);
    assert.ok(!statements.some((sql) => sql.startsWith('WITH')));
    statements.length = 0;
    locked = false;
    assert.equal(await refreshLandingCounts(), null);
    assert.ok(!statements.some((sql) => sql.includes('FROM landing_counts')));
    locked = true;
    fail = true;
    await assert.rejects(refreshLandingCounts({ force: true }), /write failed/);
    assert.equal(statements.at(-1), 'ROLLBACK');
    assert.equal(releases, 4);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

void test('background census has one bounded total deadline and rolls back on timeout', async (t) => {
  const { db } = await import('../lib/server/db');
  const { refreshLandingCounts, censusBudgetMs } =
    await import('../worker/landing-counts');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://kapana@localhost:5432/ertad_test';
  const statements: string[] = [];
  let clock = 0;
  let released = false;
  t.mock.method(Date, 'now', () => (clock += censusBudgetMs / 2));
  t.mock.method(db(), 'connect', async () => ({
    async query(sql: string) {
      statements.push(sql);
      if (sql.includes('pg_try_advisory_xact_lock'))
        return { rows: [{ ok: true }] };
      return { rows: [], rowCount: 0 };
    },
    release() {
      released = true;
    },
  }));
  try {
    await assert.rejects(refreshLandingCounts(), /deadline exceeded/);
    assert.equal(statements.filter((sql) => sql.startsWith('WITH')).length, 1);
    assert.ok(!statements.includes('DELETE FROM landing_counts'));
    assert.equal(statements.at(-1), 'ROLLBACK');
    assert.equal(released, true);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
