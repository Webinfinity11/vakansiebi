import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDetail,
  listLinks,
  externalId,
  cleanText,
  fingerprint,
  georgianDate,
} from '../worker/adapters';
import { validateUrl } from '../worker/http';
void test('deduplicates listing links and rejects links to other origins', () => {
  const result = listLinks(
    'hr',
    '<a href="/announcement/123/a">A</a><a href="/announcement/123/a">A</a><a href="https://evil.test/announcement/456/a">X</a><a href="/announcement/favorites">Y</a>',
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].externalId, '123');
});
void test('URL allowlist rejects credentials, ports and unrelated hosts', () => {
  for (const url of [
    'http://www.hr.ge/',
    'https://www.hr.ge.evil.test/',
    'https://user:pass@www.hr.ge/',
    'https://www.hr.ge:444/',
    'https://127.0.0.1/',
  ])
    assert.throws(() => validateUrl('hr', url));
  assert.equal(externalId('jobs', 'https://jobs.ge/ge/?view=jobs&id=42'), '42');
});
void test('source HTML becomes plain text without scripts, retaining paragraphs', () =>
  assert.equal(
    cleanText('<p>First</p><script>bad()</script><p>Second &amp; third</p>'),
    'First\nSecond & third',
  ));
void test('HR only uses the requested announcement and respects hidden salary', () => {
  const announcement = {
    announcementId: 123,
    title: 'ოფისის ასისტენტი',
    customerName: 'კომპანია',
    addresses: ['თბილისი'],
    publishDate: '2026-09-07',
    deadlineDate: '2026-10-07',
    showSalary: false,
    salaryFrom: 9000,
  };
  const html = `<script id="ng-state" type="application/json">${JSON.stringify({ a: { b: { data: { announcement } } } })}</script><div class="description">${'გამოცდილი თანამშრომლის ვაკანსია. '.repeat(3)}</div>`;
  const job = parseDetail(
    'hr',
    html,
    'https://www.hr.ge/announcement/123/test',
  );
  assert.equal(job.title, announcement.title);
  assert.equal(job.salary, '');
  assert.equal(job.salaryMin, null);
  assert.equal(job.deadline, '2026-10-07');
});
void test('Samushao parses JSON-LD with explicit pay period and currency', () => {
  const data = {
    '@type': 'JobPosting',
    title: 'Developer',
    description:
      '<p>' + 'Work with a small engineering team. '.repeat(3) + '</p>',
    hiringOrganization: { name: 'Team' },
    baseSalary: {
      currency: 'USD',
      value: { minValue: 1000, maxValue: 2000, unitText: 'MONTH' },
    },
    jobLocationType: 'TELECOMMUTE',
    validThrough: '2026-10-04T00:00',
  };
  const job = parseDetail(
    'samushao',
    `<script type="application/ld+json">${JSON.stringify(data)}</script>`,
    'https://samushao.ge/vakansia/developer-123',
  );
  assert.equal(job.currency, 'USD');
  assert.equal(job.salaryPeriod, 'თვე');
  assert.equal(job.salaryMin, 1000);
  assert.equal(job.mode, 'დისტანციური');
});
void test('missing description fails instead of importing a navigation page', () =>
  assert.throws(() =>
    parseDetail(
      'hr',
      '<title>Jobs</title>',
      'https://www.hr.ge/announcement/123/test',
    ),
  ));
void test('Georgian date parser validates dates and explicit year', () => {
  assert.equal(georgianDate('04 ოქტომბერი', 2026), '2026-10-04');
  assert.equal(georgianDate('31 თებერვალი', 2026), '');
  assert.equal(georgianDate('01 იანვარი 2027', 2026), '2027-01-01');
});
void test('duplicate fingerprint folds punctuation but keeps city differences', () => {
  assert.equal(
    fingerprint({
      title: 'Office - Manager',
      company: 'ACME',
      city: 'თბილისი',
    }),
    fingerprint({ title: 'office manager', company: 'Acme', city: 'თბილისი' }),
  );
  assert.notEqual(
    fingerprint({ title: 'Manager', company: 'ACME', city: 'თბილისი' }),
    fingerprint({ title: 'Manager', company: 'ACME', city: 'ბათუმი' }),
  );
});
