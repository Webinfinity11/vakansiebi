import { load } from 'cheerio';
import { sourceNames, type Vacancy } from '../../lib/types';
import { safeLogoUrl } from '../../lib/vacancy-media';
import { workTowns } from '../../lib/work-location';
import { cityNamePattern } from '../../lib/cities';
import { cleanText, georgianDate, tbilisiDate } from './index';
import { visibleFields } from '../visible-fields';
import {
  UnavailableVacancy,
  type SourceModule,
  type ListedLink,
} from './module';

const origin = 'https://www.infobatumi.ge';
const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
function official(url: URL) {
  return url.origin === origin && !url.username && !url.password && !url.hash;
}
/** The portal prints a relative publication date. A modification timestamp is not
 * a publication date; do not use og:updated_time or the listing's renewal date. */
export function infobatumiPosted(value: string, now = new Date()) {
  const match = compact(value).match(
    /^განთავსებულია (\d+) (წამის|წუთის|საათის|დღის|კვირის) წინ$/,
  );
  if (!match) return '';
  const units: Record<string, number> = {
    წამის: 1000,
    წუთის: 60000,
    საათის: 3600000,
    დღის: 86400000,
    კვირის: 604800000,
  };
  return tbilisiDate(
    new Date(now.getTime() - Number(match[1]) * units[match[2]]),
  );
}
function listings(html: string): ListedLink[] {
  const $ = load(html);
  const root = $('[data-id="0354c20"]');
  const total = Number(
    compact($('.result-count').first().text()).match(/^(\d+) სულ$/)?.[1],
  );
  if (root.length !== 1 || !Number.isSafeInteger(total))
    throw Error('Infobatumi vacancy listing missing');
  const links = new Map<string, ListedLink>();
  root.find('.ts-preview[data-post-id]').each((_, el) => {
    const card = $(el);
    const id = card.attr('data-post-id') || '';
    const href = card.find('h3 a').attr('href') || '';
    const u = new URL(href, origin);
    if (
      !/^\d{1,9}$/.test(id) ||
      !official(u) ||
      !/^\/vakansiebi\/[^/]+\/$/.test(u.pathname) ||
      u.search
    )
      throw Error('Infobatumi listing identity changed');
    // The source offers all active jobs in this feed; unrelated feeds are excluded.
    if (!/სამსახური აღარაა აქტიური/.test(card.text()))
      links.set(id, { externalId: id, url: `${origin}/?p=${id}` });
  });
  if (links.size !== total)
    throw Error(
      'Infobatumi listing is incomplete; review pagination before importing',
    );
  return [...links.values()];
}

export const infobatumi: SourceModule = {
  config: {
    origin,
    list: origin + '/vakansiebi/',
    sitemap: null,
    hosts: ['www.infobatumi.ge'],
  },
  externalId(u) {
    return official(u) &&
      u.pathname === '/' &&
      [...u.searchParams.keys()].length === 1 &&
      /^\d{1,9}$/.test(u.searchParams.get('p') || '')
      ? u.searchParams.get('p')
      : null;
  },
  publicUrl: (id) => `${origin}/?p=${id}`,
  detailRequestUrl: (url) => url,
  listingUrl: () => origin + '/vakansiebi/',
  listingInfo(html) {
    const count = listings(html).length;
    return { reportedTotal: count, pageSize: count, totalPages: 1 };
  },
  listLinks: listings,
  parseDetail(html, url): Vacancy {
    const $ = load(html);
    const id = this.externalId(new URL(url));
    const bodyId = ($('body').attr('class') || '').match(
      /(?:^|\s)postid-(\d+)(?:\s|$)/,
    )?.[1];
    const canonical = new URL(
      $('link[rel="canonical"]').attr('href') || '/',
      origin,
    );
    if (
      !id ||
      bodyId !== id ||
      !official(canonical) ||
      !/^\/vakansiebi\/[^/]+\/$/.test(canonical.pathname)
    )
      throw Error('Infobatumi vacancy identity missing or mismatched');
    if (
      $('h1,h2')
        .toArray()
        .some((e) => compact($(e).text()) === 'ვაკანსია აღარ არის აქტიური')
    )
      throw new UnavailableVacancy();
    const root = $('[data-elementor-id="15116"]').first();
    const field = (key: string) => root.find(`[data-id="${key}"]`).first();
    const title = compact(field('06d28bc').text());
    const company = compact(field('0792b85').text());
    const body = field('9694e27');
    const pay = compact(field('c0b4051').text());
    if (!root.length || !title || !company || !body.length)
      throw Error('Infobatumi vacancy fields missing');
    const datePosted = infobatumiPosted(field('586f795').text());
    const deadlineText = compact(field('866cc03').text()).replace(
      /^ბოლო ვადა:\s*/,
      '',
    );
    const postedYear =
      Number(datePosted.slice(0, 4)) || Number(tbilisiDate().slice(0, 4));
    let deadline = georgianDate(deadlineText, postedYear);
    // Only the normal December→January rollover justifies advancing an omitted year.
    if (
      datePosted.slice(5, 7) === '12' &&
      deadline.slice(5, 7) === '01' &&
      deadline < datePosted &&
      !/\d{4}/.test(deadlineText)
    )
      deadline = georgianDate(deadlineText, postedYear + 1);
    const facts: { label: string; value: string }[] = [];
    for (const [key, label] of [
      ['116a2a9', 'სამუშაო გამოცდილება'],
      ['958a3b1', 'პიროვნული თვისებები'],
    ]) {
      const value = compact(field(key).text());
      if (value) facts.push({ label, value });
    }
    const address = compact(field('85ac575').text()).replace(
      new RegExp('^' + company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'),
      '',
    );
    if (address) facts.push({ label: 'მისამართი', value: address });
    const contacts = field('afb6332')
      .find('a[href^="tel:"],a[href^="mailto:"]')
      .map((_, e) =>
        $(e)
          .attr('href')!
          .replace(/^(?:tel:|mailto:)/, ''),
      )
      .get();
    const description = [
      cleanText(body.html() || ''),
      ...facts.map((f) => `${f.label}: ${f.value}`),
      pay && `ანაზღაურება: ${pay}`,
      contacts.length && `კონტაქტი: ${contacts.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const normalizedPay = pay
      .replace(/(\d+)\s*₾\s*([–—-])\s*(\d+)\s*₾/g, '$1$2$3 ₾')
      .replace(/^დღიური\s+(.+)$/, '$1 / დღე');
    const salary = visibleFields(`ანაზღაურება: ${normalizedPay}`);
    // "8 საათში 45₾" pays for eight hours, not 45 GEL per hour.
    const hoursPay = pay.match(/^([2-9]|1\d|2[0-4]) საათში (.+)$/);
    let coordinates: Vacancy['coordinates'];
    const mapUrl = field('edc3674').find('iframe').attr('src');
    if (mapUrl) {
      const map = new URL(mapUrl);
      const point = (
        map.hostname === 'maps.google.com' ? map.searchParams.get('q') : ''
      )?.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
      if (point) {
        const lat = Number(point[1]),
          lon = Number(point[2]);
        if (lat >= 41 && lat <= 44 && lon >= 40 && lon <= 47)
          coordinates = { lat, lon };
      }
    }
    // Preserve other cities named by the source; Batumi follows an actual map pin,
    // never the portal's name (it also carries Kutaisi and Chakvi vacancies).
    const placeText =
      address + ' ' + title + ' ' + cleanText(body.html() || '').split('\n')[0];
    const named = workTowns.filter((town) =>
      new RegExp(
        `(?<![\\p{L}])${cityNamePattern(town)}(?![\\p{L}])`,
        'iu',
      ).test(placeText),
    );
    const city =
      named.join(', ') ||
      (coordinates &&
      coordinates.lat >= 41.6 &&
      coordinates.lat <= 41.69 &&
      coordinates.lon >= 41.57 &&
      coordinates.lon <= 41.68
        ? 'ბათუმი'
        : '');
    return {
      title,
      company,
      city,
      category: '',
      salary: hoursPay ? `${hoursPay[2]} / ${hoursPay[1]} საათი` : pay,
      salaryMin: salary.salaryMin,
      currency: salary.currency,
      salaryPeriod: hoursPay ? `${hoursPay[1]} საათი` : salary.salaryPeriod,
      mode: '',
      employmentType: '',
      description,
      facts,
      coordinates,
      logoUrl: safeLogoUrl(field('c1a015a').find('img').attr('src'), origin),
      applicationLinks: [],
      url,
      source: sourceNames.infobatumi,
      datePosted,
      deadline,
    };
  },
};
