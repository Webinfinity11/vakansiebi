import test from 'node:test';
import assert from 'node:assert/strict';
import {
  georgianFromLatin,
  latinGeorgianSearch,
  searchGroups,
  stemGeorgian,
  suggestSearch,
  syncopeVariant,
} from '../lib/search-language';
import { searchTerms } from '../lib/job-intelligence';
import { readSearch, searchParams } from '../lib/search-state';
import { filtersSchema } from '../lib/personal-space';
void test('reviewed role equivalents preserve all query terms and technical punctuation', () => {
  assert.ok(searchGroups('ბუღალტერია')[0].includes('accountant'));
  assert.ok(searchGroups('დეველოპერი')[0].includes('developer'));
  assert.deepEqual(searchGroups('C++ C#'), [['c++'], ['c#']]);
  assert.equal(searchGroups('senior დეველოპერი').length, 2);
  const alternatives = (query: string) =>
    searchGroups(query).map((group) => [...group].sort());
  assert.deepEqual(
    alternatives('ბუღალტრის'),
    alternatives('ბუღალტერი'),
    'the two written forms of one word search for the same thing',
  );
  assert.deepEqual(
    searchGroups('ბუღალტერი')[0].filter((term) => term.startsWith('ბუღალტერ')),
    ['ბუღალტერ'],
    'an alternative a shorter Georgian stem already covers is not searched twice',
  );
});
void test('a dropped vowel is the same word, and only where Georgian drops one', () => {
  assert.equal(syncopeVariant('ბუღალტერ'), 'ბუღალტრ');
  assert.equal(syncopeVariant('ბუღალტრ'), 'ბუღალტერ');
  assert.equal(syncopeVariant('მასწავლებელ'), 'მასწავლებლ');
  assert.equal(syncopeVariant('მასწავლებლ'), 'მასწავლებელ');
  assert.equal(
    syncopeVariant('კურიერ'),
    null,
    'a vowel before the ე keeps the syllable: კურიერის, not კურირის',
  );
  assert.equal(syncopeVariant('მცველ'), null, 'short stems are left alone');
  assert.equal(syncopeVariant('მძღოლ'), null);
  assert.equal(syncopeVariant('developer'), null);
  assert.ok(searchGroups('მასწავლებლის')[0].includes('teacher'));
});
void test('a light suffix stripper turns a query word into the stem the texts share', () => {
  assert.equal(stemGeorgian('თბილისში'), 'თბილის');
  assert.equal(stemGeorgian('ოფისის'), 'ოფის');
  assert.equal(stemGeorgian('ფასებს'), 'ფას');
  assert.equal(stemGeorgian('მენეჯერი'), 'მენეჯერ');
  assert.equal(stemGeorgian('ბოსი'), 'ბოს');
  assert.equal(stemGeorgian('ისი'), 'ისი', 'stems stay at least three letters');
  assert.equal(stemGeorgian('developer'), 'developer');
  assert.deepEqual(searchGroups('თბილისში მენეჯერი'), [
    ['თბილის'],
    ['მენეჯერ', 'მენეჯრ', 'manager', 'менеджер'],
  ]);
});
void test('Russian role names reach the same reviewed group, including inflected forms', () => {
  assert.ok(searchGroups('бухгалтер')[0].includes('ბუღალტერ'));
  assert.ok(searchGroups('бухгалтера')[0].includes('accountant'));
  assert.ok(searchGroups('водитель')[0].includes('მძღოლ'));
  assert.ok(searchGroups('охранник')[0].includes('მცველ'));
  assert.ok(searchGroups('врач')[0].includes('ექიმ'));
  assert.deepEqual(
    searchGroups('менеджер по продажам').map((group) => group[0]),
    ['менеджер', 'продажам'],
  );
  assert.ok(searchGroups('менеджер по продажам')[1].includes('გაყიდვ'));
});
void test('typo suggestions are bounded, explicit and never rewrite short skills or arbitrary names', () => {
  assert.equal(suggestSearch('develoepr'), 'developer');
  assert.equal(suggestSearch('ბუღალტეირ'), 'ბუღალტერი');
  assert.equal(
    suggestSearch('მალარე'),
    'მოლარე',
    'the Georgian word of a group is the one people mistype, so it is offered',
  );
  assert.equal(suggestSearch('ადმინისტრატრი'), 'ადმინისტრატორი');
  assert.equal(suggestSearch('C++'), null);
  assert.equal(suggestSearch('someuniquecompanyname'), null);
  assert.equal(suggestSearch('developer'), null);
});
void test('daily work and daily pay are separate shareable filters; old saved searches gain safe defaults', () => {
  const f = readSearch(
    new URLSearchParams(
      'employment=daily&salaryPeriod=day&salaryFrom=80&salaryTo=150&postedWithin=7',
    ),
  );
  assert.deepEqual(readSearch(searchParams(f)), f);
  const {
    salaryFrom: _,
    salaryTo: __,
    salaryPeriod: ___,
    employment: ____,
    entryLevel: _____,
    postedWithin: ______,
    ...legacy
  } = f;
  const parsed = filtersSchema.parse(legacy);
  assert.equal(parsed.employment, 'all');
  assert.equal(parsed.salaryPeriod, 'month');
  assert.equal(parsed.salaryFrom, null);
  const bad = readSearch(
    new URLSearchParams(
      'salaryFrom=-1&salaryTo=NaN&postedWithin=999&employment=wrong',
    ),
  );
  assert.equal(bad.salaryFrom, null);
  assert.equal(bad.salaryTo, null);
  assert.equal(bad.postedWithin, 0);
  assert.equal(bad.employment, 'all');
});

// From the 2026-09-26 usage report: searches that found nothing although vacancies existed.
void test('title words correct typos the reviewed roles do not cover', () => {
  const lexicon = new Map([
    ['დიასახლისი', 240],
    ['აღმზრდელი', 12],
    ['მონიტორინგის', 20],
    ['სასტუმროს', 60],
    ['ადმინისტრატორი', 400],
    ['უსაფრთხოების', 60],
    ['ბუღალტერია', 3],
  ]);
  assert.equal(suggestSearch('დისსახლისი', lexicon), 'დიასახლისი');
  assert.equal(suggestSearch('აღნზრდელი', lexicon), 'აღმზრდელი');
  assert.equal(suggestSearch('მორიტორინგის', lexicon), 'მონიტორინგის');
  assert.equal(
    suggestSearch('საატუმრო ღამის ადმინისტრარორი', lexicon),
    'სასტუმროს ღამის ადმინისტრატორი',
    'a declined title word is still the same word',
  );
  assert.equal(
    suggestSearch('ბუღალტეირ', lexicon),
    'ბუღალტერი',
    'two forms of one word are not a tie',
  );
  assert.equal(suggestSearch('დიასახლისი', lexicon), null);
  assert.equal(suggestSearch('someuniquecompanyname', lexicon), null);
});
void test('Georgian typed on a Latin keyboard is read as Georgian, English is left alone', () => {
  const lexicon = new Map([
    ['მზარეული', 134],
    ['უსაფრთხოების', 60],
  ]);
  assert.equal(georgianFromLatin('damxmare'), 'დამხმარე');
  assert.equal(georgianFromLatin('shemfutveli'), 'შემფუთველი');
  assert.equal(
    latinGeorgianSearch('mzareuli, mcxobeli', lexicon),
    'მზარეული მცხობელი',
  );
  assert.equal(latinGeorgianSearch('usaptxoeba', lexicon), 'უსაფრთხოების');
  assert.equal(latinGeorgianSearch('მზარეული'), null);
  assert.equal(latinGeorgianSearch('c++'), null);
});
void test('dots between Georgian words separate them; the stemmer reads plural locatives', () => {
  assert.deepEqual(searchTerms('მცხობელი.მზარეული'), ['მცხობელი', 'მზარეული']);
  assert.deepEqual(searchTerms('node.js .net მძღოლი.'), [
    'node.js',
    '.net',
    'მძღოლი',
  ]);
  assert.equal(stemGeorgian('ოფისებში'), 'ოფის');
  assert.equal(stemGeorgian('მედიცინა'), 'მედიცინ');
  assert.equal(stemGeorgian('სტომატოლოგია'), 'სტომატოლოგ');
});
void test('short stems stay whole words and stay out of other words', () => {
  assert.equal(stemGeorgian('მედია'), 'მედია', 'not the start of მედიცინა');
  assert.equal(stemGeorgian('ოფის'), 'ოფის');
  assert.equal(stemGeorgian('მოლარე'), 'მოლარ');
  assert.equal(
    suggestSearch('audit', new Map([['ლუდის', 40]])),
    null,
    'a three-letter stem one letter away is not the same word',
  );
});
void test('aliases, guard words and glue words', () => {
  assert.ok(searchGroups('ქოლცენტრი')[0].includes('ქოლ-ცენტრ'));
  assert.ok(searchGroups('tbc')[0].includes('თიბისი'));
  assert.ok(searchGroups('დარაჯი')[0].includes('მცველ'));
  assert.ok(searchGroups('buxgalteri')[0].includes('ბუღალტერ'));
  assert.deepEqual(searchTerms('Bank of Georgia'), ['bank', 'georgia']);
  assert.deepEqual(searchTerms('.*'), []);
});
