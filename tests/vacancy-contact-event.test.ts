import test from 'node:test';
import assert from 'node:assert/strict';
import { vacancyContactEvent } from '../lib/vacancy-contact-event';

const job = {
  description: 'CV გამოგზავნეთ hr@example.ge',
  facts: [],
  applicationLinks: [
    { url: 'https://employer.example/apply', label: 'განაცხადი' },
  ],
};

void test('phone, CV email, ordinary enquiry, and employer form are distinct intentions', () => {
  assert.equal(vacancyContactEvent('tel:+995599123456', job), 'call');
  assert.equal(
    vacancyContactEvent('mailto:HR%40example.ge?subject=Private', job),
    'cv',
  );
  assert.equal(vacancyContactEvent('mailto:info@example.ge', job), 'email');
  assert.equal(
    vacancyContactEvent('mailto:hr@example.ge', {
      ...job,
      description: 'კონტაქტი: hr@example.ge',
    }),
    'email',
  );
  assert.equal(
    vacancyContactEvent('https://employer.example/apply', job),
    'apply',
  );
  for (const href of [
    'https://employer.example/',
    '/cv',
    '/companies/example',
    'mailto:invalid',
    'tel:invalid',
  ])
    assert.equal(vacancyContactEvent(href, job), null, href);
});
