import { load } from 'cheerio';
import { safeLogoUrl, safeExternalUrl } from '../../lib/vacancy-media';

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
  hiringOrganization?: { name?: string; logo?: string | { url?: string } };
  employmentType?: string | string[];
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

import { sourceNames, type SourceId, type Vacancy } from '../../lib/types';
const legacyConfigs = {
  ss: {
    origin: 'https://jobs.ss.ge',
    list: 'https://jobs.ss.ge/ka/l/vacancies',
    sitemap: null,
    hosts: ['jobs.ss.ge'],
  },
  hrgov: {
    origin: 'https://vacancy.hr.gov.ge',
    list: 'https://vacancy.hr.gov.ge/',
    sitemap: null,
    hosts: ['vacancy.hr.gov.ge'],
  },
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
// Legacy parsing remains for existing audit records; no retired source can be fetched.
export const configs = {
  hr: legacyConfigs.hr,
  jobs: legacyConfigs.jobs,
  ss: legacyConfigs.ss,
  hrgov: legacyConfigs.hrgov,
};
export function getSourceConfig(source: SourceId) {
  if (source === 'samushao' || !(source in configs))
    throw Error('Source is retired or unsupported');
  return configs[source];
}
export function cleanText(html: string) {
  const $ = load(html);
  $('script,style,noscript,iframe').remove();
  $('br').replaceWith('\n');
  $('li').prepend('• ');
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
    !legacyConfigs[source].hosts.includes(u.hostname) ||
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.port
  )
    return null;
  if (source === 'ss')
    return u.pathname.match(/^\/ka\/details\/[^/]+-(\d+)\/?$/)?.[1] ?? null;
  if (source === 'hrgov')
    return (
      u.pathname.match(
        /^\/JobProvider\/UserOrgVaks\/Details\/(\d+)\/?$/,
      )?.[1] ?? null
    );
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
  base = legacyConfigs[source].list,
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
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value) &&
    Number.isFinite(Date.parse(value.slice(0, 10))) &&
    new Date(value.slice(0, 10)).toISOString().slice(0, 10) ===
      value.slice(0, 10)
    ? value.slice(0, 10)
    : '';
}
function number(value: unknown) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 100000000
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
  const j: Vacancy &
    Required<Pick<Vacancy, 'facts' | 'applicationLinks' | 'warnings'>> = {
    logoUrl: '',
    employmentType: '',
    facts: [],
    applicationLinks: [],
    warnings: [],
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
    source: source === 'samushao' ? 'samushao.ge' : sourceNames[source],
    deadline: '',
    datePosted: '',
  };
  if (source === 'hr') {
    j.logoUrl = safeLogoUrl(
      $('.logo-container .logo img').first().attr('src'),
      url,
    );
    $('.list-item-label').each((_, el) => {
      const label = $(el).text().replace(/:\s*$/, '').trim();
      const value = $(el).siblings().text().replace(/\s+/g, ' ').trim();
      if (
        label &&
        value &&
        value.length < 1500 &&
        !j.facts!.some((f) => f.label === label)
      )
        j.facts!.push({ label, value });
    });
    j.employmentType =
      j.facts.find((f) => f.label === 'განაკვეთი')?.value || '';
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
    const orgLogo = post.hiringOrganization?.logo;
    j.logoUrl =
      safeLogoUrl(typeof orgLogo === 'string' ? orgLogo : orgLogo?.url, url) ||
      safeLogoUrl(
        $('h2')
          .filter((_, el) => $(el).text().trim() === j.title)
          .first()
          .parent()
          .find('img')
          .first()
          .attr('src'),
        url,
      );
    const employment = Array.isArray(post.employmentType)
      ? post.employmentType[0]
      : post.employmentType;
    j.employmentType =
      (
        {
          FULL_TIME: 'სრული განაკვეთი',
          PART_TIME: 'ნახევარი განაკვეთი',
          CONTRACTOR: 'კონტრაქტი',
          TEMPORARY: 'დროებითი',
          INTERN: 'სტაჟირება',
          VOLUNTEER: 'მოხალისეობა',
        } as Record<string, string>
      )[employment || ''] || '';
    const visibleFacts = new Map<string, string>();
    $('dt').each((_, el) => {
      const label = $(el).text().trim();
      if (!visibleFacts.has(label))
        visibleFacts.set(
          label,
          $(el).next('dd').text().replace(/\s+/g, ' ').trim(),
        );
    });
    const loc = Array.isArray(post.jobLocation)
      ? post.jobLocation[0]
      : post.jobLocation;
    j.city = String(loc?.address?.addressLocality || '');
    j.description = cleanText(String(post.description || ''));
    j.datePosted = dateOnly(post.datePosted);
    j.deadline = dateOnly(post.validThrough);
    j.mode = post.jobLocationType === 'TELECOMMUTE' ? 'დისტანციური' : '';
    const locationText = visibleFacts.get('ლოკაცია') || '';
    if (!j.mode)
      j.mode = /დისტანციური/.test(locationText)
        ? 'დისტანციური'
        : /ჰიბრიდ/.test(locationText)
          ? 'ჰიბრიდული'
          : /ადგილზე/.test(locationText)
            ? 'ადგილზე'
            : '';
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
    const rawAmount = val?.minValue ?? val?.value;
    const visiblePay = visibleFacts.get('ხელფასი') || '';
    const conflict =
      (j.currency === 'GEL' && /\$|USD|დოლარ/.test(visiblePay)) ||
      (j.currency === 'USD' && /ლარ/.test(visiblePay));
    if (
      (rawAmount !== undefined && number(rawAmount) === null) ||
      (val?.maxValue !== undefined && number(val.maxValue) === null) ||
      (number(rawAmount) !== null &&
        number(val?.maxValue) !== null &&
        Number(rawAmount) > Number(val?.maxValue)) ||
      conflict
    ) {
      j.salary = '';
      j.salaryMin = null;
      j.currency = '';
      j.salaryPeriod = '';
      j.warnings.push(
        'წყაროს ხელფასი არაზუსტია ან ვალუტა არ ემთხვევა. გადაამოწმე აღწერა და შეავსე ხელით.',
      );
    }
    const content = load(String(post.description || ''));
    content('a[href]').each((_, el) => {
      const href = safeExternalUrl(content(el).attr('href') || '', url);
      if (href)
        j.applicationLinks!.push({
          label:
            content(el).text().trim().slice(0, 150) || new URL(href).hostname,
          url: href,
        });
    });
  } else if (source === 'ss') {
    type Translated = { ka?: string; text?: string };
    type SsDetail = {
      id?: number;
      jobsDealType?: number;
      title?: Translated;
      description?: Translated;
      duties?: Translated;
      requirements?: Translated;
      publisherName?: string;
      logo?: string;
      startDate?: string;
      endDate?: string;
      address?: { cityTitle?: Translated };
      salaryFrom?: number;
      salaryTo?: number;
      currencyId?: number;
      monthOrDayType?: number;
      workingFormat?: number;
      workingSchedule?: number;
      resumeLink?: string;
    };
    let data: SsDetail | undefined;
    try {
      data = (
        JSON.parse($('#__NEXT_DATA__').text()) as {
          props?: { pageProps?: { detailsInitData?: SsDetail } };
        }
      ).props?.pageProps?.detailsInitData;
    } catch {}
    if (
      !data ||
      String(data.id) !== externalId(source, url) ||
      data.jobsDealType !== 1
    )
      throw Error('SS.ge vacancy data missing or mismatched');
    const translated = (v?: Translated) => v?.ka || v?.text || '';
    j.title = translated(data.title);
    j.company = data.publisherName || '';
    j.city = translated(data.address?.cityTitle);
    j.description = [
      translated(data.description),
      translated(data.duties),
      translated(data.requirements),
    ]
      .filter(Boolean)
      .map(cleanText)
      .join('\n\n');
    j.logoUrl = safeLogoUrl(data.logo, url);
    j.datePosted = dateOnly(data.startDate);
    j.deadline = dateOnly(data.endDate);
    j.mode =
      (
        {
          0: 'ადგილზე',
          1: 'დისტანციური',
          2: 'ჰიბრიდული',
          3: 'გარეთ სამუშაო',
        } as Record<number, string>
      )[data.workingFormat ?? -1] || '';
    j.employmentType =
      (
        {
          0: 'სრული განაკვეთი',
          1: 'ნახევარი განაკვეთი',
          2: 'თავისუფალი',
          3: 'სამუშაო ცვლაში',
          4: 'ერთჯერადი პროექტი',
          5: 'ერთდღიანი სამუშაო',
        } as Record<number, string>
      )[data.workingSchedule ?? -1] || '';
    // Only map the currency observed in the visible page; unknown enum values remain unpriced.
    j.currency = data.currencyId === 1 ? 'GEL' : '';
    j.salaryPeriod =
      ({ 0: 'თვე', 1: 'დღე' } as Record<number, string>)[
        data.monthOrDayType ?? -1
      ] || '';
    if (j.currency) {
      j.salaryMin = number(data.salaryFrom);
      j.salary = salaryText(
        j.salaryMin,
        number(data.salaryTo),
        j.currency,
        j.salaryPeriod,
      );
    }
    const invalidPay =
      [data.salaryFrom, data.salaryTo].some(
        (v) => v !== undefined && v !== null && v !== 0 && number(v) === null,
      ) ||
      (number(data.salaryFrom) !== null &&
        number(data.salaryTo) !== null &&
        Number(data.salaryFrom) > Number(data.salaryTo));
    if (invalidPay) {
      j.salary = '';
      j.salaryMin = null;
      j.currency = '';
      j.salaryPeriod = '';
      j.warnings.push(
        'წყაროს ხელფასის დიაპაზონი არაზუსტია. გადაამოწმე პირველწყარო და შეავსე ხელით.',
      );
    }
    if (data.resumeLink && safeExternalUrl(data.resumeLink))
      j.applicationLinks.push({
        label: 'განაცხადის გაგზავნა',
        url: safeExternalUrl(data.resumeLink),
      });
  } else if (source === 'hrgov') {
    if ($('#ID').attr('value') !== externalId(source, url))
      throw Error('Public service vacancy ID does not match');
    const fields = new Map<string, string>();
    $('#regForm dt').each((_, el) => {
      const label = $(el).text().replace(/\s+/g, ' ').trim().replace(/:$/, '');
      const value = cleanText($(el).next('dd').html() || '');
      if (label && value) fields.set(label, value);
    });
    j.title = fields.get('პოზიციის დასახელება') || '';
    j.company = fields.get('ორგანიზაცია') || '';
    j.city = fields.get('სამსახურის ადგილმდებარეობა') || '';
    j.employmentType = fields.get('სამუშაოს ტიპი') || '';
    const deadline = fields
      .get('განცხადების ბოლო ვადა')
      ?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (deadline)
      j.deadline = dateOnly(`${deadline[3]}-${deadline[2]}-${deadline[1]}`);
    const pay = fields.get('თანამდებობრივი სარგო') || '';
    const amount = pay.match(/^(\d+(?:\.\d+)?)\s*ლარი$/);
    if (amount) {
      j.salaryMin = number(Number(amount[1]));
      j.currency = 'GEL';
      j.salary = salaryText(j.salaryMin, null, 'GEL', '');
    }
    const detailLabels = [
      'ორგანიზაციის შესახებ',
      'ფუნქციები',
      'მინიმალური განათლება',
      'საკონკურსო თემატიკა',
      'დამატებითი მოთხოვნები',
      'დამატებითი ინფორმაცია',
      'გადაწყვეტილების მიღების ფორმა და ვადა',
    ];
    j.description = detailLabels
      .filter((k) => fields.has(k))
      .map((k) => k + '\n' + fields.get(k))
      .join('\n\n');
    for (const label of [
      'კონკურსის ტიპი',
      'ადგილების რაოდენობა',
      'გამოსაცდელი ვადა',
      'მინიმალური განათლება',
    ])
      if (fields.has(label)) j.facts.push({ label, value: fields.get(label)! });
  } else {
    const cells = $('.dtitle');
    j.title = cells.eq(0).find('b').first().text().trim();
    j.company = cells.eq(1).find('b').first().text().trim();
    j.description = cleanText(
      cells.last().closest('tr').next().find('td').html() || '',
    );
    const body = cells.last().closest('tr').next().find('td').first();
    // Jobs.ge mixes unrelated client banners into the description table. Leave logo empty unless the editor selects one.
    j.logoUrl = '';
    body.find('a[href]').each((_, el) => {
      const href = safeExternalUrl($(el).attr('href') || '', url);
      if (href)
        j.applicationLinks!.push({
          label: $(el).text().trim().slice(0, 150) || new URL(href).hostname,
          url: href,
        });
    });
    const dates = cells
      .eq(2)
      .find('b')
      .map((_, el) => $(el).text().trim())
      .get();
    const today = tbilisiDate();
    const year = Number(today.slice(0, 4));
    const pub = georgianDate(dates[0] || '', year);
    if (pub && pub > today) j.datePosted = georgianDate(dates[0], year - 1);
    else j.datePosted = pub;
    j.deadline = georgianDate(
      dates[1] || '',
      Number(j.datePosted.slice(0, 4)) || year,
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
  if (source === 'hr')
    $('.description')
      .first()
      .find('a[href]')
      .each((_, el) => {
        const href = safeExternalUrl($(el).attr('href') || '', url);
        if (href)
          j.applicationLinks!.push({
            label: $(el).text().trim().slice(0, 150) || new URL(href).hostname,
            url: href,
          });
      });
  j.applicationLinks = [
    ...new Map(j.applicationLinks.map((l) => [l.url, l])).values(),
  ].slice(0, 12);
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

// Rotate a bounded extra listing page; always fetch page one as well for fresh vacancies.
export function additionalListing(
  source: SourceId,
  html: string,
  cursor: number,
): string | null {
  const key = source === 'ss' ? 'page' : source === 'hrgov' ? 'pageNo' : null;
  if (!key) return null;
  const $ = load(html);
  let last = 1;
  $('a[href]').each((_, el) => {
    try {
      const u = new URL($(el).attr('href')!, legacyConfigs[source].list);
      const p = Number(u.searchParams.get(key));
      if (
        u.origin === legacyConfigs[source].origin &&
        u.pathname === new URL(legacyConfigs[source].list).pathname &&
        Number.isInteger(p) &&
        p > 1 &&
        p <= 1000
      )
        last = Math.max(last, p);
    } catch {}
  });
  if (source === 'ss') {
    // The visible pager only exposes nearby pages, but public SSR state gives the full count.
    try {
      const result = JSON.parse($('#__NEXT_DATA__').text()).props.pageProps
        .searchInitData.result;
      const size = Array.isArray(result.items) ? result.items.length : 0;
      const total = result.totalCount;
      if (size > 0 && Number.isInteger(total) && total >= size) {
        last = Math.max(last, Math.min(1000, Math.ceil(total / size)));
      }
    } catch {
      /* Fall back to observed links when public state changes. */
    }
  }
  if (last < 2) return null;
  const u = new URL(legacyConfigs[source].list);
  u.searchParams.set(key, String(2 + (Math.max(0, cursor) % (last - 1))));
  return u.href;
}
export const sourceLockIds: Record<SourceId, number> = {
  hr: 917410,
  samushao: 917411,
  jobs: 917412,
  ss: 917413,
  hrgov: 917414,
};

// Georgian listings omit the year; compare against their local calendar date, including around midnight/New Year.
export function tbilisiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
