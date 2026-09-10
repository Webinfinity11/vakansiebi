import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vacancyLinks,
  descriptionWithoutRepeatedLinks,
} from '../lib/vacancy-links';
void test('application links receive a clear action and repeated raw URLs are removed without changing other text', () => {
  const url = 'https://hel-ai.com/apply/test';
  const links = vacancyLinks({ applicationLinks: [{ label: url, url }] });
  assert.equal(links[0].label, 'განაცხადის შევსება');
  assert.equal(
    descriptionWithoutRepeatedLinks(
      `Company seeks a cashier.\nApply here:\n${url}`,
      links,
    ),
    'Company seeks a cashier.\nApply here:',
  );
  assert.equal(
    descriptionWithoutRepeatedLinks(
      'Unrelated https://example.com/other.',
      links,
    ),
    'Unrelated https://example.com/other.',
  );
  assert.deepEqual(
    vacancyLinks({
      applicationLinks: [{ label: 'Apply', url: 'javascript:alert(1)' }],
    }),
    [],
  );
});
