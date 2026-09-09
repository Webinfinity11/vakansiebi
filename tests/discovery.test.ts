import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readDiscoveryInfo,
  discoveryListingUrl,
  planDiscoveryPages,
  DiscoveryPageGuard,
  type DiscoverySource,
} from '../worker/discovery';
void test('HR search SSR count produces35pages; homepage and malformed JSON cannot silently become a complete catalog', () => {
  const html = `<script id="ng-state">${JSON.stringify({ request: { b: { data: { announcements: { items: Array(100).fill({}), totalCount: 3443 } } } } })}</script>`;
  assert.deepEqual(readDiscoveryInfo('hr', html), {
    reportedTotal: 3443,
    pageSize: 100,
    totalPages: 35,
  });
  assert.equal(
    readDiscoveryInfo('hr', '<script id="ng-state">{bad</script>').totalPages,
    null,
  );
  assert.equal(
    readDiscoveryInfo(
      'hr',
      `<script id="ng-state">${JSON.stringify({ request: { b: { data: { announcementList: Array(50).fill({}), hasMorePages: true } } } })}</script>`,
    ).totalPages,
    null,
  );
});
void test('SS public state supplies191pages even when visible pager exposes only nearby links', () => {
  const html = `<a href="?page=2">2</a><a href="?page=3">3</a><script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { searchInitData: { result: { items: Array(13).fill({}), totalCount: 2477 } } } } })}</script>`;
  assert.deepEqual(readDiscoveryInfo('ss', html), {
    reportedTotal: 2477,
    pageSize: 13,
    totalPages: 191,
  });
  const plan = planDiscoveryPages('ss', readDiscoveryInfo('ss', html), 185, 10);
  assert.equal(plan.urls[4], 'https://jobs.ss.ge/ka/l/vacancies?page=191');
  assert.equal(plan.urls[5], 'https://jobs.ss.ge/ka/l/vacancies?page=2');
  assert.equal(new Set(plan.urls).size, 10);
});
void test('Jobs scroll controller supplies20pages without inventing an exact vacancy count', () => {
  const html =
    '<script>var loaded_page=1;if(loaded_page<20){loaded_page++;var url="?page="+loaded_page;url+="&for_scroll=yes";}</script>';
  assert.deepEqual(readDiscoveryInfo('jobs', html), {
    reportedTotal: null,
    pageSize: null,
    totalPages: 20,
  });
  assert.equal(
    planDiscoveryPages('jobs', readDiscoveryInfo('jobs', html), 0, 10).urls[0],
    'https://jobs.ge/ge/ads/?page=2',
  );
  assert.equal(
    readDiscoveryInfo('jobs', '<script>var text="loaded_page<999999";</script>')
      .totalPages,
    null,
  );
});
void test('discovery routes and budgets are bounded; retired/unknown sources cannot be planned', () => {
  assert.equal(
    discoveryListingUrl('hr', 35),
    'https://www.hr.ge/search-posting?pg=35',
  );
  for (const page of [0, -1, 1.5, 1001, NaN])
    assert.throws(() => discoveryListingUrl('jobs', page));
  assert.throws(() => discoveryListingUrl('samushao' as DiscoverySource));
  assert.deepEqual(
    planDiscoveryPages(
      'jobs',
      { totalPages: 20, reportedTotal: null, pageSize: null },
      0,
      1000,
    ).urls,
    [],
  );
  assert.equal(
    planDiscoveryPages(
      'hr',
      { totalPages: 3, reportedTotal: 250, pageSize: 100 },
      0,
      10,
    ).urls.length,
    2,
  );
});
void test('repeated page guard ignores order/duplicates but accepts a new page with recurring promoted jobs', () => {
  const guard = new DiscoveryPageGuard();
  assert.equal(
    guard.accept([{ externalId: '1' }, { externalId: '2' }]),
    'accepted',
  );
  assert.equal(
    guard.accept([
      { externalId: '2' },
      { externalId: '1' },
      { externalId: '1' },
    ]),
    'repeated',
  );
  assert.equal(
    guard.accept([{ externalId: '1' }, { externalId: '3' }]),
    'accepted',
  );
  assert.equal(guard.accept([]), 'empty');
});
