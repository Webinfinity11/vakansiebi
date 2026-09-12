import { sourceNames, type Vacancy } from '../../lib/types';
import { explicitWorkCity } from '../../lib/work-location';
import { UnavailableVacancy } from './index';
import type { ListedLink, ListingInfo, SourceModule } from './module';
import classifications from './worknet-classifications.json' with { type: 'json' };

/**
 * worknet.moh.gov.ge, the public employment agency's board. The site is client-rendered, so the
 * listing and the detail are both read from its public JSON API; the catalogue still links to the
 * public vacancy page, which is what identifies a record.
 *
 * The API also returns the employer's tax id and the name of the person who filed the vacancy.
 * Neither is public on the site, so neither is read.
 */
const api = 'https://worknet-api.moh.gov.ge/api/Vacancy';

/**
 * Region names are not exposed publicly (the Region classification endpoint needs a login), so
 * only ids whose sampled vacancy streets identify the region beyond doubt are named; anything else
 * stays unmapped rather than guessed. Samples read on 2026-09-12: 28 ოქროყანა; 90 ბათუმი streets;
 * 19 თელავი, ყვარელი; 72 ქუთაისი streets (ნიკეა, ირ. აბაშიძე, ფალიაშვილი) and სოფ. ქვიტირი;
 * 62 მცხეთა, დუშეთი, ნიჩბისი; 1 ფოთი; 97 გორი; 11 მარნეული, რუსთავი; 85 ამბროლაური, ონი;
 * 55 ახალციხე streets, აბასთუმანი, სვირი; 68 ოზურგეთი streets, გაღმა დვაბზუ.
 */
const regions: Record<number, string> = {
  28: 'თბილისი',
  90: 'აჭარა',
  19: 'კახეთი',
  72: 'იმერეთი',
  62: 'მცხეთა-მთიანეთი',
  1: 'სამეგრელო-ზემო სვანეთი',
  97: 'შიდა ქართლი',
  11: 'ქვემო ქართლი',
  85: 'რაჭა-ლეჩხუმი და ქვემო სვანეთი',
  55: 'სამცხე-ჯავახეთი',
  68: 'გურია',
};
const contractTypes: Record<string, string> = {
  სრული: 'სრული განაკვეთი',
  არასრული: 'ნახევარი განაკვეთი',
  ცვლებში: 'სამუშაო ცვლაში',
};
const modes = ['დისტანციური', 'ადგილზე', 'ჰიბრიდული'];

type Group = keyof typeof classifications;
type Data = Record<string, unknown>;
const record = (value: unknown): Data | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Data)
    : null;
const parse = (text: string): Data | null => {
  try {
    return record(JSON.parse(text));
  } catch {
    return null;
  }
};
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const bounded = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= max
    ? value
    : null;
const dateOnly = (value: unknown) => {
  const day = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
    ? day
    : '';
};
/** Names for a classification's ids; unknown ids are dropped, never shown as numbers. */
const names = (group: Group, ids: unknown): string[] => {
  const table: Record<string, string> = classifications[group];
  return [
    ...new Set(
      list(ids)
        .filter((id): id is number => Number.isSafeInteger(id))
        .map((id) => table[String(id)] || '')
        .filter(Boolean),
    ),
  ];
};
const numericId = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) > 0 ? String(value) : '';

export const worknet: SourceModule = {
  config: {
    origin: 'https://worknet.moh.gov.ge',
    list: `${api}/All?pageIndex=1&pageSize=100`,
    sitemap: null,
    hosts: ['worknet.moh.gov.ge', 'worknet-api.moh.gov.ge'],
  },
  externalId: (u) =>
    u.hostname === 'worknet.moh.gov.ge'
      ? (u.pathname.match(/^\/ka\/vacancies\/(\d+)\/?$/)?.[1] ?? null)
      : null,
  publicUrl: (id) => `https://worknet.moh.gov.ge/ka/vacancies/${id}`,
  detailRequestUrl(url) {
    const id = worknet.externalId(new URL(url));
    if (!id) throw Error('Not a worknet vacancy URL');
    return `${api}/Id?Id=${id}`;
  },
  listingUrl: (page) => `${api}/All?pageIndex=${page}&pageSize=100`,
  listingInfo(text): ListingInfo {
    const data = parse(text);
    const items = Array.isArray(data?.items) ? data.items : null;
    return {
      reportedTotal: bounded(data?.totalCount, 1000000),
      pageSize: items ? bounded(items.length, 500) : null,
      totalPages: bounded(data?.totalPages, 1000),
    };
  },
  listLinks(text) {
    const result = new Map<string, ListedLink>();
    for (const raw of list(parse(text)?.items)) {
      const item = record(raw);
      const id = item ? numericId(item.id) : '';
      if (!item || !id || item.vacancyStatusId !== 1) continue;
      // The listing names the agency's occupation for the vacancy while the detail does not, so
      // it travels as the source's own label and becomes the პროფესია fact at parse time.
      const occupation = str(item.occupationName).replace(/\s+/g, ' ').trim();
      result.set(id, {
        externalId: id,
        url: worknet.publicUrl(id),
        hints: {
          salaried: /^\d+$/.test(str(item.exactSalary).trim()),
          ...(occupation ? { categoryLabel: occupation.slice(0, 150) } : {}),
        },
      });
    }
    return [...result.values()];
  },
  parseDetail(text, url, hints): Vacancy {
    const id = worknet.externalId(new URL(url));
    const data = parse(text);
    if (!id || !data || String(data.id) !== id)
      throw Error('Worknet vacancy data missing or mismatched');
    if (data.vacancyStatusId !== 1 || data.isCanceled === true)
      throw new UnavailableVacancy();
    const facts: { label: string; value: string }[] = [];
    const lines: string[] = [];
    const section = (label: string, value: string, fact = true, max = 300) => {
      const shown = value.replace(/\s+/g, ' ').trim().slice(0, max);
      if (!shown) return;
      lines.push(`${label}: ${shown}`);
      if (fact) facts.push({ label, value: shown });
    };
    const locations = list(data.locations).map(record).filter(Boolean) as Data[];
    const streets = [
      ...new Set(locations.map((l) => str(l.street).replace(/\s+/g, ' ').trim())),
    ].filter(Boolean);
    const regionIds = [
      ...new Set(locations.map((l) => l.regionId).filter(Number.isSafeInteger)),
    ] as number[];
    const contracts = names('WorkContract', data.workContractIds);
    const experience = names('ExperienceLevel', data.experienceLevelIds);
    const years = bounded(data.experienceYear, 60);
    const languages = new Map<number, string>();
    for (const raw of list(data.languageKnowledges)) {
      const k = record(raw);
      const languageId = k?.languageId;
      // Speaking, reading and writing arrive as separate rows for one language.
      if (!k || !Number.isSafeInteger(languageId) || languages.has(languageId as number))
        continue;
      const name = names('Language', [languageId])[0];
      const level = names('LanguageLevel', [k.languageLevelId])[0];
      if (name) languages.set(languageId as number, level ? `${name} (${level})` : name);
    }

    // The agency's pay is monthly in lari: an exact figure when the employer gave one, otherwise
    // its bracket. Anything else the employer typed is kept as written.
    const exact = str(data.exactSalary).replace(/\s+/g, ' ').trim();
    const range = names('SalaryRange', data.salaryRangeIds)[0] || '';
    const bounds = range.match(/^(\d+)-(\d+)$/);
    const amount = /^\d+$/.test(exact) ? bounded(Number(exact), 100000000) : null;
    let salary = '';
    let salaryMin: number | null = null;
    let currency = '';
    let salaryPeriod = '';
    if (amount) {
      salary = `${amount} ₾ / თვე`;
      salaryMin = amount;
      currency = 'GEL';
      salaryPeriod = 'თვე';
    } else if (bounds && Number(bounds[1]) <= Number(bounds[2])) {
      salary = `${bounds[1]}–${bounds[2]} ₾ / თვე`;
      salaryMin = bounded(Number(bounds[1]), 100000000);
      currency = 'GEL';
      salaryPeriod = 'თვე';
    } else if (/შეთან/.test(exact) || /შეთან/.test(range)) salary = 'შეთანხმებით';
    else salary = exact.slice(0, 300);

    section(
      'პროფესია',
      str(data.occupationName) || hints?.categoryLabel || '',
      true,
      150,
    );
    section('სამუშაო ადგილი', streets.join('; '), true, 500);
    const openings = bounded(data.numberOfVacancies, 10000);
    if (openings) section('ვაკანსიების რაოდენობა', String(openings));
    section('ხელფასი', amount ? salary : exact || range, false);
    section('სამუშაო გრაფიკი', names('WorkSchedule', data.workScheduleIds).join(', '));
    section('დასაქმების ფორმა', contracts.join(', '));
    section(
      'გამოცდილება',
      experience.length ? experience.join(', ') : years ? `${years} წელი` : '',
    );
    section('ენები', [...languages.values()].join(', '));
    section('უნარები', names('Skill', data.skillIds).join(', '), false, 1500);
    section('ბენეფიტები', names('Incentive', data.incentiveIds).join(', '));

    const original = str(data.description)
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    // A street names the city when it can; otherwise the region stands in, never a guess.
    const region = regionIds.length === 1 ? regions[regionIds[0]] || '' : '';
    return {
      title: str(data.vacancyName),
      company: str(data.organizationName),
      city: explicitWorkCity({ description: '', facts }) || region,
      category: 'სხვა',
      salary,
      salaryMin,
      currency,
      salaryPeriod,
      mode: names('SpecialWorkCondition', data.specialWorkConditionIds).find((m) =>
        modes.includes(m),
      ) || '',
      employmentType: contractTypes[contracts[0]] || '',
      description: [original, lines.join('\n')].filter(Boolean).join('\n\n'),
      url,
      source: sourceNames.worknet,
      deadline: dateOnly(data.endDate),
      datePosted: dateOnly(data.startDate),
      logoUrl: '',
      facts: facts.slice(0, 20),
      applicationLinks: [],
      warnings: [],
    };
  },
  maxResponseBytes: 16000000,
};
