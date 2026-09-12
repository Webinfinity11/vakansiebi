import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeRegex,
  samePosting,
  searchTerms,
  sourceHealth,
  termPattern,
} from '../lib/job-intelligence';
import type { Vacancy } from '../lib/types';
const vacancy: Vacancy = {
  title: 'Backend Engineer',
  company: 'Example Ltd',
  city: 'Tbilisi',
  description:
    'Build reliable services and support existing applications. Collaborate with the engineering team on delivery.',
  datePosted: '2026-09-09',
  deadline: '2026-10-09',
  salary: '1000 GEL',
  salaryMin: 1000,
  currency: 'GEL',
  salaryPeriod: 'month',
  mode: 'remote',
  category: 'Technology',
  source: 'hr.ge',
  url: 'https://www.hr.ge/announcement/123/test',
};
void test('search normalizes terms, removes duplicates and bounds expensive queries', () => {
  assert.deepEqual(searchTerms(' React  developer REACT '), [
    'react',
    'developer',
  ]);
  assert.deepEqual(searchTerms('დეველოპერი თბილისი'), [
    'დეველოპერი',
    'თბილისი',
  ]);
  assert.deepEqual(searchTerms('C++ C# .NET'), ['c++', 'c#', '.net']);
  assert.equal(
    searchTerms(Array.from({ length: 30 }, (_, i) => 'word' + i).join(' '))
      .length,
    12,
  );
});
void test('particles that occur in every text are dropped unless they are the whole query', () => {
  assert.deepEqual(searchTerms('java ის და'), ['java']);
  assert.deepEqual(searchTerms('менеджер по продажам'), [
    'менеджер',
    'продажам',
  ]);
  assert.deepEqual(searchTerms('ის'), ['ის'], 'the whole query survives');
  assert.deepEqual(searchTerms('qa engineer'), ['qa', 'engineer']);
  assert.deepEqual(searchTerms('1c hr c#'), ['1c', 'hr', 'c#']);
  assert.deepEqual(searchTerms('a b'), ['a', 'b']);
});
void test('match patterns bound Latin words, keep Georgian stems as substrings and never leak metacharacters', () => {
  assert.equal(termPattern('დეველოპერ'), null);
  assert.equal(termPattern('დაცვის თანამშრომ'), null);
  assert.equal(termPattern('ის'), '\\mის\\M');
  assert.equal(termPattern('java'), '\\mjava(e?s)?\\M');
  assert.equal(termPattern('react'), '\\mreact');
  assert.equal(termPattern('бухгалтер'), '\\mбухгалтер');
  assert.equal(termPattern('врач'), '\\mврач', 'Cyrillic inflects by suffix');
  assert.equal(termPattern('c++'), '\\mc\\+\\+($|[^[:alnum:]_])');
  assert.equal(termPattern('.net'), '\\.net\\M');
  assert.equal(
    escapeRegex('a.b|c(d)[e]{f}^$*+?\\-#'),
    'a\\.b\\|c\\(d\\)\\[e\\]\\{f\\}\\^\\$\\*\\+\\?\\\\\\-\\#',
  );
});
void test('duplicate linking requires identical content, cycle, conditions and employer', () => {
  assert.ok(
    samePosting(vacancy, {
      ...vacancy,
      source: 'jobs.ge',
      url: 'https://jobs.ge/ge/?id=12',
    }),
  );
  for (const change of [
    { deadline: '2026-11-09' },
    { datePosted: '2026-09-10' },
    { city: 'Batumi' },
    { salaryMin: 2000 },
    { description: vacancy.description + ' Different branch.' },
    { company: '' },
    { deadline: '' },
    { employmentType: 'part-time' },
  ]) {
    assert.equal(samePosting(vacancy, { ...vacancy, ...change }), false);
  }
});
void test('source health never treats a failed or unknown check as recent evidence', () => {
  const now = Date.parse('2026-09-09T12:00:00Z');
  assert.equal(sourceHealth('2026-09-09T11:00:00Z', null, now), 'recent');
  assert.equal(
    sourceHealth('2026-09-09T11:00:00Z', 'Source returned HTTP 404', now),
    'unavailable',
  );
  assert.equal(sourceHealth('2026-09-06T12:00:00Z', null, now), 'stale');
  assert.equal(sourceHealth(null, null, now), 'unknown');
  assert.equal(sourceHealth('2099-01-01', null, now), 'unknown');
});
