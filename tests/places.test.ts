import test from 'node:test';
import assert from 'node:assert/strict';
import { placeName, knownCity } from '../lib/places';
import { parseCvText } from '../lib/cv-parse';
import { personCity, cleanTitle } from '../lib/company-talent-filters';
import type { Candidate, CandidateProfile } from '../lib/company-candidates';

void test('known towns resolve from Georgian, Latin and Russian spellings', () => {
  assert.equal(placeName('Tbilisi, Georgia'), 'თბილისი');
  assert.equal(placeName('ქ. ბათუმი'), 'ბათუმი');
  assert.equal(placeName('Ozurgeti'), 'ოზურგეთი');
  assert.equal(placeName('кутаиси'), 'ქუთაისი');
  assert.equal(knownCity('დავამთავრე სკოლა გორში, ვცხოვრობ Borjomi-ში'), 'ბორჯომი');
});
void test('skills and sentences are never places', () => {
  assert.equal(placeName('Ms word'), '');
  assert.equal(placeName('Provide professional assistance to customers, venues and courier partners via chat and'), '');
  assert.equal(placeName('Boston, USA'), 'Boston, USA');
  // A town the person typed into the JOBX builder is kept even if unknown.
  assert.equal(placeName('Berlin', true), 'Berlin');
  assert.equal(placeName('Ms word'), '');
  assert.equal(placeName('ვაკანსიების მართვა და ანალიზი, გუნდური მუშაობა ყოველდღიურად', true), '');
});
void test('a parsed CV without a town gets no city instead of a random line', () => {
  const p = parseCvText('გიორგი ბერიძე\nMs word\n+995 555 12 34 56\nსამუშაო გამოცდილება\nმოლარე — Spar\n2020-01 – 2022-05');
  assert.equal(p.city, '');
  assert.equal(parseCvText('Nino Kapanadze\nKutaisi\nnino@example.com').city, 'ქუთაისი');
});
void test('card city: typed JOBX city trusted, parsed city must be a place', () => {
  const base = { text: '', roles: [], skills: [], languages: [], education: [], educationLevel: null, years: null } as unknown as CandidateProfile;
  const entry = { city: '' } as Candidate;
  assert.equal(personCity({ ...base, city: 'ვაზიანი', origin: 'jobx' } as CandidateProfile, [entry]), 'ვაზიანი');
  assert.equal(personCity({ ...base, city: 'Ms word', origin: 'parsed' } as CandidateProfile, [entry]), '');
  assert.equal(personCity({ ...base, city: 'Ms word', origin: 'parsed' } as CandidateProfile, [{ city: 'Batumi' } as Candidate]), 'ბათუმი');
  assert.equal(personCity(null, [{ city: 'Excel' } as Candidate]), '');
});
void test('position labels lose stray punctuation', () => {
  assert.equal(cleanTitle('მოლარე ().'), 'მოლარე');
  assert.equal(cleanTitle(' - მენეჯერი;'), 'მენეჯერი');
  assert.equal(cleanTitle('ჰოთ - ქარდი'), 'ჰოთ - ქარდი');
});
