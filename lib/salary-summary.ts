/** Public salary labels contain a price/range, an explicit negotiation label or nothing.
 * Keep original pay text in the source record/description; never render it as a fallback. */
// Thousands may be grouped by a space, or by a comma/dot a space follows ("1, 200").
const number = String.raw`(?:\d{1,3}(?:(?:[,.][ \u00a0\u202f]?|[ \u00a0\u202f])\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const currency = String.raw`(?:₾|\$|€|GEL|USD|EUR|ლარ(?:იდან|ამდე|ია|ის|ს|ი)?|ლ\.?|დოლარ(?:იდან|ამდე|ია|ის|ს|ი)?|ევრო(?:დან|მდე|ს)?)`;
const unit = (value: string) =>
  /₾|GEL|^ლ/i.test(value) ? '₾' : /\$|USD|დოლარ/i.test(value) ? '$' : '€';
const amount = (value: string) => {
  const compact = value.replace(/[ \u00a0\u202f]/g, '');
  const decimals = compact.match(/[.,](\d{1,2})$/)?.[1];
  const whole = (
    decimals ? compact.slice(0, -decimals.length - 1) : compact
  ).replace(/[.,]/g, '');
  const parsed = Number(whole + (decimals ? '.' + decimals : ''));
  return parsed > 0 && parsed <= 100_000_000
    ? {
        parsed,
        label:
          whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') +
          (decimals ? '.' + decimals : ''),
      }
    : null;
};
const periods: Record<string, string> = {
  თვე: 'თვე',
  month: 'თვე',
  დღე: 'დღე',
  day: 'დღე',
  საათი: 'სთ',
  hour: 'სთ',
  კვირა: 'კვირა',
  week: 'კვირა',
  წელი: 'წელი',
  year: 'წელი',
  ცვლა: 'ცვლა',
  shift: 'ცვლა',
};
const periodWords = [
  ['საკონტაქტო სთ', String.raw`საკონტაქტო\s+ს[თტ]\.?`],
  ['მ²', String.raw`მ(?:²|2)|კვადრატულ\s+მეტრ(?:ზე|ი)`],
  ['თვე', String.raw`თვეში|თვიურად|თვიური|თვე|monthly|per\s+month`],
  ['დღე', String.raw`დღეში|დღიურად|დღიური|დღე|daily|per\s+day`],
  ['სთ', String.raw`საათში|საათობრივი|საათი|სთ|hourly|per\s+hour`],
  ['კვირა', String.raw`კვირაში|კვირა|weekly|per\s+week`],
  ['წელი', String.raw`წელიწადში|წელი|annual(?:ly)?|per\s+year`],
  ['ცვლა', String.raw`ცვლაში|ცვლაზე|ცვლა|per\s+shift`],
] as const;
type Price = {
  start: number;
  end: number;
  low: string;
  high?: string;
  currency: string;
  from?: boolean;
  to?: boolean;
};

export function salarySummary(input: string, period = '') {
  const original = input.replace(/\s+/g, ' ').trim();
  if (!original || original.length > 2000) return '';
  const text = original
    .replace(
      new RegExp(
        `(${number})\\s*(ლარიდან|დოლარიდან|ევროდან)\\s*(${number})\\s*(ლარამდე|დოლარამდე|ევრომდე)`,
        'giu',
      ),
      (all, low: string, first: string, high: string, last: string) =>
        unit(first) === unit(last) ? `${low}–${high} ${unit(first)}` : all,
    )
    .replace(/(\d)\s*-?დან\s*(?=\d)/gu, '$1–')
    .replace(
      new RegExp(`(${number})\\s*\\+\\s*(${currency})(?![\\p{L}])`, 'giu'),
      '$1 $2+',
    );
  const prices: Price[] = [];
  const range = new RegExp(
    `(?<![\\d.,])(?:(${currency})\\s*)?(${number})\\s*(${currency})?\\s*[-–—]\\s*(?:(${currency})\\s*)?(${number})\\s*(${currency})?(?![\\d.,])`,
    'giu',
  );
  for (const m of text.matchAll(range)) {
    const currencies = [m[1], m[3], m[4], m[6]].filter(Boolean);
    if (!currencies.length) continue; // dates, ages and work schedules are not prices
    if (new Set(currencies.map(unit)).size !== 1) return '';
    const low = amount(m[2]),
      high = amount(m[5]);
    if (!low || !high || high.parsed < low.parsed) return '';
    prices.push({
      start: m.index!,
      end: m.index! + m[0].length,
      low: low.label,
      high: high.label,
      currency: unit(currencies[0]),
    });
  }
  // Mask ranges so their endpoints cannot become additional standalone offers.
  const rest = text.split('');
  for (const price of prices)
    for (let i = price.start; i < price.end; i++) rest[i] = ' ';
  const single = new RegExp(
    `(?<![\\d.,])(?:(${currency})\\s*(${number})|(${number})\\s*(${currency}))(?![\\p{L}\\d])`,
    'giu',
  );
  for (const m of rest.join('').matchAll(single)) {
    const value = amount(m[2] || m[3]);
    if (!value) return '';
    const curr = m[1] || m[4];
    prices.push({
      start: m.index!,
      end: m.index! + m[0].length,
      low: value.label,
      currency: unit(curr),
      from: curr.endsWith('დან'),
      to: curr.endsWith('მდე'),
    });
  }
  if (!prices.length)
    return /შეთანხმებ(?:ით|ის)|negotiable|განიხილება\s+ინდივიდუალურ|ინდივიდუალურ.*(?:განიხილება|განისაზღვრება)|განისაზღვრება.*(?:კვალიფიკაცი|გამოცდილებ)/iu.test(
      original,
    )
      ? 'შეთანხმებით'
      : '';
  // The same figure repeated ("900 ლარი · 900 ლარი") is still one offer.
  const offers = new Set(prices.map((p) => `${p.low}|${p.high}|${p.currency}`));
  // Different roles, stages, bonuses, currencies or periods are not one range.
  if (offers.size !== 1) return '';
  const price = prices[0];
  const before = text.slice(0, price.start),
    after = text.slice(price.end);
  if (/(?:^|[:(])\s*-\s*$|−\s*$/.test(before)) return '';
  if (/(?:ბონუსი|bonus|ქირა|ხარჯი|ხარჯები)\s*[:–—-]?\s*$/iu.test(before))
    return /შეთანხმებით|negotiable/iu.test(original) ? 'შეთანხმებით' : '';
  const nearBefore = before.slice(-70),
    nearAfter = after.slice(0, 70).replace(/^\s*\+\s*/, '');
  const detected = periodWords.find(
    ([, words]) =>
      new RegExp(
        `(?:${words})\\s*(?:[-–—:]\\s*)?(?:(?:გამოდის|შეადგენს)\\s*(?:[-–—:]\\s*)?)?(?:(?:დაახლოებით|საშუალოდ)\\s*)?$`,
        'iu',
      ).test(nearBefore) ||
      new RegExp(`^\\s*(?:[·/]\\s*)?(?:${words})(?![\\p{L}])`, 'iu').test(
        nearAfter,
      ),
  )?.[0];
  if (/^\s*\//.test(nearAfter) && !detected) return '';
  // "900/1050 ლარი" offers two figures, not the second one.
  if (/\d\s*\/\s*$/.test(before)) return '';
  if (/\d\s*\+\s*$/.test(before) || /^\s*\+\s*\d/.test(after)) return '';
  const rate = detected || periods[period] || '';
  const approx =
    /საშუალოდ|დაახლოებით|approx(?:imately)?|average|[≈~]/iu.test(nearBefore) ||
    /გამომუშავებით/iu.test(before);
  const upper = price.to || /მაქსიმუმ\s*$|up to\s*$|≤\s*$/iu.test(before);
  const lower = price.from || /მინიმუმ\s*$|from\s*$/iu.test(before);
  const open = /^(?:\s*[,;.]?\s*)(?:და\s+მეტი|ზემოთ|\+(?!\s*\d))/iu.test(after);
  const value =
    price.low +
    (price.high && price.high !== price.low ? '–' + price.high : '');
  const label = `${approx ? '≈ ' : ''}${upper ? '≤ ' : ''}${value}${lower || open ? '+' : ''} ${price.currency}${rate ? ' / ' + rate : ''}`;
  return label.length <= 48 ? label : '';
}

/** Preserve source-specific conditions in the description, without duplicating a plain price. */
export function salaryDetails(input: string, period = '') {
  if (!input.trim()) return '';
  const summary = salarySummary(input, period);
  if (input.trim() === summary) return '';
  if (!summary) return input.trim();
  let rest = input
    .replace(new RegExp(number, 'gu'), ' ')
    .replace(new RegExp(`(?<![\\p{L}])${currency}(?![\\p{L}])`, 'giu'), ' ');
  for (const [, words] of periodWords)
    rest = rest.replace(new RegExp(`(?:${words})(?![\\p{L}])`, 'giu'), ' ');
  rest = rest.replace(
    /შრომის|ანაზღაურება|ხელფასი|საშუალოდ|დაახლოებით|მაქსიმუმ|მინიმუმ|და მეტი|salary|compensation|approx(?:imately)?|average/giu,
    ' ',
  );
  return /\p{L}/u.test(rest) ? input.trim() : '';
}

/* The same label, read back as numbers. Google shows a salary beside a job
   result when the posting publishes one, and this catalogue holds thousands
   that do — but only the label is trustworthy: it is what the site itself
   shows, built from one price and one period, with everything ambiguous
   already refused. Approximations are refused here too: "დაახლოებით 1000 ₾" is
   an estimate, and an estimate published as a wage is a promise the employer
   never made. */
export type SalaryFacts = {
  value?: number;
  min?: number;
  max?: number;
  currency: 'GEL' | 'USD' | 'EUR';
  unit: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
};
const currencies: Record<string, SalaryFacts['currency']> = {
  '₾': 'GEL',
  $: 'USD',
  '€': 'EUR',
};
const units: Record<string, SalaryFacts['unit']> = {
  სთ: 'HOUR',
  დღე: 'DAY',
  კვირა: 'WEEK',
  თვე: 'MONTH',
  წელი: 'YEAR',
};
/* A period the posting never states. The board already reads an unqualified
   lari figure as monthly — see the salary_month column — and only where the
   text names no other rate. What counts as naming one is narrower here: the
   forms that price work ("საათში", "დღიურად", "ცალზე"), never the bare stems.
   "09:00 საათიდან 16:00 საათამდე, შაბათ-კვირას დასვენება" is a working week,
   and reading it as an hourly wage refused hundreds of the salaries this
   catalogue does publish. The price's own neighbourhood has already been read
   for a rate by the summary above; this only catches one stated further off. */
const namesAnotherRate =
  /საათში|საათობრივ|დღეში|დღიურ|კვირაში|კვირეულ|ცვლაში|ცვლაზე|hourly|daily|weekly|per\s+(?:hour|day|week)|მ²|მ2|კვ\.?\s*მ|ცალზე|კგ-?ზე|ტონა?ზე|%|პროცენტ/iu;
const digits = (text: string) => Number(text.replace(/[\s ]/g, ''));
export function salaryFacts(input: string, period = ''): SalaryFacts | null {
  const label = salarySummary(input, period);
  const read =
    /^(≈ )?(≤ )?([\d\s ]+?)(?:–([\d\s ]+?))?(\+)? (₾|\$|€)(?: \/ (.+))?$/u.exec(
      label,
    );
  if (!read) return null;
  const [, approximate, atMost, low, high, andUp, symbol, rate] = read;
  if (approximate) return null;
  const currency = currencies[symbol];
  const unit = rate
    ? units[rate]
    : currency === 'GEL' && !namesAnotherRate.test(input)
      ? 'MONTH'
      : undefined;
  if (!currency || !unit) return null;
  const from = digits(low);
  const to = high ? digits(high) : undefined;
  if (!Number.isFinite(from) || from <= 0) return null;
  if (to !== undefined && (!Number.isFinite(to) || to < from)) return null;
  /* The bands the board already trusts for its own salary filter (search-plan:
     monthlyFloor, monthlyCeiling, dailyCeiling). A "35 ₾ / თვე" is not a
     monthly wage, whoever wrote it, and publishing it as one in structured data
     puts a figure beside our name in a search result that no employer pays. */
  if (unit === 'MONTH' && (from < 100 || from > 50000)) return null;
  if (unit === 'DAY' && from > 500) return null;
  if (atMost) return { max: to ?? from, currency, unit };
  if (to !== undefined) return { min: from, max: to, currency, unit };
  if (andUp) return { min: from, currency, unit };
  return { value: from, currency, unit };
}
