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
