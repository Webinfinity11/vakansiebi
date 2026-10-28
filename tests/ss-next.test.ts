import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ssNextBuildId,
  ssNextDataUrl,
  ssNextHtml,
  SsNextFallback,
} from '../worker/adapters/ss-next';
import { listLinks, listingPosition, parseDetail } from '../worker/adapters';
import { readDiscoveryInfo } from '../worker/discovery';
const fixture = (name: string) =>
  readFileSync(`tests/fixtures/ss-next/${name}`, 'utf8');
const page = 'https://jobs.ss.ge/ka/l/vacancies?sortBy=OrderDate_desc&page=2';
const detail = 'https://jobs.ss.ge/ka/details/dizaineri-123';

void test('SS JSON preserves listing dates, pagination and paid-tier rules', () => {
  const html = ssNextHtml(fixture('listing.json'), page);
  const links = listLinks('ss', html, page);
  assert.deepEqual(links, [
    { externalId: '123', url: detail, hints: { datePosted: '2026-10-28' } },
    {
      externalId: '124',
      url: 'https://jobs.ss.ge/ka/details/programisti-124',
      hints: { datePosted: '2026-10-27' },
    },
  ]);
  assert.deepEqual(readDiscoveryInfo('ss', html), {
    reportedTotal: 26,
    pageSize: 2,
    totalPages: 13,
  });
  assert.deepEqual(listingPosition('ss', html, links, '2026-10-24'), {
    past: false,
    paidTier: true,
  });
  assert.equal(
    ssNextDataUrl(page, 'fixture-build-1'),
    'https://jobs.ss.ge/_next/data/fixture-build-1/ka/l/vacancies.json?sortBy=OrderDate_desc&page=2',
  );
});

void test('SS JSON detail uses the existing identity guard without inventing visible contacts', () => {
  const job = parseDetail(
    'ss',
    ssNextHtml(fixture('detail.json'), detail),
    detail,
  );
  assert.equal(job.title, 'დიზაინერი');
  assert.equal(job.datePosted, '2026-10-28');
  assert.equal(job.deadline, '2026-11-28');
  assert.equal(job.salaryMin, 1500);
  assert.ok(!job.facts?.some((f) => /ტელეფონი|ელფოსტა/.test(f.label)));
  assert.throws(
    () => ssNextHtml(fixture('detail.json'), detail.replace('123', '999')),
    /identity/,
  );
  assert.throws(() => ssNextHtml('{"notFound":true}', detail));
  assert.throws(() =>
    ssNextHtml('{"pageProps":{"__N_REDIRECT":"https://evil.test"}}', page),
  );
  assert.throws(() => ssNextHtml('<html>challenge</html>', page));
  assert.throws(() =>
    ssNextHtml(
      fixture('listing.json').replace(
        /"jobsDealType":\s*1/,
        '"jobsDealType":2',
      ),
      page,
    ),
  );
});

void test('SS build discovery accepts same-origin data/manifest links and rejects unsafe routes', () => {
  assert.equal(ssNextBuildId(fixture('bootstrap.html')), 'fixture-build-1');
  assert.equal(
    ssNextBuildId('<a href="/_next/data/build-2/ka/l/vacancies.json">x</a>'),
    'build-2',
  );
  assert.equal(
    ssNextBuildId(
      '<script src="/_next/static/build-3/_buildManifest.js"></script>',
    ),
    'build-3',
  );
  assert.equal(
    ssNextBuildId(
      '<script src="https://evil.test/_next/static/evil/_buildManifest.js"></script>',
    ),
    null,
  );
  for (const url of [
    'https://jobs-gateway.ss.ge/Jobs/search',
    'https://jobs.ss.ge/api/x',
    'https://u:p@jobs.ss.ge/ka/l/vacancies',
  ])
    assert.throws(() => ssNextDataUrl(url, 'build'));
  assert.throws(() => ssNextDataUrl(page, '../escape'));
});

void test('SS fallback shares a bounded bootstrap and refreshes a stale observed build once', async () => {
  const fallback = new SsNextFallback();
  fallback.observe(fixture('bootstrap.html'));
  const urls: string[] = [];
  const html = await fallback.fetch(page, async (url) => {
    urls.push(url);
    if (url.includes('/fixture-build-1/'))
      throw Object.assign(Error('stale build'), { status: 404 });
    if (url.endsWith('/ka'))
      return fixture('bootstrap.html').replace(
        'fixture-build-1',
        'fresh-build',
      );
    return fixture('listing.json');
  });
  assert.equal(listLinks('ss', html, page).length, 2);
  assert.deepEqual(urls, [
    ssNextDataUrl(page, 'fixture-build-1'),
    'https://jobs.ss.ge/ka',
    ssNextDataUrl(page, 'fresh-build'),
  ]);
  const blocked = new SsNextFallback();
  let count = 0;
  const read = async () => {
    count++;
    throw Error('blocked');
  };
  await Promise.all([
    assert.rejects(() => blocked.fetch(page, read), /build ID/),
    assert.rejects(() => blocked.fetch(detail, read), /build ID/),
  ]);
  await assert.rejects(() => blocked.fetch(page, read), /build ID/);
  assert.equal(count, 2);
});
