import { z } from 'zod';
import { readSearch } from '../search-state';
import { searchGroups } from '../search-language';

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
const normalized = (sql: string) =>
  `lower(CASE WHEN COALESCE(${sql},'') IS NFKC NORMALIZED THEN COALESCE(${sql},'') ELSE normalize(COALESCE(${sql},''),NFKC) END)`;
export function searchPlan(params: URLSearchParams, preview = false) {
  const filters = readSearch(params);
  const snapshot = preview ? 'j.draft' : 'j.published';
  const args: unknown[] = [];
  const bind = (value: unknown) => {
    args.push(value);
    return `$${args.length}`;
  };
  const groups = bind(JSON.stringify(searchGroups(filters.query)));
  const documentExpression = normalized(
    `concat_ws(' ',${snapshot}->>'title',${snapshot}->>'company',${snapshot}->>'city',${snapshot}->>'description')`,
  );
  const queryMatch = (text: string) =>
    `NOT EXISTS(SELECT 1 FROM jsonb_array_elements(${groups}::jsonb) terms WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(terms) term WHERE strpos(${text},term)>0))`;
  const field = (key: string) => `${snapshot}->>'${key}'`;
  const salary = `CASE WHEN ${field('currency')}='GEL' AND ${field('salaryPeriod')}='${filters.salaryPeriod === 'day' ? 'დღე' : 'თვე'}' AND jsonb_typeof(${snapshot}->'salaryMin')='number' THEN (${field('salaryMin')})::numeric END`;
  const employmentText = normalized(
    `concat_ws(' ',${field('employmentType')},${field('title')})`,
  );
  const experienceText = normalized(
    `concat_ws(' ',${field('description')},${snapshot}->>'facts')`,
  );
  const conditions: Record<FilterKey, string> = {
    query: queryMatch('j.search_document'),
    city:
      filters.city === 'ყველა'
        ? 'true'
        : `strpos(${normalized(field('city'))},${bind(filters.city.toLowerCase())})>0`,
    category:
      filters.category === 'ყველა'
        ? 'true'
        : `${field('category')}=${bind(filters.category)}`,
    source:
      filters.source === 'ყველა'
        ? 'true'
        : `EXISTS(SELECT 1 FROM source_items si JOIN sources s ON s.id=si.source_id WHERE si.job_id=j.id AND NOT s.retired AND s.name=${bind(filters.source)})`,
    paid: filters.paid ? `COALESCE(${field('salary')},'')<>''` : 'true',
    remote: filters.remote ? `${field('mode')}='დისტანციური'` : 'true',
    salary: [
      filters.salaryPeriod === 'day'
        ? `${field('salaryPeriod')}='დღე' AND ${field('currency')}='GEL'`
        : 'true',
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
      ? `${field('datePosted')} BETWEEN to_char((now() AT TIME ZONE 'Asia/Tbilisi')::date-(${bind(filters.postedWithin)}::int-1),'YYYY-MM-DD') AND to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')`
      : 'true',
  };
  let base = `${preview ? "j.status IN ('pending','published')" : "j.status='published'"} AND ${snapshot} IS NOT NULL AND (COALESCE(${field('deadline')},'')='' OR ${field('deadline')}>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')) AND EXISTS(SELECT 1 FROM source_items si JOIN sources s ON s.id=si.source_id WHERE si.job_id=j.id AND NOT s.retired)`;
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
  const cte = `WITH searchable AS MATERIALIZED (SELECT j.*,${filters.query.trim() ? documentExpression : "''::text"} AS search_document FROM jobs j WHERE ${base})`;
  const keys = Object.keys(conditions) as FilterKey[];
  const where = [base, ...keys.map((key) => `(${conditions[key]})`)].join(
    ' AND ',
  );
  const all = (except?: FilterKey) =>
    keys
      .filter((key) => key !== except)
      .map((key) => `"${key}"`)
      .join(' AND ');
  const metrics = `${cte}, matches AS MATERIALIZED (SELECT ${field('category')} AS category_name,${keys.map((key) => `COALESCE((${conditions[key]}),false) AS "${key}"`).join(',')} FROM searchable j)
    SELECT (SELECT count(*)::int FROM matches WHERE ${all()}) total,
    (SELECT count(*)::int FROM matches WHERE ${all('category')}) category_total,
    COALESCE((SELECT jsonb_agg(c) FROM (SELECT category_name name,count(*)::int count FROM matches WHERE ${all('category')} GROUP BY category_name) c),'[]'::jsonb) categories,
    jsonb_build_object(${keys.map((key) => `'${key}',(SELECT count(*)::int FROM matches WHERE ${all(key)})`).join(',')}) relaxed`;
  const posted = preview ? 'j.created_at' : 'j.published_at';
  let ordering = `${posted} DESC`;
  if (params.get('sort') === 'salary')
    ordering = `${salary} DESC NULLS LAST,${posted} DESC`;
  if (params.get('sort') === 'deadline')
    ordering = `NULLIF(${field('deadline')},'') ASC NULLS LAST,${posted} DESC`;
  if (
    filters.query.trim() &&
    !['salary', 'new', 'deadline'].includes(params.get('sort') || '')
  )
    ordering = `(SELECT COALESCE(sum(CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(terms) term WHERE strpos(${normalized(field('title'))},term)>0) THEN 5 ELSE 0 END + CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(terms) term WHERE strpos(${normalized(field('company'))},term)>0) THEN 2 ELSE 0 END),0) FROM jsonb_array_elements(${groups}::jsonb) terms) DESC,${posted} DESC`;
  return { where, args, ordering, metrics, filters, cte };
}
