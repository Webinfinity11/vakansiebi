import assert from 'node:assert/strict';

const base = new URL(process.env.QA_SITE_URL || 'https://jobx.ge');
const checked = [];
async function read(url, xml = false) {
  const response = await fetch(new URL(url, base), {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'Googlebot/2.1 JOBX-Public-QA/1.0' },
  });
  assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
  if (xml)
    assert.match(
      response.headers.get('content-type') || '',
      /(?:application|text)\/xml/,
      `${url}: XML content type`,
    );
  const text = await response.text();
  checked.push(response.url);
  return { text, url: response.url };
}
function locations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    match[1].replace(/&amp;/g, '&'),
  );
}
function sample(items, count) {
  return Array.from(
    { length: Math.min(count, items.length) },
    (_, i) =>
      items[Math.floor((i * items.length) / Math.min(count, items.length))],
  );
}
async function page(url) {
  const result = await read(url);
  // React can stream both a Suspense fallback and its replacement into raw HTML.
  // Browser QA verifies one rendered H1; here their heading text must agree.
  const headings = [
    ...result.text.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g),
  ].map((match) => match[1]);
  assert.equal(new Set(headings).size, 1, `${url}: consistent primary heading`);
  assert.match(result.text, /rel="canonical"/, `${url}: canonical present`);
  assert.match(result.text, /<title>[^<]+<\/title>/, `${url}: title present`);
  return result;
}
const robots = await read('/robots.txt');
assert.match(robots.text, /Sitemap:\s*https:\/\/jobx\.ge\/sitemap\.xml/i);
const index = await read('/sitemap.xml', true);
assert.match(index.text, /<sitemapindex\b/);
const leaves = locations(index.text);
assert.equal(leaves.length, 4, 'four sitemap sections');
let companies = [],
  vacancies = [];
for (const leaf of leaves) {
  assert.equal(new URL(leaf).origin, base.origin, 'sitemap stays on the site');
  const { text } = await read(leaf, true);
  assert.match(text, /<urlset\b/);
  const urls = locations(text);
  assert.ok(urls.length <= 50000, 'sitemap URL limit');
  assert.equal(new Set(urls).size, urls.length, 'unique sitemap URLs');
  for (const url of urls) assert.equal(new URL(url).origin, base.origin);
  if (urls.some((url) => new URL(url).pathname.startsWith('/companies/')))
    companies = urls;
  if (urls.some((url) => new URL(url).pathname.startsWith('/vacancies/')))
    vacancies = urls;
}
assert.ok(companies.length > 0, 'company sitemap has pages');
assert.ok(vacancies.length > 0, 'vacancy sitemap has pages');
await page('/');
await page('/companies');
for (const url of sample(companies, 6)) await page(url);
let jobPostings = 0;
for (const url of sample(vacancies, 4)) {
  const { text } = await page(url);
  for (const match of text.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    const data = JSON.parse(match[1]);
    const records = Array.isArray(data) ? data : data['@graph'] || [data];
    for (const record of records)
      if (record['@type'] === 'JobPosting') {
        for (const key of [
          'title',
          'description',
          'datePosted',
          'hiringOrganization',
        ])
          assert.ok(record[key], `${url}: ${key}`);
        assert.ok(record.hiringOrganization.name, `${url}: employer name`);
        assert.match(record.datePosted, /^\d{4}-\d{2}-\d{2}$/);
        if (record.baseSalary)
          assert.ok(
            record.baseSalary.currency && record.baseSalary.value,
            `${url}: salary currency/value`,
          );
        jobPostings++;
      }
  }
}
console.log(
  JSON.stringify({
    checked: checked.length,
    companyUrls: companies.length,
    vacancyUrls: vacancies.length,
    jobPostings,
  }),
);
