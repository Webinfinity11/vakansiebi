import { load } from 'cheerio';

type HrAnnouncement = {
  announcementId: number;
  title?: string;
  customerName?: string;
  addresses?: string[];
  deadlineDate?: string;
  publishDate?: string;
  employmentFormTypeName?: string;
  isWorkFromHome?: boolean;
  showSalary?: boolean;
  hideSalary?: boolean;
  salaryFrom?: number;
  salaryTo?: number;
  isWithBonus?: boolean;
};
type HrState = { b?: { data?: { announcement?: HrAnnouncement } } };
type Location = { address?: { addressLocality?: string } };
type JobPosting = {
  '@type'?: string;
  '@graph'?: JobPosting[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: Location | Location[];
  datePosted?: string;
  validThrough?: string;
  jobLocationType?: string;
  baseSalary?: {
    currency?: string;
    value?: {
      minValue?: number;
      maxValue?: number;
      value?: number;
      unitText?: string;
    };
  };
};

import type { SourceId, Vacancy } from '../../lib/types';
export const configs = {
  hr: {
    origin: 'https://www.hr.ge',
    list: 'https://www.hr.ge/',
    sitemap: 'https://api.p.hr.ge/public-portal/tenant/1/api/v3/seo/sitemap',
    hosts: ['www.hr.ge', 'hr.ge', 'api.p.hr.ge'],
  },
  samushao: {
    origin: 'https://samushao.ge',
    list: 'https://samushao.ge/',
    sitemap: 'https://samushao.ge/sitemap.xml',
    hosts: ['samushao.ge'],
  },
  jobs: {
    origin: 'https://jobs.ge',
    list: 'https://jobs.ge/ge/ads/',
    sitemap: null,
    hosts: ['jobs.ge', 'www.jobs.ge'],
  },
};
export function cleanText(html: string) {
  const $ = load(html);
  $('script,style,noscript,iframe').remove();
  $('br').replaceWith('\n');
  $('p,div,li,h1,h2,h3,tr').each((_, el) => {
    $(el).append('\n');
  });
  return $.text()
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
export function fingerprint(j: Pick<Vacancy, 'title' | 'company' | 'city'>) {
  return [j.title, j.company, j.city]
    .map((s) =>
      s
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, ''),
    )
    .join('|');
}
export function externalId(source: SourceId, url: string) {
  const u = new URL(url);
  if (
    !configs[source].hosts.includes(u.hostname) ||
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.port
  )
    return null;
  if (source === 'hr')
    return u.pathname.match(/^\/announcement\/(\d+)(?:\/|$)/)?.[1] ?? null;
  if (source === 'samushao')
    return u.pathname.match(/^\/vakansia\/[^/]*-(\d+)\/?$/)?.[1] ?? null;
  return u.searchParams.get('view') === 'jobs' &&
    /^\d+$/.test(u.searchParams.get('id') || '')
    ? u.searchParams.get('id')
    : null;
}
export function listLinks(
  source: SourceId,
  html: string,
  base = configs[source].list,
) {
  const $ = load(html);
  const result = new Map<string, string>();
  $('a[href]').each((_, a) => {
    try {
      const u = new URL($(a).attr('href')!, base);
      u.hash = '';
      const id = externalId(source, u.href);
      if (id) result.set(id, u.href);
    } catch {}
  });
  return [...result].map(([externalId, url]) => ({ externalId, url }));
}
function dateOnly(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : '';
}
function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
function category(title: string) {
  const t = title.toLowerCase();
  const rules: [RegExp, string][] = [
    [
      /დეველოპ|პროგრამისტ|developer|software|ტექნიკოს|ინფორმაციულ/,
      'ტექნოლოგიები',
    ],
    [/გაყიდვ|კონსულტანტ|ექაუნთ|sales/, 'გაყიდვები'],
    [/მარკეტინგ|რეკლამ|marketing/, 'მარკეტინგი'],
    [/ბუღალტ|ფინანს|accountant/, 'ფინანსები'],
    [/მძღოლ|საწყობ|ლოჯისტ|დისპეტჩ|dispatcher/, 'ლოჯისტიკა'],
    [/ადმინისტრ|ასისტენტ|ოფის|ადამიანური|\bhr\b/, 'ადმინისტრაცია'],
    [/ექიმ|ექთან|ფარმაც/, 'სამედიცინო'],
    [/მასწავლებ|ლექტორ|პედაგოგ/, 'განათლება'],
    [/მიმტან|ბარისტ|მზარეულ|დასუფთავ|დიასახლის/, 'მომსახურება'],
  ];
  return rules.find(([r]) => r.test(t))?.[1] || 'სხვა';
}
function salaryText(
  min: number | null,
  max: number | null,
  currency: string,
  period: string,
  bonus = false,
) {
  if (min === null && max === null) return '';
  const symbol = currency === 'GEL' ? '₾' : currency;
  return `${min === null ? 'მაქსიმუმ ' : ''}${min ?? max}${max !== null && min !== null && max !== min ? `–${max}` : ''} ${symbol}${period ? ` / ${period}` : ''}${bonus ? ' + ბონუსი' : ''}`;
}
// Read only public vacancy fields. Ignore embedded contact/private-looking metadata.
export function parseDetail(
  source: SourceId,
  html: string,
  url: string,
): Vacancy {
  const $ = load(html);
  if (!externalId(source, url)) throw Error('Invalid vacancy URL');
  const j: Vacancy = {
    title: '',
    company: '',
    city: '',
    category: 'სხვა',
    salary: '',
    salaryMin: null,
    currency: '',
    salaryPeriod: '',
    mode: '',
    description: '',
    url,
    source: source === 'hr' ? 'hr.ge' : `${source}.ge`,
    deadline: '',
    datePosted: '',
  };
  if (source === 'hr') {
    let a: HrAnnouncement | undefined;
    try {
      const state = JSON.parse($('#ng-state').text()) as Record<
        string,
        HrState
      >;
      a = Object.values(state)
        .map((v) => v?.b?.data?.announcement)
        .find((v) => v && String(v.announcementId) === externalId(source, url));
    } catch {}
    if (a) {
      j.title = String(a.title || '');
      j.company = String(a.customerName || '');
      j.city = Array.isArray(a.addresses) ? a.addresses.join(', ') : '';
      j.description = cleanText($('.description').first().html() || '');
      j.deadline = dateOnly(a.deadlineDate);
      j.datePosted = dateOnly(a.publishDate);
      j.mode = a.employmentFormTypeName?.includes('ოფისიდან')
        ? 'ადგილზე'
        : a.isWorkFromHome
          ? 'დისტანციური'
          : String(a.employmentFormTypeName || '');
      if (a.showSalary === true && a.hideSalary !== true) {
        j.salaryMin = number(a.salaryFrom);
        j.currency = 'GEL';
        j.salary = salaryText(
          j.salaryMin,
          number(a.salaryTo),
          'GEL',
          '',
          a.isWithBonus,
        );
      }
    } else {
      j.title = $('.ann-title-container__text').first().text().trim();
      j.company = $('.company-name__link').first().text().trim();
      j.city = $('.main-info .location-items').first().text().trim();
      j.description = cleanText($('.description').first().html() || '');
    }
  } else if (source === 'samushao') {
    let post: JobPosting | undefined;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text()) as JobPosting | JobPosting[];
        const entries = Array.isArray(data) ? data : data['@graph'] || [data];
        post ??= entries.find((v) => v['@type'] === 'JobPosting');
      } catch {}
    });
    if (!post) throw Error('Samushao.ge: JobPosting data not found');
    j.title = String(post.title || '');
    j.company = String(post.hiringOrganization?.name || '');
    const loc = Array.isArray(post.jobLocation)
      ? post.jobLocation[0]
      : post.jobLocation;
    j.city = String(loc?.address?.addressLocality || '');
    j.description = cleanText(String(post.description || ''));
    j.datePosted = dateOnly(post.datePosted);
    j.deadline = dateOnly(post.validThrough);
    j.mode = post.jobLocationType === 'TELECOMMUTE' ? 'დისტანციური' : '';
    const pay = post.baseSalary;
    const val = pay?.value;
    j.salaryMin = number(val?.minValue ?? val?.value);
    j.currency = String(pay?.currency || '');
    j.salaryPeriod =
      (
        {
          MONTH: 'თვე',
          HOUR: 'საათი',
          DAY: 'დღე',
          YEAR: 'წელი',
          WEEK: 'კვირა',
        } as Record<string, string>
      )[val?.unitText || ''] || '';
    j.salary = salaryText(
      j.salaryMin,
      number(val?.maxValue),
      j.currency,
      j.salaryPeriod,
      /ბონუს/.test(j.description),
    );
  } else {
    const cells = $('.dtitle');
    j.title = cells.eq(0).find('b').first().text().trim();
    j.company = cells.eq(1).find('b').first().text().trim();
    j.description = cleanText(
      cells.last().closest('tr').next().find('td').html() || '',
    );
    const dates = cells
      .eq(2)
      .find('b')
      .map((_, el) => $(el).text().trim())
      .get();
    const today = new Date();
    const pub = georgianDate(dates[0] || '', today.getFullYear());
    if (pub && pub > today.toISOString().slice(0, 10))
      j.datePosted = georgianDate(dates[0], today.getFullYear() - 1);
    else j.datePosted = pub;
    j.deadline = georgianDate(
      dates[1] || '',
      Number(j.datePosted.slice(0, 4)) || today.getFullYear(),
    );
    if (j.deadline && j.datePosted && j.deadline < j.datePosted)
      j.deadline = georgianDate(dates[1], Number(j.datePosted.slice(0, 4)) + 1);
    j.city = [
      'თბილისი',
      'ბათუმი',
      'ქუთაისი',
      'რუსთავი',
      'თელავი',
      'გორი',
      'ფოთი',
      'ზუგდიდი',
      'კასპი',
    ]
      .filter((city) => j.description.includes(city))
      .join(', ');
  }
  j.category = category(j.title);
  j.title = j.title.trim();
  j.company = j.company.trim();
  if (j.title.length < 2 || j.description.length < 40)
    throw Error('Vacancy structure changed or description is missing');
  if (j.description.length > 100000) throw Error('Description exceeds limit');
  return j;
}

export function georgianDate(value: string, year: number) {
  const months = [
    'იანვარი',
    'თებერვალი',
    'მარტი',
    'აპრილი',
    'მაისი',
    'ივნისი',
    'ივლისი',
    'აგვისტო',
    'სექტემბერი',
    'ოქტომბერი',
    'ნოემბერი',
    'დეკემბერი',
  ];
  const match = value.trim().match(/^(\d{1,2})\s+(\S+)(?:\s+(\d{4}))?$/);
  if (!match) return '';
  const month = months.indexOf(match[2]) + 1;
  if (!month) return '';
  const y = Number(match[3]) || year;
  const result = `${y}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return Number.isFinite(Date.parse(result)) &&
    new Date(result).toISOString().slice(0, 10) === result
    ? result
    : '';
}
