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
test('registration needs only a name, an email and a strong password; details may follow', () => {
  assert.equal(registrationSchema.safeParse(valid).success, true);
  const short = registrationSchema.parse({ name: valid.name, email: valid.email, password: valid.password });
  assert.deepEqual([short.code, short.representativeName, short.position, short.phone], ['', '', '', '']);
  assert.equal(registrationSchema.safeParse({ ...valid, representativeName: '', position: '' }).success, true);
  for (const patch of [
    { code: '12345678' },
    { code: '12345678x' },
    { code: '1234567890' },
    { email: 'invalid' },
    { password: 'short' },
    { name: '' },
    { representativeName: 'a' },
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
test('missing details are named for the review notice', async () => {
  const { missingCompanyDetails, companyDetailsSchema } = await import('../lib/company-registration');
  assert.deepEqual(missingCompanyDetails({ code: '123456789', representativeName: 'ანა', position: '', phone: null }), ['ტელეფონი']);
  // The identification code is optional.
  assert.deepEqual(missingCompanyDetails({ ...valid, code: '' }), []);
  assert.deepEqual(missingCompanyDetails(valid), []);
  assert.equal(companyDetailsSchema.safeParse({ code: '12' }).success, false);
  assert.equal(companyDetailsSchema.safeParse({}).success, true);
});
