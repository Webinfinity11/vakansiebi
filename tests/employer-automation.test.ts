import test from 'node:test';
import assert from 'node:assert/strict';
import {
  automaticEmployerDecision,
  employerDomain,
} from '../lib/employer-automation';
import { companyDisplayName } from '../lib/company-display-name';
import { companyVacancyTitle } from '../lib/company-vacancy-title';
import { employerIdentity } from '../lib/employer-identity';

void test('similar names need both a shared official domain and a shared logo', () => {
  const a = {
    logos: new Set(['https://brand.ge/logo.png']),
    domains: new Set(['brand.ge']),
  };
  assert.equal(
    automaticEmployerDecision(a, {
      logos: a.logos,
      domains: new Set(['other.ge']),
    }).decision,
    'separate',
  );
  assert.equal(
    automaticEmployerDecision(a, {
      logos: new Set(['https://brand.ge/other.png']),
      domains: a.domains,
    }).decision,
    'separate',
  );
  assert.equal(automaticEmployerDecision(a, a).decision, 'merge');
  for (const url of [
    'https://jobs.ge/',
    'https://jobs.ss.ge/',
    'https://gmail.com/',
    'invalid',
  ])
    assert.equal(employerDomain(url), null);
  assert.equal(employerDomain('https://www.brand.ge/careers'), 'brand.ge');
});
void test('legal forms and surrounding punctuation disappear only from presentation', () => {
  assert.equal(
    companyDisplayName('შპს : „საქართველოს ბანკი“'),
    'საქართველოს ბანკი',
  );
  assert.equal(
    companyVacancyTitle('შპს "საქართველოს ბანკი"'),
    'საქართველოს ბანკის ვაკანსიები',
  );
  assert.equal(companyDisplayName("LLC Wendy's"), "Wendy's");
  assert.equal(companyDisplayName('იმედი'), 'იმედი');
  for (const name of [
    'გიორგი',
    'გელა',
    'ნიკა',
    'giorgi',
    'გიორგი კაპანაძე',
    'კერძო დამსაქმებელი',
  ])
    assert.equal(employerIdentity(name, ['ss']), null);
  assert.notEqual(employerIdentity('შპს ნათია', ['ss']), null);
});
