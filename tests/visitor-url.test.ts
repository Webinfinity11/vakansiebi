import test from 'node:test';
import assert from 'node:assert/strict';
import { visitorUrl } from '../lib/visitor-url';

void test('a worknet vacancy opens in the language its app knows', () => {
  assert.equal(
    visitorUrl('https://worknet.moh.gov.ge/ka/vacancies/31413'),
    'https://worknet.moh.gov.ge/ka-GE/vacancies/31413',
  );
  assert.equal(
    visitorUrl('https://www.jobs.ge/ka/?view=jobs&id=1'),
    'https://www.jobs.ge/ka/?view=jobs&id=1',
  );
});
