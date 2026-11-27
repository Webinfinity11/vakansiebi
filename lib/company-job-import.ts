import type { CompanyJobForm } from './company-job-form';
import { cities, cityNamePattern } from './cities';
import { payExcerpts } from './pay-excerpts';

export const importKeys = [
  'title',
  'city',
  'mode',
  'employmentType',
  'salaryFrom',
  'salaryTo',
  'salaryBasis',
  'description',
] as const;
export type JobImportFields = Partial<
  Pick<CompanyJobForm, (typeof importKeys)[number]>
> & {
  /** Read for the public form only; a company's own form already knows both. */
  company?: string;
  email?: string;
};
const emailPattern = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u;
const companyLabel =
  /^(?:კომპანია|დამსაქმებელი|ორგანიზაცია|company|employer)\s*[:–—-]\s*(.{2,80})$/i;
const legalName =
  /(?:^|[\s(])(?:შპს|სს|ააიპ|ი\/მ|LLC|JSC|Ltd)\.?\s*(?:,,|[„"“«'])\s*([^"“”»'\n]{2,60}?)\s*(?:''|[“"”»'])/iu;
/** The employer's name and the address CVs go to, when the text states them. */
function contacts(lines: string[], source: string): Pick<JobImportFields, 'company' | 'email'> {
  const found: Pick<JobImportFields, 'company' | 'email'> = {};
  for (const line of lines) {
    const named = companyLabel.exec(line)?.[1]?.trim();
    if (named && !emailPattern.test(named)) {
      found.company = named.replace(/[.;,]$/, '');
      break;
    }
  }
  if (!found.company) {
    const legal = legalName.exec(source)?.[1]?.trim();
    if (legal) found.company = legal;
  }
  // Prefer the address next to CV/résumé wording; otherwise the first one.
  const cvLine = lines.find(
    (line) => emailPattern.test(line) && /რეზიუმე|CV|სივი|გამოგზავნ|გაგზავნ|resume|apply/i.test(line),
  );
  const email = emailPattern.exec(cvLine ?? source)?.[0];
  if (email) found.email = email.replace(/\.$/, '');
  return found;
}
const englishCities = [
  'Tbilisi',
  'Batumi',
  'Kutaisi',
  'Rustavi',
  'Gori',
  'Zugdidi',
  'Poti',
  'Telavi',
  'Kaspi',
  'Mtskheta',
  'Akhaltsikhe',
  'Borjomi',
  'Ozurgeti',
];
const titleLabel =
  /^(?:პოზიცია|თანამდებობა|ვაკანსია|პოზიციის დასახელება|job title|position|vacancy)\s*[:–—-]\s*(.+)$/i;
const sections: [RegExp, string][] = [
  [
    /^(?:(?:ძირითადი |სამუშაო )?(?:მოვალეობები|ვალდებულებები|ფუნქცია-მოვალეობები)|(?:key |main )?responsibilities|duties)$/i,
    'მოვალეობები',
  ],
  [
    /^(?:(?:საკვალიფიკაციო |ძირითადი )?მოთხოვნები|requirements|qualifications)$/i,
    'მოთხოვნები',
  ],
  [
    /^(?:პირობები|ჩვენ გთავაზობთ|რას გთავაზობთ|შეთავაზება|benefits|we offer|what we offer)$/i,
    'პირობები',
  ],
];
const boilerplate =
  /^(?:საკონტაქტო(?: ინფორმაცია)?|ელფოსტა|ტელეფონი|განაცხადების (?:მიღების )?ბოლო ვადა|ბოლო ვადა|contact|e-?mail|phone|application deadline|deadline)\s*:/i;
const salaryLabel = /^(?:[•●▪◦*–—-]\s*)?(?:(?:ფიქსირებული|საწყისი|ძირითადი|საბაზო)\s+)?(?:ხელფასი|ანაზღაურება|salary|pay|base salary)\s*:/i;
function salary(
  line: string,
): Pick<JobImportFields, 'salaryFrom' | 'salaryTo' | 'salaryBasis'> | null {
  line = line
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1')
    // "2500gel", "GEL 3000": the currency is read wherever it stands.
    .replace(/(\d)\s*gel(?![a-z])/gi, '$1 GEL')
    .replace(/(?<![a-z])GEL\s*(\d[\d ]*\d|\d)(?!\s*GEL)/gi, '$1 GEL')
    .replace(/(\d[\d ]*)(?=\s+(?:net|gross)\b)/gi, '$1 GEL')
    // A bonus or tips added on top do not change the base amount.
    .replace(/\(?\s*\+\s*(?:ბონუს[\p{L}]*|პრემი[\p{L}]*|bonus(?:es)?|tips)[^)\n]*\)?/giu, ' ')
    .replace(/\s+და\s+(?:ბონუს[\p{L}]*|პრემი[\p{L}]*)[^\n]*$/iu, ' ');
  if (
    !/(?:ლარი|ლარიდან|ლარამდე|₾|GEL(?![a-z]))/i.test(line) ||
    /შეთანხმებით|negotiable|ცვლაში|ცვლაზე|დღი|დღე|საათ|კვირ|წლიურ|წელიწად|daily|day|hour|week|annual|annum|year|USD|EUR|\$|€|%|ბონუს|bonus|\d[,.]\d{1,2}(?!\d)/i.test(
      line,
    )
  )
    return null;
  line = line
    .replace(/ლარიდან/g, 'ლარი დან')
    .replace(/ლარამდე/g, 'ლარი მდე')
    .replace(/-დან/g, ' დან')
    .replace(/-მდე/g, ' მდე');
  const n = '(\\d{1,3}(?:[ \\u00a0]\\d{3})+|\\d{1,7})';
  const range = new RegExp(
    n +
      '\\s*(?:ლარი|ლარიდან|₾|GEL)?\\s*(?:[-–—]|დან|to)\\s*' +
      n +
      '\\s*(?:ლარამდე|ლარი|₾|GEL)?(?:-?მდე)?',
    'i',
  ).exec(line);
  if (
    !range &&
    /მდე|up to|maximum|მაქსიმუმ|დაახლოებით|approx|about|negotiable|შეთანხმებით/i.test(
      line,
    )
  )
    return null;
  const single = new RegExp(
    '(?:GEL\\s*' + n + '|' + n + '\\s*(?:ლარი|₾|GEL))',
    'i',
  ).exec(line);
  const from = (range?.[1] ?? single?.[1] ?? single?.[2])?.replace(/\s/g, '');
  const to = range?.[2]?.replace(/\s/g, '');
  if (
    !from ||
    +from < 1 ||
    +from > 1000000 ||
    (to && (+to < +from || +to > 1000000))
  )
    return null;
  return {
    salaryFrom: from,
    ...(to ? { salaryTo: to } : {}),
    ...(/დარიცხული|დაბეგვრამდე|\bgross\b/i.test(line)
      ? { salaryBasis: 'დარიცხული' as const }
      : {}),
  };
}
export function parseJobText(text: string): JobImportFields {
  const source = text
    .slice(0, 100000)
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/\p{Cc}/gu, (char) =>
      char === '\n' || char === '\t' ? char : '',
    );
  if ((source.match(/\p{L}/gu)?.length ?? 0) < 8) return {};
  const lines = source
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim());
  const fields: JobImportFields = {};
  let titleIndex = -1;
  // Whole words only: "ბარისტა" and "დანადგარის" contain "არის" but are titles.
  const sentenceWord =
    /(?:^|[^\p{L}])(?:კომპანია|შპს|ვაკანსიები|ვეძებთ|ეძებს|ვაცხადებთ|აცხადებს|არის|გუნდში|ჩვენ|ჩვენს|საჭიროა|company|llc|ltd|inc|we|is|are|must|should|hiring)(?=$|[^\p{L}])/iu;
  const validTitle = (title: string) =>
    title.length >= 3 &&
    title.length <= 120 &&
    title.split(/\s+/).length <= 12 &&
    !/[:@]|[.!?]$|^ვაკანსია!?$|^vacanc(?:y|ies)$/i.test(title) &&
    !sentenceWord.test(title) &&
    !/^(?:მდებარეობა|ადგილმდებარეობა|სამუშაო (?:გრაფიკი|საათები|ადგილი)|განაკვეთი|ხელფასი|ანაზღაურება)/i.test(title) &&
    !sections.some(([pattern]) => pattern.test(title));
  // Explicit role labels beat banners and introductory recruitment sentences.
  for (const [index, line] of lines.entries()) {
    const title = titleLabel.exec(line)?.[1]?.trim();
    if (title && validTitle(title)) {
      fields.title = title;
      titleIndex = index;
      break;
    }
  }
  // A pasted vacancy usually starts with its title on a line of its own.
  if (!fields.title) {
    const first = lines.findIndex(Boolean);
    const heading = lines[first] ?? '';
    if (validTitle(heading)) {
      // "SALES CONSULTANT" reads as "Sales Consultant".
      fields.title = /^[A-Z0-9 &/-]{4,}$/.test(heading)
        ? heading.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
        : heading;
      titleIndex = first;
    }
  }
  if (!fields.title) {
    for (const [index, line] of lines.entries()) {
      const announced = /აცხადებს ვაკანსიას\s+(.+?)\s+პოზიციაზე[.!]?$/i.exec(
        line,
      )?.[1];
      const wanted = /^(?:ჩვენ )?ვეძებთ\s+(.+?)[.!]?$/i.exec(line)?.[1];
      const hiring = /^.+?\bis hiring\s+(.+?)[.!]?$/i.exec(line)?.[1];
      const title =
        announced?.replace(/-ის$/, '').replace(/ის$/, 'ი') ??
        wanted?.replace(/-ს$/, '').replace(/([\p{L}])ს$/u, '$1ი') ??
        hiring;
      if (title && validTitle(title)) {
        fields.title = title;
        // A whole sentence stays in the description; only a bare heading is dropped.
        break;
      }
    }
  }
  const locationLines = lines.filter((line) =>
    /^(?:მდებარეობა|ადგილმდებარეობა|ლოკაცია|სამუშაო ადგილი|location)\s*[:–—-]/i.test(
      line,
    ),
  );
  const locationText = locationLines.length ? locationLines.join('\n') : source;
  const matchedCities = cities.filter((city, index) =>
    new RegExp(
      '(?:^|[^\\p{L}])(?:' +
        cityNamePattern(city) +
        '|' +
        englishCities[index] +
        ')(?=$|[^\\p{L}])',
      'iu',
    ).test(locationText),
  );
  if (matchedCities.length === 1) fields.city = matchedCities[0];
  const positiveModes = source
    .replace(
      /(?:არ არის|არ იქნება|არ ვმუშაობთ|not|non[- ]?)\s*(?:დისტანციურ[\p{L}]*|remote|ჰიბრიდულ[\p{L}]*|hybrid|ადგილზე|ოფისიდან|on[- ]site)/giu,
      '',
    )
    .replace(
      /(?:დისტანციურ[\p{L}]*|remote|ჰიბრიდულ[\p{L}]*|hybrid)\s+(?:არ არის|არ იქნება|is not available)/giu,
      '',
    );
  if (/ჰიბრიდულ|\bhybrid\b/i.test(positiveModes)) fields.mode = 'ჰიბრიდული';
  else if (/დისტანციურ|\bremote\b|სახლიდან მუშაობა/i.test(positiveModes))
    fields.mode = 'დისტანციური';
  else if (/ოფისიდან|ადგილზე|\bon[- ]site\b/i.test(positiveModes))
    fields.mode = 'ადგილზე';
  if (
    /ნახევარ(?:ი)? განაკვეთ|არასრული (?:განაკვეთი|სამუშაო დღე)|\bpart[ -]time\b|\bhalf[ -]time\b/i.test(
      source,
    )
  )
    fields.employmentType = 'ნახევარი განაკვეთი';
  const salaryLines = lines
    .map((line, index) => {
      // A period on its own line still qualifies the amount above it.
      const next = lines[index + 1] ?? '';
      const context =
        /^(?:per |daily|hourly|weekly|annually|დღეში|დღიური|საათში|საათობრივი|კვირაში|წელიწადში)/i.test(
          next,
        )
          ? line + ' ' + next
          : line;
      return { line, index, value: salary(context) };
    })
    .filter((item) => item.value);
  // The shared scraper helper also counts labelled unsafe/negotiable offers.
  const payCandidates = payExcerpts(source);
  // Several amounts: only a single "ხელფასი:" line, with no other pay label beside it, decides.
  const labelled = lines.filter((line) => salaryLabel.test(line)).length === 1
    ? salaryLines.filter((item) => salaryLabel.test(item.line))
    : [];
  if (salaryLines.length === 1 && payCandidates.length <= 1)
    Object.assign(fields, salaryLines[0].value);
  else if (labelled.length === 1) Object.assign(fields, labelled[0].value);
  const body = lines
    .filter(
      (line, index) =>
        index !== titleIndex &&
        !(fields.title && line.trim().toLowerCase() === fields.title.trim().toLowerCase()) &&
        !boilerplate.test(line) &&
        !(
          fields.salaryFrom &&
          index === (salaryLines.length === 1 ? salaryLines[0] : labelled[0])?.index &&
          (salaryLabel.test(line) || /^[\d\s₾–—-]+(?:ლარი|GEL|₾)/i.test(line))
        ),
    )
    .map((line) => {
      const plain = line.replace(/[:：]$/, '').trim();
      const section = sections.find(([pattern]) => pattern.test(plain));
      return section
        ? section[1]
        : line.replace(/^(?:[•●▪◦*–—-]|\d+[.)])\s+/, '• ');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20000);
  if ((body.match(/\p{L}/gu)?.length ?? 0) >= 20) fields.description = body;
  Object.assign(fields, contacts(lines, source));
  return fields;
}
export function mergeJobImport(
  form: CompanyJobForm,
  defaults: CompanyJobForm,
  imported: JobImportFields,
): {
  form: CompanyJobForm;
  filled: (keyof CompanyJobForm)[];
  kept: (keyof CompanyJobForm)[];
} {
  const next = { ...form };
  const filled: (keyof CompanyJobForm)[] = [],
    kept: (keyof CompanyJobForm)[] = [];
  for (const key of importKeys) {
    const value = imported[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (
      key === 'salaryBasis' &&
      !filled.includes('salaryFrom') &&
      !filled.includes('salaryTo')
    ) {
      kept.push(key);
      continue;
    }
    if (!form[key]?.trim() || form[key] === defaults[key]) {
      Object.assign(next, { [key]: value });
      filled.push(key);
    } else kept.push(key);
  }
  return { form: next, filled, kept };
}

/** Avoid treating a short edit or a lone heading as a pasted vacancy. */
export function looksLikeVacancyText(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  return (
    letters >= 200 ||
    (letters >= 120 &&
      text.split(/\r?\n/).filter((line) => line.trim()).length >= 4)
  );
}
