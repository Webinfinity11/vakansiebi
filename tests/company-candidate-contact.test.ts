import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveContact, validCandidateEmail, validCandidatePhone } from '../lib/company-candidate-contact';

test('missing, blank and invalid parsed contacts remain empty', () => {
  assert.deepEqual(effectiveContact({}), { email: '', phone: '' });
  assert.deepEqual(effectiveContact({ email: ' ', phone: ' ' }, null), { email: '', phone: '' });
  assert.deepEqual(effectiveContact({}, { email: 'not an email', phone: '12345' }), { email: '', phone: '' });
  assert.deepEqual(effectiveContact({}, { email: ' ', phone: ' ' }), { email: '', phone: '' });
});

test('valid parsed contacts fill blank upload fields and are trimmed', () => {
  assert.deepEqual(effectiveContact({ email: '', phone: ' ' }, {
    email: ' candidate@example.com ', phone: ' +995 555 12 34 56 ',
  }), { email: 'candidate@example.com', phone: '+995 555 12 34 56' });
});

test('form values win independently over parsed contacts', () => {
  const parsed = { email: 'parsed@example.com', phone: '123456' };
  assert.deepEqual(effectiveContact({ email: ' own@example.com ', phone: ' 654321 ' }, parsed), {
    email: 'own@example.com', phone: '654321',
  });
  assert.deepEqual(effectiveContact({ email: 'own@example.com' }, parsed), {
    email: 'own@example.com', phone: '123456',
  });
});

test('editor validators reject malformed email and short phone numbers', () => {
  for (const value of ['name', 'name@example', 'name @example.com', 'a@@example.com'])
    assert.equal(validCandidateEmail(value), false);
  assert.equal(validCandidateEmail('name+tag@example.ge'), true);
  assert.equal(validCandidatePhone('12-345'), false);
  assert.equal(validCandidatePhone('+123 456'), true);
});
