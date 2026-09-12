import { z } from 'zod';
import { readSearch } from '../search-state';
import { searchGroups } from '../search-language';
import { escapeRegex, termPattern } from '../job-intelligence';
import { requiredExperiencePattern } from '../experience';
import { cities, cityStem, otherCity } from '../cities';

export const filterLabels = {
  query: 'საძიებო სიტყვა',
  city: 'ქალაქი',
  category: 'მიმართულება',
  source: 'პირველწყარო',
  paid: 'ხელფასი მითითებულია',
  remote: 'დისტანციური',
  salary: 'ხელფასის დიაპაზონი',
  employment: 'განაკვეთი',
  entryLevel: 'გამოცდილების გარეშე',
  postedWithin: 'გამოქვეყნების თარიღი',
};
export type FilterKey = keyof typeof filterLabels;
export type SearchMeta = {
  categories: { name: string; count: number }[];
  categoryTotal: number;
  relaxations: { key: FilterKey; label: string; count: number }[];
  suggestion: { query: string; count: number } | null;
};
export type SearchPlanOptions = {
  /**
   * Public listing mode: one row per identical posting (normalized title,
   * employer and city) survives — the most recently published — and the
   * others fold their source links into it. Employer-less classifieds are
   * never grouped. Direct lookups by id keep every row reachable.
   */
  grouped?: boolean;
  /**
   * Compute the comparable salary columns even when the query does not filter
   * or sort by pay. They are skipped by default because each one detoasts the
   * snapshot again; a caller that reads them itself, such as the category pay
   * spread, has to ask for them or it sees NULL in every row.
   */
  pricing?: boolean;
};
const normalized = (sql: string) =>
  `lower(CASE WHEN COALESCE(${sql},'') IS NFKC NORMALIZED THEN COALESCE(${sql},'') ELSE normalize(COALESCE(${sql},''),NFKC) END)`;
const today = "to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')";
export function searchPlan(
  params: URLSearchParams,
  preview = false,
  options: SearchPlanOptions = {},
) {
  const filters = readSearch(params);
  const snapshot = preview ? 'j.draft' : 'j.published';
  const args: unknown[] = [];
  const bind = (value: unknown) => {
    args.push(value);
    return `$${args.length}`;
  };
  // Every alternative carries the literal text a document must contain (cheap
  // strpos prefilter) and, unless it is a Georgian stem, the bounded regex that
  // confirms the match. Parameters stay bound; user text never enters the SQL.
  const groups = bind(
    JSON.stringify(
      searchGroups(filters.query).map((group) =>
        group.map((term) => ({ t: term, p: termPattern(term) })),
      ),
    ),
  );
  const field = (key: string) => `${snapshot}->>'${key}'`;
  const posted = preview
    ? 'j.created_at'
    : 'COALESCE(j.published_at,j.created_at)';
  const termMatch = (text: string) =>
    `EXISTS(SELECT 1 FROM jsonb_array_elements(terms) term WHERE strpos(${text},term->>'t')>0 AND (term->>'p' IS NULL OR ${text} ~ (term->>'p')))`;
  const queryMatch = (text: string) =>
    `NOT EXISTS(SELECT 1 FROM jsonb_array_elements(${groups}::jsonb) terms WHERE NOT ${termMatch(text)})`;
  const searching = Boolean(filters.query.trim());
  const grouped = Boolean(options.grouped) && !params.has('ids');
  const folding = grouped || params.has('ids');
  const pricing =
    options.pricing === true ||
    filters.salaryFrom !== null ||
    filters.salaryTo !== null ||
    filters.salaryPeriod === 'day' ||
    params.get('sort') === 'salary';
  // Every ->> on the large snapshot detoasts it again, so each scalar the plan
  // needs is pulled out exactly once behind an optimizer fence (OFFSET 0), the
  // snapshot is the only jsonb the CTE carries, and derived columns are only
  // computed for the filters, facets and orderings actually in play.
  const extracted = [
    'title',
    'company',
    'city',
    'category',
    'datePosted',
    'deadline',
    ...(filters.remote ? ['mode'] : []),
    ...(pricing ? ['salaryPeriod', 'currency'] : []),
    ...(pricing || filters.paid ? ['salary'] : []),
  ];
  const extraction = (alias: string) =>
    `SELECT ${alias}.id,${alias}.${snapshot.slice(2)},${alias}.created_at,${alias}.published_at,${alias}.needs_review,${alias}.fingerprint,${extracted.map((key) => `${alias}.${snapshot.slice(2)}->>'${key}' AS p_${key}`).join(',')}${pricing ? `,${alias}.${snapshot.slice(2)}->'salaryMin' AS p_salaryMin` : ''}`;
  const p = (key: string) => `j.p_${key}`;
  const groupKey = `CASE WHEN btrim(COALESCE(${p('company')},''))='' THEN j.id::text ELSE regexp_replace(${normalized(`concat_ws('|',${p('title')},${p('company')},${p('city')})`)},'[^[:alnum:]|]','','g') END`;
  const numericSalary = `jsonb_typeof(${p('salaryMin')})='number'`;
  const monthlyFloor = 100;
  const monthlyCeiling = 50000;
  const dailyCeiling = 500;
  const salaryAmount = `(${p('salaryMin')}#>>'{}')::numeric`;
  const unless = (needed: boolean, sql: string, empty = "''::text") =>
    needed ? sql : empty;
  const columns = [
    `${unless(searching, normalized(`concat_ws(' ',${p('title')},${p('company')},${p('city')},${field('description')})`))} AS search_document`,
    `${unless(searching || filters.remote, normalized(p('title')))} AS title_norm`,
    `${unless(searching, normalized(p('company')))} AS company_norm`,
    `${unless(filters.city !== 'ყველა', normalized(p('city')))} AS city_norm`,
    // A source date is trusted only when it is a real calendar date; ss.ge
    // sends 0001-01-01 and hr.gov.ge nothing, both fall back to our publication day.
    `COALESCE(CASE WHEN ${p('datePosted')} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ${p('datePosted')}>='2000-01-01' THEN ${p('datePosted')} END,to_char(${posted} AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')) AS posted_on`,
    // Most sources omit the period for an ordinary monthly figure; an empty
    // period is monthly unless the text itself says daily, hourly or weekly.
    /* A monthly figure is compared only when it is plausible as a month's pay. Measured on the
       public catalogue: the 99th percentile is 4,000 GEL and nothing lies between 15,000 and a
       placeholder 111,111; below 100 GEL, every record sampled was a day or shift rate a source
       form had labelled "month", or a placeholder like 1. The card still shows the source's text;
       only sorting, the pay filter and the pay spread stop ranking such a number as a wage. A
       rate per square metre, piece, kilogram or tonne is not a month's pay whatever its size. */
    `${unless(pricing, `CASE WHEN ${p('currency')}='GEL' AND ${numericSalary} AND ${salaryAmount} BETWEEN ${monthlyFloor} AND ${monthlyCeiling} AND (${p('salaryPeriod')}='თვე' OR (COALESCE(${p('salaryPeriod')},'')='' AND lower(COALESCE(${p('salary')},'')) !~ '(დღ|საათ|კვირ|hour|dail|day|week|მ²|მ2|კვ\\.?\\s*მ|ცალ|კგ|ტონ)')) THEN ${salaryAmount} END`, 'NULL::numeric')} AS salary_month`,
    /* The daily figure gets a ceiling and no floor. The top of the catalogue was a waiter at
       1,600, a bartender at 1,300 and a cleaner at 1,000 GEL "a day" — monthly wages a source form
       labelled daily — and no record lies between 300 and 999; the highest plausible one is 250.
       At the bottom, 20 or 30 GEL for a promo shift or a day of cleaning is a real day's pay, so
       nothing there is dropped. */
    `${unless(pricing, `CASE WHEN ${p('currency')}='GEL' AND ${numericSalary} AND ${salaryAmount} <= ${dailyCeiling} AND ${p('salaryPeriod')}='დღე' THEN ${salaryAmount} END`, 'NULL::numeric')} AS salary_day`,
    `${unless(folding, groupKey, 'j.id::text')} AS group_key`,
  ];
  const salary =
    filters.salaryPeriod === 'day' ? 'j.salary_day' : 'j.salary_month';
  const employmentText = normalized(
    `concat_ws(' ',${field('employmentType')},${field('title')})`,
  );
  const experienceText = normalized(
    `concat_ws(' ',${field('description')},${snapshot}->>'facts')`,
  );
  const cityCondition = () => {
    if (filters.city === 'ყველა') return 'true';
    if (filters.city === otherCity)
      return `j.city_norm<>'' AND NOT EXISTS(SELECT 1 FROM unnest(${bind([...cities])}::text[]) known WHERE strpos(j.city_norm,lower(known))>0)`;
    // A posting without a city field often names the city in its text; the
    // stem is matched at a word start so გორი never means კატეგორია.
    return `CASE WHEN strpos(j.city_norm,${bind(filters.city.normalize('NFKC').toLowerCase())})>0 THEN true WHEN j.city_norm='' THEN ${normalized(`concat_ws(' ',${p('title')},${field('description')})`)} ~ ${bind('\\m' + escapeRegex(cityStem(filters.city)))} ELSE false END`;
  };
  const conditions: Record<FilterKey, string> = {
    query: queryMatch('j.search_document'),
    city: cityCondition(),
    category:
      filters.category === 'ყველა'
        ? 'true'
        : `${p('category')}=${bind(filters.category)}`,
    source:
      filters.source === 'ყველა'
        ? 'true'
        : `j.group_key IN (SELECT m.group_key FROM members m JOIN source_items si ON si.job_id=m.id JOIN sources s ON s.id=si.source_id WHERE NOT s.retired AND s.name=${bind(filters.source)})`,
    paid: filters.paid ? `COALESCE(${p('salary')},'')<>''` : 'true',
    remote: filters.remote
      ? `(${p('mode')} IN ('დისტანციური','სამუშაო სახლიდან') OR j.title_norm ~ '(დისტანციურ|\\mremote)')`
      : 'true',
    salary: [
      filters.salaryPeriod === 'day' ? `${salary} IS NOT NULL` : 'true',
      filters.salaryFrom !== null
        ? `${salary}>=${bind(filters.salaryFrom)}`
        : 'true',
      filters.salaryTo !== null
        ? `${salary}<=${bind(filters.salaryTo)}`
        : 'true',
    ].join(' AND '),
    employment:
      filters.employment === 'all'
        ? 'true'
        : `${filters.employment === 'daily' ? normalized(`concat_ws(' ',${field('employmentType')},${field('title')},${field('description')})`) : employmentText} ~ ${bind(filters.employment === 'daily' ? '(^|[^ა-ჰa-z])(დღიური|ერთდღიანი|ერთჯერადი)[[:space:]-]+(სამუშაო|სამსახური|დასაქმება)|one[ -]day[[:space:]]+(job|work)|day[ -]labou?r' : filters.employment === 'part-time' ? '(ნახევარი?|არასრული?|ნაწილობრივი?)[[:space:]]+განაკვეთ|part[ -]?time' : 'სტაჟიორ|სტაჟირებ|\\mintern(ship)?\\M')}`,
    entryLevel: filters.entryLevel
      ? `${experienceText} ~ ${bind('გამოცდილების[[:space:]]+გარეშე|გამოცდილება[[:space:]:–-]+(არ[[:space:]]+(არის[[:space:]]+)?(სავალდებულო|აუცილებელი|საჭირო)|არ[[:space:]]+მოითხოვება)|no[[:space:]]+(previous[[:space:]]+|prior[[:space:]]+)?experience[[:space:]]+(is[[:space:]]+)?(required|needed|necessary)|experience[[:space:]]+(is[[:space:]]+)?not[[:space:]]+(required|needed|necessary)')}`
      : 'true',
    postedWithin: filters.postedWithin
      ? `j.posted_on BETWEEN to_char((now() AT TIME ZONE 'Asia/Tbilisi')::date-(${bind(filters.postedWithin)}::int-1),'YYYY-MM-DD') AND ${today}`
      : 'true',
  };
  // The predicate every public surface shares: published snapshot with at
  // least one active source (checked on the row), then a live deadline and no
  // procurement tenders (checked on the extracted scalars).
  let base = `${preview ? "j.status IN ('pending','published')" : "j.status='published'"} AND ${snapshot} IS NOT NULL AND EXISTS(SELECT 1 FROM source_items si JOIN sources s ON s.id=si.source_id WHERE si.job_id=j.id AND NOT s.retired)`;
  const visible = base;
  const current = `(COALESCE(${p('deadline')},'')='' OR ${p('deadline')}>=${today}) AND NOT (lower(${p('title')}) ~ '^(ტენდერი([[:space:]]|$)|tender[[:space:]]+for[[:space:]])')`;
  if (filters.entryLevel)
    conditions.entryLevel += ` AND NOT (${experienceText} ~ ${bind(requiredExperiencePattern)})`;
  if (params.has('ids'))
    base += ` AND j.id::text=ANY(${bind(
      (params.get('ids') || '')
        .split(',')
        .filter((id) => z.uuid().safeParse(id).success)
        .slice(0, 100),
    )}::text[])`;
  if (params.has('exclude'))
    base += ` AND NOT (j.id::text=ANY(${bind(
      (params.get('exclude') || '')
        .split(',')
        .filter((id) => z.uuid().safeParse(id).success)
        .slice(0, 100),
    )}::text[]))`;
  const groupRank = grouped
    ? `,row_number() OVER (PARTITION BY ${groupKey} ORDER BY ${posted} DESC NULLS LAST,j.id) AS group_rank`
    : ',1::bigint AS group_rank';
  // Members of every group present in the result. A lookup by id must also see
  // duplicates outside its restricted set; the indexed import fingerprint (the
  // same three fields, taken from the draft) narrows that scan to candidates.
  const members = params.has('ids')
    ? `SELECT j.id,${groupKey} AS group_key,${posted} AS posted_at FROM (${extraction('j')} FROM jobs j WHERE ${visible} AND j.fingerprint IN (SELECT fingerprint FROM searchable) OFFSET 0) j WHERE ${current} AND ${groupKey} IN (SELECT group_key FROM searchable)`
    : `SELECT j.id,j.group_key,${posted} AS posted_at FROM searchable j`;
  const cte = `WITH searchable AS MATERIALIZED (SELECT j.*,${columns.join(',')}${groupRank} FROM (${extraction('j')} FROM jobs j WHERE ${base} OFFSET 0) j WHERE ${current}), members AS MATERIALIZED (${members})`;
  const kept = grouped ? 'j.group_rank=1' : 'true';
  const keys = Object.keys(conditions) as FilterKey[];
  // searchable already satisfies the base predicate; only the grouping and the
  // filters are evaluated again on the page.
  const where = [kept, ...keys.map((key) => `(${conditions[key]})`)].join(
    ' AND ',
  );
  const all = (except?: FilterKey) =>
    keys
      .filter((key) => key !== except)
      .map((key) => `"${key}"`)
      .join(' AND ');
  const metrics = `${cte}, matches AS MATERIALIZED (SELECT ${p('category')} AS category_name,${keys.map((key) => `COALESCE((${conditions[key]}),false) AS "${key}"`).join(',')} FROM searchable j WHERE ${kept})
    SELECT (SELECT count(*)::int FROM matches WHERE ${all()}) total,
    (SELECT count(*)::int FROM matches WHERE ${all('category')}) category_total,
    COALESCE((SELECT jsonb_agg(c) FROM (SELECT category_name name,count(*)::int count FROM matches WHERE ${all('category')} GROUP BY category_name) c),'[]'::jsonb) categories,
    jsonb_build_object(${keys.map((key) => `'${key}',(SELECT count(*)::int FROM matches WHERE ${all(key)})`).join(',')}) relaxed`;
  // One canonical "newest" order: the posting date the filter uses, then our
  // own publication time, and finally the id so pages never overlap.
  const newest = `j.posted_on DESC,${posted} DESC`;
  let ordering = newest;
  if (params.get('sort') === 'salary')
    ordering = `${salary} DESC NULLS LAST,${newest}`;
  if (params.get('sort') === 'deadline')
    ordering = `NULLIF(${p('deadline')},'') ASC NULLS LAST,${newest}`;
  if (
    searching &&
    !['salary', 'new', 'deadline'].includes(params.get('sort') || '')
  )
    ordering = `(SELECT COALESCE(sum(CASE WHEN ${termMatch('j.title_norm')} THEN 5 ELSE 0 END + CASE WHEN ${termMatch('j.company_norm')} THEN 2 ELSE 0 END),0) FROM jsonb_array_elements(${groups}::jsonb) terms) DESC,${newest}`;
  return { where, args, ordering, metrics, filters, cte, grouped };
}
