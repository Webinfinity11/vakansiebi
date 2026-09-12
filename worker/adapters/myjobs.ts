import { load } from 'cheerio';
import { sourceNames, type Vacancy } from '../../lib/types';
import { cleanText, UnavailableVacancy } from './index';
import type { ListedLink, ListingInfo, SourceModule } from './module';

// Records of the public API: `GET /api/ka/public/vacancies/{id}` returns `{data}`; the SSR page at
// the public URL embeds the same object in `__NEXT_DATA__`. Private fields (`company.vacancy_email`,
// `vacancy_emails`, user ids, counters) are read from neither.
type Titled = { title?: unknown };
type Detail = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  salary_type?: unknown;
  salary_from?: unknown;
  salary_to?: unknown;
  salary_period?: unknown;
  show_salary?: unknown;
  created_at?: unknown;
  duration?: unknown;
  job_type?: unknown;
  employment_type?: unknown;
  recruiter_company_name?: unknown;
  company?: { brand_name?: unknown } | null;
  category_data?: (Titled & { sub_category?: Titled | null }) | null;
  country?: { city?: Titled | null } | null;
  experience_levels?: { experience_level?: unknown }[] | null;
  work_experiences?:
    { experience_from?: unknown; experience_to?: unknown }[] | null;
  languages?: { language_id?: unknown; level?: unknown }[] | null;
  education_levels?: unknown[] | null;
  benefits?: (Titled | string)[] | null;
};
type Listing = {
  data?: Detail[];
  meta?: { total?: unknown; last_page?: unknown };
};

const API = 'https://api.myjobs.ge/api/ka/public/vacancies';
const MODES: Record<string, string> = {
  on_site: 'ადგილზე',
  hybrid: 'ჰიბრიდული',
  remote: 'დისტანციური',
};
const EMPLOYMENT: Record<string, string> = {
  full_time: 'სრული განაკვეთი',
  part_time: 'ნახევარი განაკვეთი',
  shifts: 'სამუშაო ცვლაში',
};
const PERIODS: Record<string, string> = {
  monthly: 'თვე',
  daily: 'დღე',
  hourly: 'საათი',
};
const EXPERIENCE: Record<string, string> = {
  junior: 'უმცროსი (junior)',
  middle: 'საშუალო (middle)',
  'mid-level': 'საშუალო (middle)',
  senior: 'უფროსი (senior)',
};
const LEVELS: Record<string, string> = {
  native: 'მშობლიური',
  fluent: 'თავისუფლად',
  good: 'კარგად',
  intermediate: 'საშუალოდ',
};
const EDUCATION: Record<string, string> = {
  without_education: 'განათლების გარეშე',
  student: 'სტუდენტი',
  course_graduate: 'კურსდამთავრებული',
  bachelor: 'ბაკალავრი',
  master: 'მაგისტრი',
  resident: 'რეზიდენტი',
  aspirant: 'ასპირანტი',
};
// `languages[].language_id` from /public/vacancies/data-for-vacancies (ids 1..40, in order).
const LANGUAGES = [
  'ქართული',
  'ინგლისური',
  'რუსული',
  'გერმანული',
  'დანიური',
  'ჩინური',
  'ესტონური',
  'ესპანური',
  'ესპერანტო',
  'ფრანგული',
  'ებრაული',
  'ისლანდიური',
  'იტალიური',
  'ლატვური',
  'ლიტვური',
  'უნგრული',
  'მაკედონური',
  'ჰოლანდიური',
  'პოლონური',
  'პორტუგალიური',
  'რუმინული',
  'სლოვენური',
  'შვედური',
  'თურქული',
  'ბერძნული',
  'ბელარუსული',
  'ბულგარული',
  'ყირგიზული',
  'ყაზახური',
  'აზერბაიჯანული',
  'უზბეკური',
  'უკრაინული',
  'სომხური',
  'იაპონური',
  'კორეული',
  'არაბული',
  'სპარსული',
  'ჩეხური',
  'ფინური',
  'ნორვეგიული',
];

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const flag = (v: unknown) => v === 1 || v === true || v === '1';
/** Positive integer from a number or a numeric string, capped; the API mixes both encodings. */
function posInt(v: unknown, max: number) {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max
    ? n
    : null;
}
const amount = (v: unknown) => posInt(v, 100000000);
/** Calendar day of an ISO instant in Tbilisi: a 22:05Z posting is already "tomorrow" there. */
function tbilisiDay(iso: unknown) {
  const ms = typeof iso === 'string' ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return '';
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
// Day arithmetic on the date string in UTC so local DST shifts cannot move the deadline.
const plusDays = (day: string, n: number) =>
  new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000)
    .toISOString()
    .slice(0, 10);
const label = (v: unknown, map: Record<string, string>) =>
  map[str(v)] || str(v);
const list = (v: unknown) => (Array.isArray(v) ? v : []);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function parseListing(text: string): Listing | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' ? (value as Listing) : null;
  } catch {
    return null;
  }
}
function detailData(text: string): Detail | null {
  try {
    if (text.trimStart().startsWith('{'))
      return (JSON.parse(text) as { data?: Detail }).data ?? null;
    const state = load(text)('script#__NEXT_DATA__').html();
    return state
      ? ((
          JSON.parse(state) as {
            props?: { pageProps?: { initialData?: { data?: Detail } } };
          }
        ).props?.pageProps?.initialData?.data ?? null)
      : null;
  } catch {
    return null;
  }
}
function experience(d: Detail) {
  const levels = list(d.experience_levels).map((e) =>
    label((e as { experience_level?: unknown })?.experience_level, EXPERIENCE),
  );
  const years = list(d.work_experiences).map((w) => {
    const from = posInt(
      (w as { experience_from?: unknown })?.experience_from,
      60,
    );
    const to = posInt((w as { experience_to?: unknown })?.experience_to, 60);
    if (from && to) return `${from}–${to} წელი`;
    if (from) return `${from}+ წელი`;
    return to ? `${to} წლამდე` : '';
  });
  return unique([...levels, ...years]).join(', ');
}
function languages(d: Detail) {
  return unique(
    list(d.languages).map((l) => {
      const id = posInt(
        (l as { language_id?: unknown })?.language_id,
        LANGUAGES.length,
      );
      const name = id ? LANGUAGES[id - 1] : '';
      const level = label((l as { level?: unknown })?.level, LEVELS);
      return name ? (level ? `${name} (${level})` : name) : '';
    }),
  ).join(', ');
}
function salary(d: Detail) {
  const empty = { salary: '', salaryMin: null, currency: '', salaryPeriod: '' };
  if (!flag(d.show_salary)) return empty;
  const type = str(d.salary_type);
  if (type === 'negotiable') return { ...empty, salary: 'შეთანხმებით' };
  const from = amount(d.salary_from);
  const to = type === 'range' ? amount(d.salary_to) : null;
  if (!from) return empty;
  const period = PERIODS[str(d.salary_period)] || '';
  const range = to && to !== from ? `${from}–${to}` : `${from}`;
  return {
    salary: `${range} ₾${period ? ` / ${period}` : ''}`,
    salaryMin: from,
    currency: 'GEL', // The board is Georgian and only ever quotes lari.
    salaryPeriod: period,
  };
}

export const myjobs: SourceModule = {
  config: {
    origin: 'https://myjobs.ge',
    list: `${API}?page=1`,
    sitemap: null,
    hosts: ['myjobs.ge', 'www.myjobs.ge', 'api.myjobs.ge'],
  },
  // The sitemap adds category and slug segments after the id; both forms name the same record.
  externalId: (u) =>
    u.hostname === 'myjobs.ge' || u.hostname === 'www.myjobs.ge'
      ? (u.pathname.match(/^\/ka\/vacancy\/(\d+)(?:\/|$)/)?.[1] ?? null)
      : null,
  publicUrl: (id) => `https://myjobs.ge/ka/vacancy/${id}`,
  detailRequestUrl(url) {
    const id = this.externalId(new URL(url));
    if (!id) throw Error('Invalid myjobs vacancy URL');
    return `${API}/${id}`;
  },
  listingUrl: (page) => `${API}?page=${page}`,
  listingInfo(text): ListingInfo {
    const page = parseListing(text);
    const size = Array.isArray(page?.data) ? page.data.length : 0;
    return {
      reportedTotal: posInt(page?.meta?.total, 1000000),
      pageSize: size > 0 ? size : null,
      totalPages: posInt(page?.meta?.last_page, 1000),
    };
  },
  listLinks(text): ListedLink[] {
    const result = new Map<string, ListedLink>();
    for (const item of list(parseListing(text)?.data) as Detail[]) {
      const id = posInt(item?.id, Number.MAX_SAFE_INTEGER);
      if (!id || item.status !== 'active' || result.has(String(id))) continue;
      const city = str(item.country?.city?.title);
      result.set(String(id), {
        externalId: String(id),
        url: this.publicUrl(String(id)),
        hints: {
          ...(city ? { city } : {}),
          salaried:
            flag(item.show_salary) && str(item.salary_type) !== 'negotiable',
        },
      });
    }
    return [...result.values()];
  },
  parseDetail(text, url): Vacancy {
    const d = detailData(text);
    if (!d || String(d.id) !== this.externalId(new URL(url)))
      throw Error('Myjobs vacancy data missing or mismatched');
    if (d.status !== 'active') throw new UnavailableVacancy();

    const category = unique([
      str(d.category_data?.title),
      str(d.category_data?.sub_category?.title),
    ]).join(' / ');
    const facts = (
      [
        ['კატეგორია', category],
        ['გამოცდილება', experience(d)],
        ['ენები', languages(d)],
        [
          'განათლება',
          unique(list(d.education_levels).map((e) => label(e, EDUCATION))).join(
            ', ',
          ),
        ],
        [
          'ბენეფიტები',
          unique(
            list(d.benefits).map((b) =>
              typeof b === 'string' ? b.trim() : str((b as Titled)?.title),
            ),
          ).join(', '),
        ],
      ] as const
    )
      .filter(([, value]) => value)
      .map(([label, value]) => ({ label, value }))
      .slice(0, 15);
    const body = cleanText(str(d.description));
    const datePosted = tbilisiDay(d.created_at);
    const duration = posInt(d.duration, 365);
    return {
      title: str(d.title),
      company: str(d.company?.brand_name) || str(d.recruiter_company_name),
      city: str(d.country?.city?.title),
      category: '',
      ...salary(d),
      mode: MODES[str(d.job_type)] || '',
      employmentType: EMPLOYMENT[str(d.employment_type)] || '',
      // The structured fields are appended so the text search sees them too.
      description: [body, facts.map((f) => `${f.label}: ${f.value}`).join('\n')]
        .filter(Boolean)
        .join('\n\n'),
      facts,
      logoUrl: '',
      applicationLinks: [],
      url,
      source: sourceNames.myjobs,
      datePosted,
      deadline: datePosted && duration ? plusDays(datePosted, duration) : '',
    };
  },
};
