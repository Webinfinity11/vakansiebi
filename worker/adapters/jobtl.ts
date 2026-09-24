import { load } from 'cheerio';
import { sourceNames, type Vacancy } from '../../lib/types';
import { cleanText, UnavailableVacancy } from './index';
import type { ListedLink, ListingInfo, SourceModule } from './module';

// job.tl renders its list through `/?ajax=jobs&page=N&city=All` (JSON with an `html`
// fragment, twelve cards a page). batumijob.com is the same board filtered to Batumi,
// so it needs no adapter of its own. Detail pages carry a schema.org JobPosting with
// the dates, employer and city; the full text is the `.description` block.
type Page = {
  status?: unknown;
  html?: unknown;
  total?: unknown;
  has_more?: unknown;
};
type Posting = {
  '@type'?: unknown;
  title?: unknown;
  url?: unknown;
  datePosted?: unknown;
  validThrough?: unknown;
  hiringOrganization?: { name?: unknown };
  jobLocation?: { address?: { addressLocality?: unknown } };
};

const PAGE_SIZE = 12;
const str = (v: unknown) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
const day = (v: unknown) => str(v).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';

function page(text: string): Page | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' ? (value as Page) : null;
  } catch {
    return null;
  }
}

export const jobtl: SourceModule = {
  config: {
    origin: 'https://job.tl',
    list: 'https://job.tl/?ajax=jobs&page=1&city=All',
    sitemap: null,
    hosts: ['job.tl'],
  },
  externalId: (u) =>
    u.hostname === 'job.tl'
      ? (u.pathname.match(/^\/[a-z0-9-]*-(\d{5,12})\/?$/)?.[1] ?? null)
      : null,
  // The board redirects any slug ending in the id to its canonical address.
  publicUrl: (id) => `https://job.tl/vacancy-${id}`,
  detailRequestUrl: (url) => url,
  listingUrl: (n) => `https://job.tl/?ajax=jobs&page=${n}&city=All`,
  listingInfo(text): ListingInfo {
    const p = page(text);
    const total =
      typeof p?.total === 'number' &&
      Number.isSafeInteger(p.total) &&
      p.total >= 0
        ? p.total
        : null;
    return {
      reportedTotal: total,
      pageSize: PAGE_SIZE,
      totalPages:
        total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  },
  listLinks(text): ListedLink[] {
    const p = page(text);
    if (p?.status !== 'success') return [];
    const $ = load(typeof p.html === 'string' ? p.html : '');
    const links = new Map<string, ListedLink>();
    $('a[href]').each((_, el) => {
      try {
        const u = new URL($(el).attr('href') || '', 'https://job.tl/');
        const id = this.externalId(u);
        if (u.protocol === 'https:' && id && !links.has(id))
          links.set(id, { externalId: id, url: `https://job.tl${u.pathname}` });
      } catch {
        /* Ignore malformed card links. */
      }
    });
    return [...links.values()];
  },
  parseDetail(html, url): Vacancy {
    const $ = load(html);
    const id = this.externalId(new URL(url));
    let post: Posting | undefined;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text()) as Posting;
        if (data['@type'] === 'JobPosting') post ??= data;
      } catch {
        /* Other structured data blocks are irrelevant. */
      }
    });
    if (!post) throw new UnavailableVacancy();
    let postUrl: URL | null = null;
    try {
      postUrl = new URL(str(post.url));
    } catch {
      postUrl = null;
    }
    if (!id || !postUrl || this.externalId(postUrl) !== id)
      throw Error('job.tl vacancy identity missing or mismatched');
    const deadline = day(post.validThrough);
    return {
      title: str(post.title) || str($('h1').first().text()),
      company:
        str(post.hiringOrganization?.name) ||
        str($('.company strong').first().text()),
      city: str(post.jobLocation?.address?.addressLocality),
      category: '',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      employmentType: '',
      description: cleanText($('.description').first().html() || ''),
      facts: [],
      logoUrl: '',
      applicationLinks: [],
      url,
      source: sourceNames.jobtl,
      datePosted: day(post.datePosted),
      deadline,
    };
  },
};
