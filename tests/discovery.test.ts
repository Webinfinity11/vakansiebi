import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readDiscoveryInfo,
  discoveryListingUrl,
  planDiscoveryPages,
  DiscoveryPageGuard,
  jobsCategoryListingUrl,
  planJobsCategoryPages,
  type DiscoverySource,
} from '../worker/discovery';
import { jobsCategories } from '../worker/categories';
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
    'https://jobs.ge/ge/ads/?page=2&jid=1',
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

void test('jobs.ge category listings keep the vacancy filter and refuse unknown categories or pages', () => {
  assert.equal(
    jobsCategoryListingUrl(6, 3),
    'https://jobs.ge/ge/ads/?page=3&cid=6&jid=1',
  );
  assert.equal(
    jobsCategoryListingUrl(1),
    'https://jobs.ge/ge/ads/?page=1&cid=1&jid=1',
  );
  for (const cid of jobsCategories.map((c) => c.cid))
    assert.match(
      jobsCategoryListingUrl(cid),
      /^https:\/\/jobs\.ge\/ge\/ads\/\?page=1&cid=\d+&jid=1$/,
    );
  for (const cid of [0, 15, 999, -1, 1.5, NaN])
    assert.throws(
      () => jobsCategoryListingUrl(cid),
      /Unknown jobs\.ge category/,
    );
  for (const page of [0, -1, 1.5, 1001, NaN])
    assert.throws(
      () => jobsCategoryListingUrl(6, page),
      /Invalid discovery page/,
    );
});

void test('the category plan rotates its starting point by cursor and keeps the budget within bounds', () => {
  const cids = jobsCategories.map((c) => c.cid);
  const first = planJobsCategoryPages();
  assert.deepEqual(
    first.order.map((c) => c.cid),
    cids,
  );
  assert.equal(first.budget, 30);
  const rotated = planJobsCategoryPages(2, 10);
  assert.deepEqual(
    rotated.order.map((c) => c.cid),
    [...cids.slice(2), ...cids.slice(0, 2)],
  );
  assert.equal(rotated.budget, 10);
  // Every category is still visited exactly once, whatever the cursor.
  for (const cursor of [0, 1, 5, 16, 17, 40, 1000])
    assert.deepEqual(
      planJobsCategoryPages(cursor)
        .order.map((c) => c.cid)
        .sort((a, b) => a - b),
      [...cids].sort((a, b) => a - b),
    );
  // A full lap or an invalid cursor starts from the beginning again.
  assert.deepEqual(planJobsCategoryPages(cids.length).order, first.order);
  assert.deepEqual(
    planJobsCategoryPages(cids.length + 3).order,
    planJobsCategoryPages(3).order,
  );
  for (const cursor of [-1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 2])
    assert.deepEqual(planJobsCategoryPages(cursor).order, first.order);
  assert.equal(planJobsCategoryPages(0, 50).budget, 50);
  assert.equal(planJobsCategoryPages(0, 1).budget, 1);
  for (const budget of [0, -5, 1.5, 51, 1000, NaN]) {
    const { budget: planned } = planJobsCategoryPages(0, budget);
    assert.ok(
      planned >= 1 && planned <= 50,
      `budget ${budget} planned ${planned}`,
    );
  }
});
