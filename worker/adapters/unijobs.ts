import { sourceNames, type Vacancy } from '../../lib/types';
import { safeExternalUrl, safeLogoUrl } from '../../lib/vacancy-media';
import { cleanText, UnavailableVacancy } from './index';
import type { ListedLink, ListingInfo, SourceModule } from './module';

// unijobs.ge is a WordPress job board (WP Job Board Pro) whose public REST API serves the
// `job_listing` type without authentication; robots.txt allows it. The whole active list
// (53 on 2026-10-15) fits one page of 100, newest first. `/?p=<id>` redirects to the
// vacancy's address, so it identifies a record; the detail is the same API by id.
const ORIGIN = 'https://unijobs.ge';
const API = `${ORIGIN}/wp-json/wp/v2/job_listing`;
const LIST = `${API}?per_page=100&orderby=date&order=desc&_fields=id,date,status`;

type Listing = { id?: unknown; date?: unknown; status?: unknown }[];
type Detail = {
  id?: unknown;
  date?: unknown;
  status?: unknown;
  type?: unknown;
  title?: { rendered?: unknown };
  content?: { rendered?: unknown };
  metas?: {
    _job_filled?: unknown;
    _job_category?: unknown;
    _job_type?: unknown;
    _job_location?: unknown;
    _job_address?: unknown;
    _job_expiry_date?: unknown;
    _job_application_deadline_date?: unknown;
    _job_apply_url?: unknown;
    _job_apply_email?: unknown;
    _job_logo?: unknown;
    _job_employer_name?: unknown;
  };
};

const str = (v: unknown) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
const day = (v: unknown) => str(v).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
const id = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? String(v) : '';
/** Taxonomy metas are `{ termId: name }` maps. */
const names = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.values(v).map(str).filter(Boolean)
    : [];

function json<T>(text: string): T | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    return null;
  }
}

export const unijobs: SourceModule = {
  config: {
    origin: ORIGIN,
    list: LIST,
    sitemap: null,
    hosts: ['unijobs.ge'],
  },
  externalId: (u) =>
    u.hostname === 'unijobs.ge' &&
    u.pathname === '/' &&
    /^\d{1,9}$/.test(u.searchParams.get('p') || '') &&
    [...u.searchParams.keys()].length === 1
      ? u.searchParams.get('p')
      : null,
  publicUrl: (n) => `${ORIGIN}/?p=${n}`,
  detailRequestUrl(url) {
    const n = this.externalId(new URL(url));
    if (!n) throw Error('Invalid unijobs.ge vacancy URL');
    return `${API}/${n}`;
  },
  listingUrl: (page) => `${LIST}&page=${page}`,
  listingInfo: (): ListingInfo => ({
    reportedTotal: null,
    pageSize: null,
    totalPages: null,
  }),
  listLinks(text): ListedLink[] {
    const items = json<Listing>(text);
    const links = new Map<string, ListedLink>();
    for (const item of Array.isArray(items) ? items : []) {
      const n = id(item?.id);
      if (!n || item.status !== 'publish' || links.has(n)) continue;
      const posted = day(item.date);
      links.set(n, {
        externalId: n,
        url: this.publicUrl(n),
        ...(posted ? { hints: { datePosted: posted } } : {}),
      });
    }
    return [...links.values()];
  },
  parseDetail(text, url): Vacancy {
    const d = json<Detail>(text);
    if (!d || id(d.id) !== this.externalId(new URL(url)))
      throw Error('unijobs.ge vacancy data missing or mismatched');
    if (
      d.type !== 'job_listing' ||
      d.status !== 'publish' ||
      str(d.metas?._job_filled) === 'on'
    )
      throw new UnavailableVacancy();
    const m = d.metas || {};
    const facts = (
      [
        ['კატეგორია', names(m._job_category).join(', ')],
        ['მისამართი', str(m._job_address)],
      ] as const
    )
      .filter(([, value]) => value)
      .map(([label, value]) => ({ label, value }));
    const apply = safeExternalUrl(str(m._job_apply_url));
    const email = str(m._job_apply_email);
    return {
      title: cleanText(str(d.title?.rendered)),
      company: str(m._job_employer_name),
      city: names(m._job_location)[0] || '',
      category: '',
      // The board's pay field prints "$" on every vacancy (a barista at "1500$ - 2500$",
      // 2026-10-15), so it is not shown; pay written in the text is still read.
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      employmentType: names(m._job_type).join(', '),
      description: [
        cleanText(str(d.content?.rendered)),
        email ? `ელ-ფოსტა: ${email}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      facts,
      logoUrl: safeLogoUrl(m._job_logo),
      applicationLinks: apply
        ? [{ label: 'განაცხადის გაგზავნა', url: apply }]
        : [],
      url,
      source: sourceNames.unijobs,
      datePosted: day(d.date),
      deadline:
        day(m._job_application_deadline_date) || day(m._job_expiry_date),
    };
  },
};
