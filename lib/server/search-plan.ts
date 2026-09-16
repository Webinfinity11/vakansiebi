import { subcategoryFor } from '../subcategories';
import { z } from 'zod';
import { genericCompanyKeys } from '../company-logo-identity';
import { readSearch } from '../search-state';
import { searchMatchGroups } from '../search-language';
import {
  escapeRegex,
  searchTerms,
  termPattern,
  termScope,
} from '../job-intelligence';
import { requiredExperiencePattern } from '../experience';
import { cities, cityStem, otherCity } from '../cities';
import { db } from './db';
import { ApiError } from './auth';

// Bound server work without changing pooled sessions used by the importer/admin.
// SET LOCAL is restored on both success and cancellation; a broken connection
// is discarded if rollback cannot restore it.
export async function publicRead(statement: string, args: unknown[] = []) {
  const client = await db().connect();
  let discard: Error | undefined;
  try {
    await client.query("BEGIN READ ONLY; SET LOCAL statement_timeout='12s'");
    const result = await client.query(statement, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      discard =
        rollbackError instanceof Error
          ? rollbackError
          : new Error('Public read rollback failed');
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '57014'
    )
      throw new ApiError('მოთხოვნა დაგვიანდა. სცადე ხელახლა.', 503);
    throw error;
  } finally {
    client.release(discard);
  }
}

export const filterLabels = {
  query: 'საძიებო სიტყვა',
  city: 'ქალაქი',
  category: 'მიმართულება',
  subcategory: 'ქვემიმართულება',
  source: 'პირველწყარო',
  paid: 'ხელფასი მითითებულია',
  remote: 'დისტანციური',
  salary: 'ხელფასის დიაპაზონი',
  employment: 'განაკვეთი',
  entryLevel: 'გამოცდილების გარეშე',
  postedWithin: 'გამოქვეყნების თარიღი',
};
export type FilterKey = keyof typeof filterLabels;
/** A correction of the typed word, or the same search with one word taken off. */
export type SearchSuggestion = {
  query: string;
  count: number;
  kind: 'spelling' | 'fewer-words';
};
export type SearchMeta = {
  categories: { name: string; count: number }[];
  categoryTotal: number;
  relaxations: { key: FilterKey; label: string; count: number }[];
  suggestion: SearchSuggestion | null;
  /** How many the same words would find if the descriptions were searched too. */
  wider?: number;
  /** Set when nothing was found without the descriptions, so they were searched. */
  widened?: boolean;
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
  /** Only these vacancies: one employer's page, where the ids come from its identity. */
  jobIds?: readonly string[];
};
const normalized = (sql: string) =>
  `lower(CASE WHEN COALESCE(${sql},'') IS NFKC NORMALIZED THEN COALESCE(${sql},'') ELSE normalize(COALESCE(${sql},''),NFKC) END)`;
const today = "to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')";
type MatchGroup = {
  /** Where the group may match: a very short word names a role, so it stays out of descriptions. */
  s: 'head' | 'document';
  /** Its alternatives: the text a document must contain, the regex that confirms
      a non-Georgian one, and whether the reader typed this form themselves. */
  a: { t: string; p: string | null; o?: 1 }[];
};
function matchGroups(query: string, deep = false): MatchGroup[] {
  return searchMatchGroups(query).map((group) => ({
    s: deep ? termScope(group.all[0]) : 'head',
    a: group.all.map((term) => ({
      t: term,
      p: termPattern(term),
      ...(group.own.includes(term) ? { o: 1 as const } : {}),
    })),
  }));
}
/* The maintained column as the index knows it. Wrapping it in COALESCE would
   describe a different expression and quietly cost a sequential scan, so the
   candidate search reads it bare — a row without a snapshot simply matches
   nothing — and only the filters that need a false rather than an unknown take
   the guarded form. */
const documentText = (alias: string, preview: boolean, guarded = true) =>
  preview
    ? normalized(
        `concat_ws(' ',${alias}.draft->>'title',${alias}.draft->>'company',${alias}.draft->>'city',${alias}.draft->>'description')`,
      )
    : guarded
      ? `COALESCE(${alias}.search_document,'')`
      : `${alias}.search_document`;
/* Maintained by migration 029 and read bare, for the same reason as the document:
   COALESCE would hide it from its index. A draft preview builds it live. */
const headlineText = (alias: string, preview: boolean, guarded = true) =>
  preview
    ? normalized(
        `concat_ws(' ',${alias}.draft->>'title',${alias}.draft->>'company',${alias}.draft->>'city')`,
      )
    : guarded
      ? `COALESCE(${alias}.search_headline,'')`
      : `${alias}.search_headline`;
const likeText = (term: string) =>
  '%' + term.replace(/[\\%_]/g, (character) => '\\' + character) + '%';
/* The vacancies a query can match at all. Each alternative becomes a LIKE over
   the maintained document, which is what the trigram index of migration 028
   answers — three milliseconds instead of reading every description in the
   catalogue. LIKE with an escaped pattern is the same test as strpos, and the
   bounded regex still confirms a non-Georgian alternative. A group that reads
   the title and employer only has no index to use, and needs none: those columns
   are small enough to scan. */
const candidatePredicate = (
  groups: MatchGroup[],
  alias: string,
  preview: boolean,
  bind: (value: unknown) => string,
) =>
  groups
    .map((group) => {
      const text =
        group.s === 'head'
          ? headlineText(alias, preview, false)
          : documentText(alias, preview, false);
      return `(${group.a
        .map(
          ({ t, p }) =>
            `(${text} LIKE ${bind(likeText(t))}${p ? ` AND ${text} ~ ${bind(p)}` : ''})`,
        )
        .join(' OR ')})`;
    })
    .join(' AND ');
const hitsCte = (
  name: string,
  groups: MatchGroup[],
  preview: boolean,
  bind: (value: unknown) => string,
) =>
  `${name} AS MATERIALIZED (SELECT j.id FROM jobs j WHERE ${preview ? "j.status IN ('pending','published')" : "j.status='published'"} AND j.${preview ? 'draft' : 'published'} IS NOT NULL AND ${candidatePredicate(groups, 'j', preview, bind)})`;
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
  /* One group per typed word, each holding the alternatives that satisfy it: the
     Georgian stem first — the word the reader actually typed — then the reviewed
     equivalents. Every alternative carries the literal text a document must
     contain (cheap strpos prefilter) and, unless it is a Georgian stem, the
     bounded regex that confirms the match. "s" is where the group may match:
     a very short word names a role rather than describing one, so it is kept out
     of the descriptions. Parameters stay bound; user text never enters the SQL. */
  /* What a vacancy calls itself — its title, employer and city — is where a
     query word is looked for. Measured on the catalogue, a description match is
     noise far more often than not: of 1,966 vacancies whose text contains
     "დაცვა", 33 are security jobs and the rest observe rules, keep hygiene or
     protect data; "excel" reaches 992 and names 2. The descriptions stay one
     click away, and a search that finds nothing without them widens itself. */
  const groups = matchGroups(filters.query, filters.deep);
  // The same words against the descriptions, to count what that click would add.
  const deeper =
    !filters.deep && groups.some((group) => group.s === 'head')
      ? matchGroups(filters.query, true)
      : null;
  const queryTerms = groups.map((group) => group.a[0].t);
  const searching = groups.length > 0;
  /* What relevance needs from the reader travels as one bound value: the groups
     and the adjacency pattern. It is bound the first time it is mentioned and no
     sooner — the same plan also builds statements that only count, and a driver
     rejects a parameter the statement never names. */
  const adjacent =
    groups.length > 1 && groups.length <= 4
      ? queryTerms
          .map((term) => escapeRegex(term))
          .join('[^[:space:]]*[[:space:]]+')
      : null;
  const payload = searching
    ? `${bind(JSON.stringify({ g: groups, j: adjacent }))}::jsonb`
    : `'{}'::jsonb`;
  const posted = preview
    ? 'j.created_at'
    : 'COALESCE(j.published_at,j.created_at)';
  // One alternative against one text, and any alternative of a group against it.
  const oneTerm = (text: string, term: string) =>
    `strpos(${text},${term}->>'t')>0 AND (${term}->>'p' IS NULL OR ${text} ~ (${term}->>'p'))`;
  // Any alternative of a group, or only the ones the reader actually typed.
  const anyTerm = (text: string, group: string, own = false) =>
    `EXISTS(SELECT 1 FROM jsonb_array_elements(${group}->'a') term WHERE ${own ? "term->>'o'='1' AND " : ''}${oneTerm(text, 'term')})`;
  const opensWith = (text: string, group: string) =>
    `EXISTS(SELECT 1 FROM jsonb_array_elements(${group}->'a') term WHERE term->>'o'='1' AND strpos(${text},term->>'t')=1)`;
  const grouped = Boolean(options.grouped) && !params.has('ids');
  const folding = grouped || params.has('ids');
  const pricing =
    options.pricing === true ||
    filters.salaryFrom !== null ||
    filters.salaryTo !== null ||
    filters.salaryPeriod === 'day' ||
    params.get('sort') === 'salary';
  // Published scalars are maintained by migrations 020 and 027 when the snapshot
  // changes. Draft preview unpacks its live snapshot once with a lateral record.
  // Separate ->> expressions each detoast the same large JSON again, even behind
  // OFFSET 0, which is why no text is rebuilt per request here.
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
  const promotionRank = (alias: string) =>
    `CASE WHEN ${alias}.placement_expires_at>now() THEN CASE ${alias}.placement_tier WHEN 'premium' THEN 2 WHEN 'vip' THEN 1 ELSE 0 END ELSE 0 END`;
  const scalar = (alias: string, key: string) =>
    preview
      ? `scalars."${key}"`
      : `${alias}.search_${key.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase())}`;
  /* Texts only the row itself can supply, so they are read inside the extraction
     scan and leave it as a yes/no answer. Carrying a description through the
     materialized CTE is what used to spill tens of megabytes to disk per search. */
  const document = (alias: string) => documentText(alias, preview);
  const factsText = (alias: string) =>
    preview
      ? normalized(`${alias}.draft->>'facts'`)
      : `COALESCE(${alias}.search_facts,'')`;
  const experienceText = (alias: string) =>
    `(${document(alias)} || ' ' || ${factsText(alias)})`;
  const employmentText = (alias: string) =>
    normalized(
      `concat_ws(' ',${preview ? `${alias}.draft->>'employmentType'` : `${alias}.search_employment_type`},${scalar(alias, 'title')})`,
    );
  const cityStemPattern =
    filters.city !== 'ყველა' && filters.city !== otherCity
      ? bind('\\m' + escapeRegex(cityStem(filters.city)))
      : null;
  const employmentPattern =
    filters.employment === 'all'
      ? null
      : bind(
          filters.employment === 'daily'
            ? '(^|[^ა-ჰa-z])(დღიური|ერთდღიანი|ერთჯერადი)[[:space:]-]+(სამუშაო|სამსახური|დასაქმება)|one[ -]day[[:space:]]+(job|work)|day[ -]labou?r'
            : filters.employment === 'part-time'
              ? '(ნახევარი?|არასრული?|ნაწილობრივი?)[[:space:]]+განაკვეთ|part[ -]?time'
              : 'სტაჟიორ|სტაჟირებ|\\mintern(ship)?\\M',
        );
  const entryLevelPattern = filters.entryLevel
    ? bind(
        'გამოცდილების[[:space:]]+გარეშე|გამოცდილება[[:space:]:–-]+(არ[[:space:]]+(არის[[:space:]]+)?(სავალდებულო|აუცილებელი|საჭირო)|არ[[:space:]]+მოითხოვება)|no[[:space:]]+(previous[[:space:]]+|prior[[:space:]]+)?experience[[:space:]]+(is[[:space:]]+)?(required|needed|necessary)|experience[[:space:]]+(is[[:space:]]+)?not[[:space:]]+(required|needed|necessary)',
      )
    : null;
  const requiredExperience = filters.entryLevel
    ? bind(requiredExperiencePattern)
    : null;
  /* Answers the extraction scan gives once per row, so the filters, the facet
     counts and the relaxed counts can all read a boolean instead of a document.
     Each one appears only while its filter is switched on. */
  const answers = (alias: string) =>
    [
      searching ? `(${alias}.id IN (SELECT id FROM hits)) AS q_match` : '',
      searching && deeper
        ? `(${alias}.id IN (SELECT id FROM deeper)) AS q_deep`
        : '',
      // A posting without a city field often names the city in its own text.
      cityStemPattern
        ? `(CASE WHEN ${normalized(scalar(alias, 'city'))}='' THEN ${document(alias)} ~ ${cityStemPattern} ELSE false END) AS city_text`
        : '',
      entryLevelPattern
        ? `(${experienceText(alias)} ~ ${entryLevelPattern} AND NOT (${experienceText(alias)} ~ ${requiredExperience})) AS entry_level`
        : '',
      employmentPattern
        ? `(${filters.employment === 'daily' ? `(${employmentText(alias)} || ' ' || ${document(alias)})` : employmentText(alias)} ~ ${employmentPattern}) AS employment_match`
        : '',
    ]
      .filter(Boolean)
      .map((column) => ',' + column)
      .join('');
  const extraction = (alias: string, matching = true) =>
    `SELECT ${alias}.id,${alias}.created_at,${alias}.published_at,${alias}.needs_review,${alias}.fingerprint,${alias}.placement_tier,${alias}.placement_expires_at,${extracted.map((key) => `${scalar(alias, key)} AS p_${key}`).join(',')}${pricing ? `,${scalar(alias, 'salaryMin')} AS p_salaryMin` : ''}${matching ? answers(alias) : ''}`;
  const scalarRecord = (alias: string) =>
    preview
      ? `CROSS JOIN LATERAL jsonb_to_record(${alias}.${snapshot.slice(2)}) AS scalars(${extracted.map((key) => `"${key}" text`).join(',')}${pricing ? ',"salaryMin" jsonb' : ''})`
      : '';
  const p = (key: string) => `j.p_${key}`;
  /* A vacancy is grouped with another only when its employer name identifies someone. A blank
     name never did; neither does a placeholder or a kind of business. Two cooks in Tbilisi under
     the employer "კომპანია" — a Vake restaurant on jobs.ge and a four-star hotel in Avlabari on
     ss.ge — were folded into one, and the hotel's vacancy vanished from the list. A single letter
     is not a name either, but two letters can be a brand ("S.G"), so those keep grouping. */
  const employerKey = `regexp_replace(${normalized(p('company'))},'[^a-z0-9ა-ჰ]','','g')`;
  const genericEmployers = [...genericCompanyKeys]
    .map((key) => `'${key.replace(/'/g, "''")}'`)
    .join(',');
  // C locales classify Georgian letters as non-alphanumeric. Keep them explicitly
  // or unrelated Georgian titles/employers/cities all collapse into the key "||".
  const groupKey = `CASE WHEN btrim(COALESCE(${p('company')},''))='' OR length(${employerKey}) < 2 OR ${employerKey} IN (${genericEmployers}) THEN j.id::text ELSE regexp_replace(${normalized(`concat_ws('|',${p('title')},${p('company')},${p('city')})`)},'[^[:alnum:]ა-ჰ|]','','g') END`;
  const numericSalary = `jsonb_typeof(${p('salaryMin')})='number'`;
  const monthlyFloor = 100;
  const monthlyCeiling = 50000;
  const dailyCeiling = 500;
  const salaryAmount = `(${p('salaryMin')}#>>'{}')::numeric`;
  const unless = (needed: boolean, sql: string, empty = "''::text") =>
    needed ? sql : empty;
  const groupPosition = `row_number() OVER (PARTITION BY ${groupKey} ORDER BY ${promotionRank('j')} DESC,${posted} DESC NULLS LAST,j.id)`;
  /* Relevance, read off the title and the employer only, and only for the rows a
     search returns. The word the reader typed outranks a reviewed equivalent, a
     title that opens with it outranks one that mentions it later, and — for a
     search of two to four words — a title carrying them in the typed order
     outranks one that merely contains them all, which is what separates
     "ოფისის მენეჯერი" from a manager at a head office. */
  const titleNorm = normalized(p('title'));
  const companyNorm = normalized(p('company'));
  const relevance = `((SELECT COALESCE(sum(
      CASE WHEN ${anyTerm(titleNorm, 'grp.value', true)} THEN 5 WHEN ${anyTerm(titleNorm, 'grp.value')} THEN 3 ELSE 0 END
      + CASE WHEN ${opensWith(titleNorm, 'grp.value')} THEN 2 ELSE 0 END
      + CASE WHEN ${anyTerm(companyNorm, 'grp.value')} THEN 2 ELSE 0 END),0)
    FROM jsonb_array_elements(${payload}->'g') grp)${adjacent ? ` + CASE WHEN ${titleNorm} ~ (${payload}->>'j') THEN 6 ELSE 0 END` : ''})`;
  const columns = [
    `${promotionRank('j')} AS promotion_rank`,
    `${unless(searching || filters.remote, titleNorm)} AS title_norm`,
    `${searching ? `CASE WHEN j.q_match THEN ${relevance} ELSE 0 END` : '0'} AS relevance`,
    `${unless(searching, companyNorm)} AS company_norm`,
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
  const cityCondition = () => {
    if (filters.city === 'ყველა') return 'true';
    if (filters.city === otherCity)
      return `j.city_norm<>'' AND NOT EXISTS(SELECT 1 FROM unnest(${bind([...cities])}::text[]) known WHERE strpos(j.city_norm,lower(known))>0)`;
    // The stem was matched at a word start so გორი never means კატეგორია.
    return `CASE WHEN strpos(j.city_norm,${bind(filters.city.normalize('NFKC').toLowerCase())})>0 THEN true WHEN j.city_norm='' THEN j.city_text ELSE false END`;
  };
  const conditions: Record<FilterKey, string> = {
    query: searching ? 'j.q_match' : 'true',
    city: cityCondition(),
    category:
      filters.category === 'ყველა'
        ? 'true'
        : `${p('category')}=${bind(filters.category)}`,
    subcategory: filters.subcategory
      ? `${normalized(p('title'))} ~ ${bind(subcategoryFor(filters.category, filters.subcategory)!.pattern)}`
      : 'true',
    source:
      filters.source === 'ყველა'
        ? 'true'
        : `j.group_key IN (SELECT m.group_key FROM members m JOIN source_items si ON si.job_id=m.id JOIN sources s ON s.id=si.source_id WHERE NOT s.retired AND s.name=${bind(filters.source)})`,
    // "Pay is stated" needs an actual figure; "by agreement" or "depends on experience" is not one.
    paid: filters.paid ? `COALESCE(${p('salary')},'') ~ '[0-9]'` : 'true',
    // A remote title counts unless the source states the work is on site.
    remote: filters.remote
      ? `(${p('mode')} IN ('დისტანციური','სამუშაო სახლიდან') OR (COALESCE(${p('mode')},'')<>'ადგილზე' AND j.title_norm ~ '(დისტანციურ|\\mremote)'))`
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
    employment: employmentPattern ? 'j.employment_match' : 'true',
    entryLevel: entryLevelPattern ? 'j.entry_level' : 'true',
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
  if (params.has('ids'))
    base += ` AND j.id::text=ANY(${bind(
      (params.get('ids') || '')
        .split(',')
        .filter((id) => z.uuid().safeParse(id).success)
        .slice(0, 100),
    )}::text[])`;
  if (options.jobIds)
    base += ` AND j.id=ANY(${bind([...options.jobIds])}::uuid[])`;
  if (params.has('exclude'))
    base += ` AND NOT (j.id::text=ANY(${bind(
      (params.get('exclude') || '')
        .split(',')
        .filter((id) => z.uuid().safeParse(id).success)
        .slice(0, 100),
    )}::text[]))`;
  const groupRank = grouped
    ? `,${groupPosition} AS group_rank`
    : ',1::bigint AS group_rank';
  // Members of every group present in the result. A lookup by id must also see
  // duplicates outside its restricted set; the indexed import fingerprint (the
  // same three fields, taken from the draft) narrows that scan to candidates.
  // Membership needs no filter answers, only the key.
  const members = params.has('ids')
    ? `SELECT j.id,${groupKey} AS group_key,${posted} AS posted_at FROM (${extraction('j', false)} FROM jobs j ${scalarRecord('j')} WHERE ${visible} AND j.fingerprint IN (SELECT fingerprint FROM searchable) OFFSET 0) j WHERE ${current} AND ${groupKey} IN (SELECT group_key FROM searchable)`
    : `SELECT j.id,j.group_key,${posted} AS posted_at FROM searchable j`;
  /* Candidates first, so the rest of the plan only asks whether a row is in that
     set. The visibility a candidate needs is its own — retired sources, deadlines
     and grouping are decided on the page, where they are decided for every row. */
  const hits = searching
    ? `${hitsCte('hits', groups, preview, bind)}, ${deeper ? `${hitsCte('deeper', deeper, preview, bind)}, ` : ''}`
    : '';
  const cte = `WITH ${hits}searchable AS MATERIALIZED (SELECT j.*,${columns.join(',')}${groupRank} FROM (${extraction('j')} FROM jobs j ${scalarRecord('j')} WHERE ${base} OFFSET 0) j WHERE ${current}), members AS MATERIALIZED (${members})`;
  const kept = grouped ? 'j.group_rank=1' : 'true';
  const keys = Object.keys(conditions) as FilterKey[];
  // searchable already satisfies the base predicate; only the grouping and the
  // filters are evaluated again on the page.
  const where = [kept, ...keys.map((key) => `(${conditions[key]})`)].join(
    ' AND ',
  );
  const all = (except?: FilterKey) =>
    keys
      .filter(
        (key) =>
          key !== except && !(except === 'category' && key === 'subcategory'),
      )
      .map((key) => `"${key}"`)
      .join(' AND ');
  const widened =
    searching && deeper
      ? `,(SELECT count(*)::int FROM matches WHERE q_deep AND ${all('query')}) deep_total`
      : '';
  const metrics = `${cte}, matches AS MATERIALIZED (SELECT ${p('category')} AS category_name,${searching && deeper ? 'j.q_deep,' : ''}${keys.map((key) => `COALESCE((${conditions[key]}),false) AS "${key}"`).join(',')} FROM searchable j WHERE ${kept})
    SELECT (SELECT count(*)::int FROM matches WHERE ${all()}) total,
    (SELECT count(*)::int FROM matches WHERE ${all('category')}) category_total,
    COALESCE((SELECT jsonb_agg(c) FROM (SELECT category_name name,count(*)::int count FROM matches WHERE ${all('category')} GROUP BY category_name) c),'[]'::jsonb) categories,
    jsonb_build_object(${keys.map((key) => `'${key}',(SELECT count(*)::int FROM matches WHERE ${all(key)})`).join(',')}) relaxed${widened}`;
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
    ordering = `j.relevance DESC,${newest}`;
  return {
    where,
    args,
    ordering,
    metrics,
    filters,
    cte,
    grouped,
    queryTerms,
  };
}
/* What the same search would find with one of its words taken off. Asked only
   when nothing was found at all, so the ordinary search never pays for it: each
   candidate set is one more index lookup, and the visible rows are already
   gathered by the plan the other filters describe. */
export function shorterSearches(params: URLSearchParams, preview = false) {
  const query = readSearch(params).query;
  const groups = matchGroups(query);
  if (groups.length < 2) return null;
  // Offered back in the reader's own words, not in the stems the search uses.
  const typed = searchTerms(query);
  const withoutQuery = new URLSearchParams(params);
  withoutQuery.delete('q');
  const plan = searchPlan(withoutQuery, preview, { grouped: true });
  const args = [...plan.args];
  const bind = (value: unknown) => {
    args.push(value);
    return `$${args.length}`;
  };
  const kept = groups.map((_, index) =>
    groups.filter((_group, position) => position !== index),
  );
  const statement =
    'WITH ' +
    kept
      .map((rest, index) => hitsCte(`kept${index}`, rest, preview, bind))
      .join(',') +
    ',' +
    plan.cte.slice('WITH '.length) +
    ` SELECT jsonb_build_object(${kept
      .map(
        (_rest, index) =>
          `'${index}',(SELECT count(*)::int FROM searchable j WHERE ${plan.where} AND j.id IN (SELECT id FROM kept${index}))`,
      )
      .join(',')}) dropped`;
  return { statement, args, queryTerms: typed };
}
