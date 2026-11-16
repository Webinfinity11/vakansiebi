import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registrationSchema,
  invitationSchema,
} from '../lib/company-registration';
const valid = {
  name: 'ტესტ კომპანია',
  code: '123456789',
  representativeName: 'ანა ტესტი',
  position: 'მენეჯერი',
  email: 'owner@example.com',
  phone: '+995 555 12 34 56',
  password: 'strong-password-2026',
};
test('registration requires nine digits, contact information and strong password', () => {
  assert.equal(registrationSchema.safeParse(valid).success, true);
  for (const patch of [
    { code: '12345678' },
    { code: '12345678x' },
    { code: '1234567890' },
    { email: 'invalid' },
    { password: 'short' },
    { representativeName: '' },
    { position: '' },
    { phone: 'abc' },
  ])
    assert.equal(
      registrationSchema.safeParse({ ...valid, ...patch }).success,
      false,
      JSON.stringify(patch),
    );
});
test('invitation cannot grant ownership and normalizes email', () => {
  assert.equal(
    invitationSchema.safeParse({ email: 'test@example.com', role: 'owner' })
      .success,
    false,
  );
  assert.deepEqual(
    invitationSchema.parse({ email: 'TEST@example.com', role: 'viewer' }),
    { email: 'test@example.com', role: 'viewer' },
  );
});
