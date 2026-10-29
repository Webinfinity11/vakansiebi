import { load } from 'cheerio';
import { sourceNames, type Vacancy } from '../../lib/types';
import { safeLogoUrl } from '../../lib/vacancy-media';
import { cityNamePattern } from '../../lib/cities';
import { workTowns } from '../../lib/work-location';
import { cleanText, georgianDate } from './index';
import type { ListedLink, SourceModule } from './module';
import {
  libertyCareersPath,
  libertyOrigin,
  libertyVacancyId,
} from '../liberty-url';

const text = (v: unknown) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
const deadline = (v: unknown) => georgianDate(text(v).replace(/,/g, ''), 0);

function workLocation(title: string, region: string) {
  // The page's location control names regions; the vacancy title often names its towns.
  // Preserve multiple towns and nationwide roles instead of guessing a region's capital.
  const suffix = title.split(/\s*[-–—]\s*/).at(-1) || '';
  if (/(?:^|[^ა-ჰ])რეგიონებ/u.test(suffix)) return suffix;
  const named = workTowns.filter((town) =>
    new RegExp(`(?<![\\p{L}])${cityNamePattern(town)}(?![\\p{L}])`, 'iu').test(
      title,
    ),
  );
  return named.length
    ? named.join(', ')
    : region === 'სხვადასხვა'
      ? ''
      : region;
}

/** Read the JSON array the public page passes to Angular; never execute source JavaScript. */
function listings(html: string): ListedLink[] {
  const $ = load(html);
  const script = $('script:not([src])')
    .toArray()
    .map((e) => $(e).text())
    .find((value) => /\bwindow\.vacancies\s*=/.test(value));
  const encoded = script?.match(
    /\bwindow\.vacancies\s*=\s*(\[[\s\S]*?\])\s*;/,
  )?.[1];
  if (!encoded) throw Error('Liberty vacancy listing structure missing');
  const items: unknown = JSON.parse(encoded);
  if (!Array.isArray(items) || items.length > 2000)
    throw Error('Invalid Liberty vacancy list');
  const links = new Map<string, ListedLink>();
  for (const item of items) {
    const url = new URL(text(item?.url), libertyOrigin);
    const id = libertyVacancyId(url);
    if (
      !id ||
      String(item?.id) !== id ||
      !text(item?.title) ||
      !deadline(item?.endDate)
    )
      throw Error('Liberty listing identity or deadline missing or mismatched');
    // Use one canonical bank hostname; no aggregator/API endpoints are followed.
    url.hostname = 'www.libertybank.ge';
    links.set(id, {
      externalId: id,
      url: url.href,
      hints: {
        city: text(item.location?.title),
        categoryLabel: text(item.category?.title),
      },
    });
  }
  return [...links.values()];
}

export const liberty: SourceModule = {
  config: {
    origin: libertyOrigin,
    list: libertyOrigin + libertyCareersPath,
    sitemap: null,
    hosts: ['www.libertybank.ge', 'libertybank.ge'],
  },
  externalId: libertyVacancyId,
  publicUrl: (id) => `${libertyOrigin}${libertyCareersPath}/${id}`,
  detailRequestUrl(url) {
    if (!libertyVacancyId(url)) throw Error('Invalid Liberty vacancy URL');
    return url;
  },
  listingUrl: () => libertyOrigin + libertyCareersPath,
  listingInfo(html) {
    const count = listings(html).length;
    return { reportedTotal: count, pageSize: count, totalPages: 1 };
  },
  listLinks: listings,
  parseDetail(html, url, hints): Vacancy {
    const $ = load(html);
    const id = libertyVacancyId(url);
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    if (!id || libertyVacancyId(canonical) !== id)
      throw Error('Liberty vacancy identity missing or mismatched');
    const root = $('.vacancy-content');
    if (root.length !== 1) throw Error('Liberty vacancy content missing');
    const title = text(root.find('.pagetitle h2').first().text());
    const body = root.find('.pagetext').first();
    const field = (name: string) =>
      text(
        body
          .children('h2')
          .filter((_, e) => text($(e).text()) === name)
          .next('p')
          .text(),
      );
    const closes = deadline(field('ბოლო ვადა'));
    const start = body
      .children('h2')
      .filter((_, e) => text($(e).text()) === 'აღწერა');
    if (!title || !closes || start.length !== 1)
      throw Error('Liberty vacancy fields missing');
    const description = cleanText(
      start
        .nextAll()
        .map((_, e) => $.html(e))
        .get()
        .join('\n'),
    );
    if (description.length < 40)
      throw Error('Liberty vacancy description missing');
    const location = field('ადგილმდებარეობა');
    const facts = [
      { label: 'ადგილმდებარეობა', value: location },
      { label: 'სამუშაო საათები', value: field('სამუშაო საათები') },
      { label: 'კატეგორია', value: hints?.categoryLabel || '' },
    ].filter((item) => item.value);
    return {
      title,
      company: 'ლიბერთი ბანკი',
      city: workLocation(title, location),
      category: '',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description,
      facts,
      logoUrl: safeLogoUrl(
        $('header img[src*="logo"]').first().attr('src'),
        libertyOrigin,
      ),
      applicationLinks: [],
      source: sourceNames.liberty,
      url,
      // The official page supplies only a closing date. Discovery is not publication.
      datePosted: '',
      deadline: closes,
    };
  },
};
