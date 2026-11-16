import test from 'node:test';
import assert from 'node:assert/strict';
import { companySchema } from '../lib/server/companies';
const profile = {
  name: 'კომპანია',
  logoUrl: '',
  website: '',
  description: '',
  version: 1,
};
test('branding allows only owned-upload-shaped cover URLs and bounded plain text', () => {
  assert.throws(() =>
    companySchema.parse({
      ...profile,
      coverUrl: 'https://example.com/image.jpg',
    }),
  );
  assert.throws(() =>
    companySchema.parse({ ...profile, whyUs: 'ა'.repeat(1501) }),
  );
  assert.throws(() =>
    companySchema.parse({ ...profile, benefits: Array(13).fill('დაზღვევა') }),
  );
  const result = companySchema.parse({
    ...profile,
    benefits: ['დაზღვევა', '', 'დაზღვევა'],
    cvBoxEnabled: true,
  });
  assert.deepEqual(result.benefits, ['დაზღვევა']);
  assert.equal(result.cvBoxEnabled, true);
});
