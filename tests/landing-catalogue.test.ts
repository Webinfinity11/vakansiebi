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

void test('landing census groups once, coalesces readers and retries failed reads', async (t) => {
  const { db } = await import('../lib/server/db');
  const { allLandingCounts } = await import('../lib/server/sitemap-data');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://kapana@localhost:5432/ertad_test';
  const statements: string[] = [];
  let fail = false;
  let releases = 0;
  const client = {
    async query(sql: string) {
      statements.push(sql);
      if (fail && sql.startsWith('WITH')) throw new Error('unavailable');
      return { rows: [] };
    },
    release() {
      releases++;
    },
  };
  t.mock.method(db(), 'connect', async () => client);
  try {
    const first = allLandingCounts(0);
    assert.equal(first, allLandingCounts(1));
    await first;
    const reads = statements.filter((sql) => sql.startsWith('WITH'));
    assert.ok(reads.length > 10);
    assert.match(reads[0], /row_number\(\) OVER/);
    assert.ok(
      reads.slice(1).every((sql) => !sql.includes('row_number() OVER')),
    );
    assert.ok(reads.slice(1).every((sql) => sql.includes('::uuid[]')));
    fail = true;
    await assert.rejects(allLandingCounts(300_001), /unavailable/);
    fail = false;
    await allLandingCounts(300_002);
    assert.equal(releases, 3);
    assert.ok(statements.includes('ROLLBACK'));
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

void test('landing census has one total deadline, not a fresh timeout per filter', async (t) => {
  const { db } = await import('../lib/server/db');
  const { allLandingCounts } = await import('../lib/server/sitemap-data');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://kapana@localhost:5432/ertad_test';
  const statements: string[] = [];
  let released = false;
  let clock = 0;
  t.mock.method(Date, 'now', () => (clock += 2_000));
  t.mock.method(db(), 'connect', async () => ({
    async query(sql: string) {
      statements.push(sql);
      return { rows: [] };
    },
    release() {
      released = true;
    },
  }));
  try {
    const { censusBudgetMs } = await import('../lib/server/sitemap-data');
    // The mocked clock jumps two seconds per reading, so the whole budget is
    // spent after that many passes however many filters are still waiting.
    const passes = censusBudgetMs / 2_000;
    await assert.rejects(allLandingCounts(900_000), /deadline exceeded/);
    assert.ok(
      statements.filter((sql) => sql.startsWith('WITH')).length < passes,
    );
    assert.ok(
      statements.includes(
        `SET LOCAL statement_timeout = '${censusBudgetMs - 2_000}ms'`,
      ),
    );
    assert.ok(statements.includes("SET LOCAL statement_timeout = '2000ms'"));
    assert.equal(statements.at(-1), 'ROLLBACK');
    assert.equal(released, true);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
