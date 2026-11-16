import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VacancyCompanyBenefits } from '../app/vacancy-company-benefits';
const profile = { website: '', description: '', benefits: ['დაზღვევა', '<script>alert(1)</script>'], whyUs: 'სწავლა & განვითარება' };
const render = (owned?: boolean, value = profile) => renderToStaticMarkup(createElement(VacancyCompanyBenefits, { owned, profile: value, heading: 'რას გთავაზობთ' }));
test('public company benefits render only on an owned vacancy with filled fields', () => {
  const html = render(true);
  assert.match(html, /<h2>რას გთავაზობთ<\/h2>/);
  assert.match(html, /<li>დაზღვევა<\/li>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /სწავლა &amp; განვითარება/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(render(false), '');
  assert.equal(render(undefined), '');
  assert.equal(render(true, {...profile, benefits: ['  '], whyUs: ' '}), '');
});
test('either benefits or why-us can stand alone, without an empty list or paragraph', () => {
  const whyOnly = render(true, {...profile, benefits: []});
  assert.match(whyOnly, /<p>/); assert.doesNotMatch(whyOnly, /<ul>/);
  const benefitsOnly = render(true, {...profile, whyUs: ''});
  assert.match(benefitsOnly, /<ul>/); assert.doesNotMatch(benefitsOnly, /<p>/);
});
