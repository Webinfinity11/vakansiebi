import test from 'node:test';
import assert from 'node:assert/strict';
import { textSearch } from '../lib/search-text';
import { suggestionPrefixes } from '../lib/search-language';
import { filterMapVacancies } from '../lib/map-search';
import type { MapVacancy } from '../lib/server/job-map';
import { workplaceDistricts } from '../lib/map-address';

void test('a district from one branch is never copied to every address in an ad', () => {
  const first = 'ვაკე, ჭავჭავაძის გამზირი 74';
  const second = 'გლდანი, ქერჩის ქუჩა 6';
  const separate = workplaceDistricts(first + '\n' + second, 'თბილისი');
  assert.equal(separate['ჭავჭავაძის გამზირი 74, თბილისი'], 'ვაკე');
  assert.equal(separate['ქერჩის ქუჩა 6, თბილისი'], 'გლდანი');
  assert.deepEqual(workplaceDistricts(first + ', ' + second, 'თბილისი'), {});
});

void test('map search keeps Georgian variants, Latin spelling and all query terms', () => {
  for (const q of ['მოლარე', 'molare', 'cashier'])
    assert.ok(textSearch(q)('მოლარე-კონსულტანტი'));
  assert.ok(textSearch('ბუღალტრის')('ბუღალტერი'));
  assert.ok(textSearch('asistenti')('ასისტენტი'));
  assert.ok(textSearch('ქოლ ცენტრის ოპერატორი')('ქოლ ცენტრის ოპერატორი'));
  assert.ok(!textSearch('მოლარე თბილისი')('მოლარე ბათუმი'));
  assert.ok(textSearch('C++')('C++ Developer'));
  assert.ok(!textSearch('Java')('JavaScript Developer'));
  assert.ok(!textSearch('HR')('Chromium developer'));
});
void test('prefix suggestions keep literal brands and add Georgian keyboard variants', () => {
  assert.ok(suggestionPrefixes('mol').includes('მოლ'));
  assert.ok(suggestionPrefixes('molare').includes('მოლარე'));
  assert.ok(suggestionPrefixes('bug').includes('ბუღალტერ'));
  assert.ok(suggestionPrefixes('tbc').includes('tbc'));
  assert.deepEqual(suggestionPrefixes('მოლ'), ['მოლ']);
});
void test('address and radius matching retain only the matching branches', () => {
  const vacancy: MapVacancy = {
    id: 'one',
    title: 'მოლარე',
    company: 'Market',
    salary: '1200 ₾',
    salaryPeriod: 'month',
    logoUrl: '',
    category: '',
    city: 'თბილისი',
    premium: false,
    datePosted: '',
    places: [
      [41.71, 44.75, 'ჭავჭავაძის 10, თბილისი'],
      [41.8, 44.8, 'გლდანი, თბილისი'],
    ],
    placeDistricts: { 'ჭავჭავაძის 10, თბილისი': 'ვაკე' },
  };
  const options = {
    query: 'molare',
    area: 'ვაკეში',
    category: '',
    paid: false,
  };
  assert.deepEqual(filterMapVacancies([vacancy], options)[0].places, [
    vacancy.places[0],
  ]);
  assert.deepEqual(
    filterMapVacancies([vacancy], {
      ...options,
      area: '',
      near: { lat: 41.71, lon: 44.75 },
      radius: 500,
    })[0].places,
    [vacancy.places[0]],
  );
  assert.deepEqual(
    filterMapVacancies([vacancy], { ...options, area: 'ბათუმი' }),
    [],
  );
});
