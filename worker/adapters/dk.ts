import { sourceNames, type Vacancy } from '../../lib/types';
import { cleanText, UnavailableVacancy } from './index';
import type { ListedLink, ListingInfo, SourceModule } from './module';

// v.dk.ge (Kenchadze.Jobs) is a client-rendered app over a public JSON API:
// `GET /api/public/vacancy/v2/search?page=N` pages the published vacancies and
// `GET /api/public/vacancy/get_by_id/{id}` returns one. CV counters, user ids and
// payment fields are never read.
type Named = { text?: unknown; name?: unknown } | null | undefined;
type Detail = {
  id?: unknown;
  status?: unknown;
  deleted_at?: unknown;
  created_at?: unknown;
  amount_type?: unknown;
  fixed_amount?: unknown;
  min_amount?: unknown;
  max_amount?: unknown;
  avarage_min_bonus?: unknown;
  avarage_max_bonus?: unknown;
  additional_info?: unknown;
  result_to_work_desc?: unknown;
  why_should?: unknown;
  what_to_do?: unknown;
  requirement?: unknown;
  perspective?: unknown;
  CompanyDetail?: { name?: unknown; brandname?: unknown } | null;
  CurrencyDetail?: Named;
  PositionDetail?: Named;
  VacancyLocation?: Named;
  WorkScheduleList?: Named;
  WorkTypeDetail?: Named;
  WorkCategoryDetail?: Named;
  VacancyReasonList?: unknown;
  VacancyCategoryList?: unknown;
};
type Listing = {
  vacancy?: {
    data?: Detail[];
    total?: unknown;
    per_page?: unknown;
    last_page?: unknown;
  };
};

const API = 'https://recruting.dkcapital.ge/api/public/vacancy';
const HOSTS = ['v.dk.ge', 'recruting.dkcapital.ge'];

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const named = (v: Named) => str(v?.text) || str(v?.name);
const strings = (v: unknown) =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];
function posInt(v: unknown, max: number) {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max
    ? n
    : null;
}
const amount = (v: unknown) => posInt(v, 100000000);
const live = (d: Detail | null | undefined) =>
  !!d && d.status === 'published' && d.deleted_at == null;

function json<T>(text: string): T | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    return null;
  }
}
// The same three forms the site renders: 1 = average earnings, 2 = range, 3 = fixed.
// The site states no pay period, so none is assumed.
function salary(d: Detail) {
  const empty = { salary: '', salaryMin: null, currency: '', salaryPeriod: '' };
  const [from, to] =
    String(d.amount_type) === '1'
      ? [amount(d.avarage_min_bonus), amount(d.avarage_max_bonus)]
      : String(d.amount_type) === '2'
        ? [amount(d.min_amount), amount(d.max_amount)]
        : String(d.amount_type) === '3'
          ? [amount(d.fixed_amount), null]
          : [null, null];
  if (!from || named(d.CurrencyDetail) !== '₾') return empty;
  const range = to && to !== from ? `${from}–${to}` : `${from}`;
  return {
    salary: `${String(d.amount_type) === '1' ? 'საშუალოდ ' : ''}${range} ₾`,
    salaryMin: from,
    currency: 'GEL',
    salaryPeriod: '',
  };
}
function tbilisiDay(value: unknown) {
  // `created_at` is the site's local calendar time ("2026-09-24 00:00:00.000000").
  const day = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
}

export const dk: SourceModule = {
  config: {
    origin: 'https://v.dk.ge',
    list: `${API}/v2/search?page=1`,
    sitemap: null,
    hosts: HOSTS,
  },
  externalId: (u) =>
    u.hostname === 'v.dk.ge'
      ? (u.pathname.match(/^\/VacancyDetails\/(\d+)\/?$/)?.[1] ?? null)
      : null,
  publicUrl: (id) => `https://v.dk.ge/VacancyDetails/${id}`,
  detailRequestUrl(url) {
    const id = this.externalId(new URL(url));
    if (!id) throw Error('Invalid v.dk.ge vacancy URL');
    return `${API}/get_by_id/${id}`;
  },
  listingUrl: (page) => `${API}/v2/search?page=${page}`,
  listingInfo(text): ListingInfo {
    const page = json<Listing>(text)?.vacancy;
    return {
      reportedTotal: posInt(page?.total, 1000000),
      pageSize: posInt(page?.per_page, 1000),
      totalPages: posInt(page?.last_page, 1000),
    };
  },
  listLinks(text): ListedLink[] {
    const result = new Map<string, ListedLink>();
    const items = json<Listing>(text)?.vacancy?.data;
    for (const item of Array.isArray(items) ? items : []) {
      const id = posInt(item?.id, Number.MAX_SAFE_INTEGER);
      if (!id || !live(item) || result.has(String(id))) continue;
      const city = named(item.VacancyLocation);
      result.set(String(id), {
        externalId: String(id),
        url: this.publicUrl(String(id)),
        hints: {
          ...(city ? { city } : {}),
          salaried: !!salary(item).salaryMin,
        },
      });
    }
    return [...result.values()];
  },
  parseDetail(text, url): Vacancy {
    const d = json<Detail>(text);
    if (!d || String(d.id) !== this.externalId(new URL(url)))
      throw Error('v.dk.ge vacancy data missing or mismatched');
    if (!live(d)) throw new UnavailableVacancy();

    const facts = (
      [
        ['კატეგორია', named(d.WorkCategoryDetail)],
        ['რატომ ჩვენთან', strings(d.VacancyReasonList).join(', ')],
        ['პირობები', strings(d.VacancyCategoryList).join(', ')],
      ] as const
    )
      .filter(([, value]) => value)
      .map(([label, value]) => ({ label, value }));
    const sections = (
      [
        ['', d.additional_info],
        ['რას გააკეთებ', d.what_to_do],
        ['მოთხოვნები', d.requirement],
        ['შედეგი, რასაც ველით', d.result_to_work_desc],
        ['რატომ უნდა აირჩიო', d.why_should],
        ['პერსპექტივა', d.perspective],
      ] as const
    )
      .map(([heading, html]) => {
        const body = cleanText(str(html));
        return body ? (heading ? `${heading}\n${body}` : body) : '';
      })
      .filter(Boolean);
    return {
      title: named(d.PositionDetail),
      company: str(d.CompanyDetail?.name) || str(d.CompanyDetail?.brandname),
      city: named(d.VacancyLocation),
      category: '',
      ...salary(d),
      mode: named(d.WorkTypeDetail),
      employmentType: named(d.WorkScheduleList),
      // The structured fields are appended so the text search sees them too.
      description: [
        ...sections,
        facts.map((f) => `${f.label}: ${f.value}`).join('\n'),
      ]
        .filter(Boolean)
        .join('\n\n'),
      facts,
      logoUrl: '',
      applicationLinks: [],
      url,
      source: sourceNames.dk,
      datePosted: tbilisiDay(d.created_at),
      // `EndDate` is not shown by the site and equals the posting day; no deadline is invented.
      deadline: '',
    };
  },
};
