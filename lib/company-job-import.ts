import type { CompanyJobForm } from './company-job-form';
import { cities, cityNamePattern } from './cities';

export const importKeys = [
  'title',
  'city',
  'mode',
  'employmentType',
  'salaryFrom',
  'salaryTo',
  'description',
] as const;
export type JobImportFields = Partial<
  Pick<CompanyJobForm, (typeof importKeys)[number]>
>;
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
const salaryLabel = /^(?:ხელფასი|ანაზღაურება|salary|pay)\s*:/i;
function salary(
  line: string,
): Pick<JobImportFields, 'salaryFrom' | 'salaryTo'> | null {
  if (
    !/(?:ლარი|ლარიდან|ლარამდე|₾|\bGEL\b)/i.test(line) ||
    /დღი|დღე|საათ|კვირ|წლიურ|daily|day|hour|week|annual|annum|year|USD|EUR|\$|€|%|ბონუს|bonus|\d[,.]\d{1,2}(?!\d)/i.test(
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
  return { salaryFrom: from, ...(to ? { salaryTo: to } : {}) };
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
  let titleIndex = lines.findIndex((line) => titleLabel.test(line));
  if (titleIndex >= 0) {
    const title = titleLabel.exec(lines[titleIndex])![1];
    if (title.length <= 120) fields.title = title;
    else titleIndex = -1;
  } else {
    const first = lines.findIndex(Boolean);
    const heading = lines[first] ?? '';
    if (
      heading.length >= 4 &&
      heading.length <= 120 &&
      heading.split(/\s+/).length <= 10 &&
      !/[:.!?@]|კომპანია|შპს|სს |company|\b(?:llc|ltd|inc)\b|ვაკანსიები|^ვაკანსია$|^vacanc(?:y|ies)$|^we are|^ჩვენ/i.test(
        heading,
      ) &&
      !sections.some(([r]) => r.test(heading)) &&
      !/\d/.test(heading)
    ) {
      fields.title = heading;
      titleIndex = first;
    }
  }
  const matchedCities = cities.filter((city, index) =>
    new RegExp(
      '(?:^|[^\\p{L}])(?:' +
        cityNamePattern(city) +
        '|' +
        englishCities[index] +
        ')(?=$|[^\\p{L}])',
      'iu',
    ).test(source),
  );
  if (matchedCities.length === 1) fields.city = matchedCities[0];
  if (/ჰიბრიდულ|\bhybrid\b/i.test(source)) fields.mode = 'ჰიბრიდული';
  else if (
    /დისტანციურ|\bremote\b/i.test(source) &&
    !/not remote|არ არის დისტანციური/i.test(source)
  )
    fields.mode = 'დისტანციური';
  if (/ნახევარ(?:ი)? განაკვეთ|\bpart[ -]time\b|\bhalf[ -]time\b/i.test(source))
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
  if (salaryLines.length === 1) Object.assign(fields, salaryLines[0].value);
  const body = lines
    .filter(
      (line, index) =>
        index !== titleIndex &&
        !boilerplate.test(line) &&
        !(
          salaryLines.length === 1 &&
          index === salaryLines[0].index &&
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
    if (!form[key]?.trim() || form[key] === defaults[key]) {
      Object.assign(next, { [key]: value });
      filled.push(key);
    } else kept.push(key);
  }
  return { form: next, filled, kept };
}
