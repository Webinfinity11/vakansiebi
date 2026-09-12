import { employerlessSources, privateListingLabel } from '../types';
import { z } from 'zod';
import type { QueryResultRow } from 'pg';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { audit } from '../../worker/importer';
import { reconcileJob } from '../../worker/automation';
import { fingerprint } from '../../worker/adapters';
import type { Vacancy } from '../types';
import { vacancySchema } from '../vacancy-schema';
export { vacancySchema } from '../vacancy-schema';
import { companyKey } from '../company-key';
import { sourceHealth } from '../job-intelligence';
import {
  searchPlan,
  filterLabels,
  type FilterKey,
  type SearchMeta,
} from './search-plan';
import { suggestSearch } from '../search-language';
import { logoCompanyKey } from '../company-logo-identity';
import { resolveCompanyLogos } from './company-logos';
export async function publicJobs(params: URLSearchParams, preview = false) {
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.get('page'))) || 1),
  );
  const limit = 20;
  // The public listing shows one row per identical posting; a lookup by id
  // (detail page, saved list) keeps every row reachable, sources folded either way.
  const { where, args, ordering, metrics, filters } = searchPlan(
    params,
    preview,
    { grouped: true },
  );
  const summary = params.get('summary') === '1';
  const snapshot = preview ? 'j.draft' : 'j.published';
  const projection = summary
    ? `(${snapshot} - ARRAY['description','facts','applicationLinks','warnings','fullTextUrl'])`
    : snapshot;
  const countsOnly = params.get('countsOnly') === '1';
  const cut = metrics.indexOf(
    '\n    SELECT (SELECT count(*)::int FROM matches',
  );
  const statement = countsOnly
    ? metrics
    : metrics.slice(0, cut) +
      `, ranked AS (SELECT j.id,(j.needs_review AND EXISTS(SELECT 1 FROM audit_log changed WHERE changed.job_id=j.id AND changed.action='source.changed' AND changed.created_at>j.published_at)) AS source_changed,${projection} AS published,j.created_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('source',s.name,'url',si.url,'checkedAt',CASE WHEN si.quality_warning IS NOT NULL THEN si.last_verified_at ELSE si.last_checked_at END,'error',si.error) ORDER BY (m.id=j.id) DESC,m.posted_at DESC,s.name,si.url) FROM members m JOIN source_items si ON si.job_id=m.id JOIN sources s ON s.id=si.source_id WHERE m.group_key=j.group_key AND NOT s.retired),'[]'::jsonb) AS sources, row_number() OVER (ORDER BY ${ordering},j.id) AS ord FROM searchable j WHERE ${where}), page AS (SELECT * FROM ranked WHERE ord > $${args.length + 2} AND ord <= $${args.length + 2} + $${args.length + 1})` +
      metrics.slice(cut) +
      `, (SELECT COALESCE(jsonb_agg(to_jsonb(pg) - 'ord' ORDER BY pg.ord),'[]'::jsonb) FROM page pg) AS page_rows`;
  const measured = (
    await db().query(
      statement,
      countsOnly ? args : [...args, limit, (page - 1) * limit],
    )
  ).rows[0];
  const count = measured.total;
  const search: SearchMeta = {
    categories: measured.categories,
    categoryTotal: measured.category_total,
    relaxations: (Object.entries(measured.relaxed) as [FilterKey, number][])
      .filter(([, n]) => n > count)
      .map(([key, n]) => ({ key, label: filterLabels[key], count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    suggestion: null,
  };
  const correction = count === 0 ? suggestSearch(filters.query) : null;
  if (correction) {
    const corrected = new URLSearchParams(params);
    corrected.set('q', correction);
    const plan = searchPlan(corrected, preview, { grouped: true });
    const n = (
      await db().query(
        `${plan.cte} SELECT count(*)::int count FROM searchable j WHERE ${plan.where}`,
        plan.args,
      )
    ).rows[0].count;
    if (n > 0) search.suggestion = { query: correction, count: n };
  }
  if (params.get('countsOnly') === '1')
    return {
      jobs: [],
      preview,
      search,
      total: count,
      page: 1,
      pages: Math.ceil(count / limit),
    };
  /* One statement, not two. `searchable` is the expensive part (about 700ms warm) and a CTE
     does not outlive its statement, so running the counts and the page separately built it
     twice. Measured on the remote filter: 1546ms as two queries, 740ms as one, same ids and
     total. The page is numbered by the same ordering it is limited by, so the aggregate keeps
     the order without relying on the planner. */
  // Rows arrive as JSON; the timestamp is restored so the response shape is unchanged.
  const pageRows: QueryResultRow[] = measured.page_rows || [];
  for (const r of pageRows) r.created_at = new Date(r.created_at);
  const rows = pageRows;
  const companyKeys = [
    ...new Set(rows.map((r) => companyKey(r.published.company || ''))),
  ];
  const [profilesResult, sharedLogos] = await Promise.all([
    companyKeys.length
      ? db().query(
          'SELECT * FROM company_profiles WHERE company_key=ANY($1::text[])',
          [companyKeys],
        )
      : Promise.resolve({ rows: [] }),
    resolveCompanyLogos(
      rows
        .filter((r) => !r.published.logoUrl)
        .map((r) => r.published.company || ''),
    ),
  ]);
  const companyProfiles = new Map(
    profilesResult.rows.map((p) => [p.company_key, p]),
  );
  return {
    jobs: rows.map((r) => ({
      description: '',
      ...r.published,
      ...(!r.published.logoUrl &&
      sharedLogos.has(logoCompanyKey(r.published.company || ''))
        ? {
            logoUrl: sharedLogos.get(logoCompanyKey(r.published.company || ''))!
              .logoUrl,
            logoOrigin: sharedLogos.get(
              logoCompanyKey(r.published.company || ''),
            )!.origin,
          }
        : {}),
      summary,
      ...(typeof r.published.salaryMin === 'number' &&
      (!Number.isFinite(r.published.salaryMin) ||
        r.published.salaryMin > 100000000 ||
        r.published.salaryMin < 0)
        ? { salary: '', salaryMin: null, currency: '', salaryPeriod: '' }
        : {}),
      // A classified board carries no employer; name the listing honestly instead of
      // leaving the employer line blank or inventing a company.
      ...(!String(r.published.company || '').trim() &&
      employerlessSources.includes(String(r.published.source || ''))
        ? { company: privateListingLabel }
        : {}),
      id: r.id,
      sourceChanged: !preview && r.source_changed,
      createdAt: r.created_at.toISOString(),
      sources: r.sources.map(
        (s: {
          source: string;
          url: string;
          checkedAt: string | null;
          error: string | null;
        }) => ({
          source: s.source,
          url: s.url,
          checkedAt: s.checkedAt,
          health: sourceHealth(s.checkedAt, s.error),
        }),
      ),
      ...(companyProfiles.get(companyKey(r.published.company || ''))?.logo_url
        ? {
            logoUrl: companyProfiles.get(companyKey(r.published.company || ''))!
              .logo_url,
          }
        : {}),
      companyProfile: {
        website:
          companyProfiles.get(companyKey(r.published.company || ''))?.website ||
          '',
        description:
          companyProfiles.get(companyKey(r.published.company || ''))
            ?.description || '',
      },
    })),
    preview,
    search,
    total: count,
    page,
    pages: Math.ceil(count / limit),
  };
}
export async function adminJobs(
  status: string,
  q: string,
  page = 1,
  source = '',
) {
  // `paused` and `manual` are automation states rather than record statuses: with automatic
  // publication on, the records an editor has to look at are the ones automation stopped
  // managing, not the whole catalogue.
  // The source parameter is numbered differently in the page and count queries, so the
  // predicate is built once and given the placeholder each one uses.
  const where = (sourceParam: string) => `j.status<>'merged'
    AND ($1='all' OR ($1='review' AND j.needs_review=true)
      OR ($1='paused' AND j.automation_paused AND j.status<>'rejected')
      OR ($1='manual' AND NOT j.automation_managed AND j.status<>'rejected')
      OR ($1='blocked' AND j.automation_reason IS NOT NULL AND j.status<>'published')
      OR j.status=$1)
    AND ($2='' OR strpos(lower(concat_ws(' ',j.draft->>'title',j.draft->>'company')),lower($2))>0)
    AND (${sourceParam}='' OR EXISTS (SELECT 1 FROM source_items f WHERE f.job_id=j.id AND f.source_id=${sourceParam}))`;
  const rows = (
    await db().query(
      `SELECT j.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',si.id,'source_id',si.source_id,'url',si.url,'raw',si.raw,'last_checked_at',si.last_checked_at,'next_check_at',si.next_check_at,'failures',si.failures,'quality_warning',si.quality_warning,'error',si.error)) FROM source_items si WHERE si.job_id=j.id),'[]'::jsonb) AS items,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.draft->>'title','company',d.draft->>'company')) FROM jobs d WHERE d.fingerprint=j.fingerprint AND d.id<>j.id AND d.status NOT IN ('merged','rejected','archived')),'[]'::jsonb) AS duplicates FROM jobs j WHERE ${where('$4')} ORDER BY j.needs_review DESC,j.updated_at DESC LIMIT 30 OFFSET $3`,
      [status, q, (page - 1) * 30, source],
    )
  ).rows;
  const total = (
    await db().query(
      `SELECT count(*)::int count FROM jobs j WHERE ${where('$3')}`,
      [status, q, source],
    )
  ).rows[0].count;
  const counts = (
    await db().query(
      `SELECT count(*) FILTER(WHERE status='pending')::int pending,
      count(*) FILTER(WHERE status='published')::int published,
      count(*) FILTER(WHERE needs_review AND status<>'merged')::int review,
      count(*) FILTER(WHERE status='archived')::int archived,
      count(*) FILTER(WHERE automation_paused AND status NOT IN ('merged','rejected'))::int paused,
      count(*) FILTER(WHERE NOT automation_managed AND status NOT IN ('merged','rejected'))::int manual,
      count(*) FILTER(WHERE automation_reason IS NOT NULL AND status NOT IN ('merged','rejected','published'))::int blocked
      FROM jobs`,
    )
  ).rows[0];
  return { jobs: rows, total, counts };
}
export async function bulkPublishCandidates() {
  return (
    await db().query(`SELECT j.id,j.version FROM jobs j
    WHERE j.status='pending' AND EXISTS (SELECT 1 FROM source_items i
    JOIN sources s ON s.id=i.source_id WHERE i.job_id=j.id AND NOT s.retired)
    ORDER BY j.created_at,j.id`)
  ).rows as { id: string; version: number }[];
}

export async function bulkPublishJobs(input: unknown) {
  const items = z
    .array(z.object({ id: z.uuid(), version: z.number().int() }))
    .min(1)
    .max(20)
    .parse(input);
  const results: { id: string; published: boolean; reason?: string }[] = [];
  for (const item of items) {
    try {
      await mutateJob({ ...item, action: 'publish', pendingOnly: true });
      results.push({ id: item.id, published: true });
    } catch (error) {
      if (!(error instanceof ApiError) && !(error instanceof z.ZodError))
        throw error;
      results.push({
        id: item.id,
        published: false,
        reason:
          error instanceof z.ZodError
            ? 'მონაცემები შესასწორებელია'
            : error.message,
      });
    }
  }
  return { results };
}

export async function mutateJob(input: unknown) {
  const data = z
    .object({
      id: z.uuid(),
      version: z.number().int(),
      pendingOnly: z.boolean().optional(),
      action: z.enum([
        'save',
        'publish',
        'archive',
        'reject',
        'restore',
        'apply-source',
        'dismiss-update',
        'merge',
        'resume-automation',
      ]),
      draft: vacancySchema.optional(),
      itemId: z.uuid().optional(),
      targetId: z.uuid().optional(),
    })
    .parse(input);
  return transaction(async (c) => {
    // Consistent ordering prevents deadlocks for concurrent opposite-direction merges.
    const ids = [data.id, ...(data.targetId ? [data.targetId] : [])].sort();
    const rows = (
      await c.query(
        'SELECT * FROM jobs WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [ids],
      )
    ).rows;
    const job = rows.find((r) => r.id === data.id);
    if (!job) throw new ApiError('ვაკანსია ვერ მოიძებნა', 404);
    if (job.version !== data.version)
      throw new ApiError(
        'ჩანაწერი შეიცვალა. განაახლე სია და სცადე ხელახლა.',
        409,
      );
    if (data.pendingOnly) {
      const active = (
        await c.query(
          `SELECT 1 FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.job_id=$1 AND NOT s.retired LIMIT 1`,
          [job.id],
        )
      ).rowCount;
      if (job.status !== 'pending' || !active)
        throw new ApiError('ჩანაწერი აღარ არის დასადასტურებელი', 409);
    }
    if (job.status === 'merged')
      throw new ApiError('ვაკანსია უკვე გაერთიანებულია', 409);
    // Handing a record back to automation is the one action that must not pause it again.
    // The source snapshot then decides what the record becomes, exactly as for a new import.
    if (data.action === 'resume-automation') {
      await c.query(
        `UPDATE jobs SET automation_managed=true,automation_paused=false,needs_review=false,
         version=version+1,updated_at=now() WHERE id=$1`,
        [job.id],
      );
      await audit(
        c,
        job.id,
        'automation.resumed',
        'admin',
        {
          automation_managed: job.automation_managed,
          automation_paused: job.automation_paused,
        },
        { automation_managed: true, automation_paused: false },
      );
      const outcome = await reconcileJob(c, job.id);
      return { ok: true, outcome };
    }
    let draft: Vacancy = data.draft || job.draft;
    let published = job.published;
    let status = job.status;
    let review = job.needs_review;
    if (data.action === 'save') {
      if (!data.draft) throw new ApiError('შეავსე ვაკანსიის მონაცემები');
      review = true;
    }
    if (data.action === 'publish') {
      draft = vacancySchema.parse(draft);
      if (
        draft.deadline &&
        draft.deadline <
          new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' })
      )
        throw new ApiError('ვაკანსიის ბოლო ვადა გასულია');
      if (!draft.company) throw new ApiError('მიუთითე კომპანია');
      published = draft;
      status = 'published';
      review = false;
    }
    if (data.action === 'archive') {
      status = 'archived';
      review = false;
    }
    if (data.action === 'reject') {
      status = 'rejected';
      review = false;
    }
    if (data.action === 'restore') {
      status = 'pending';
      published = null;
      review = true;
    }
    if (data.action === 'dismiss-update') review = false;
    if (data.action === 'apply-source') {
      if (!data.itemId) throw new ApiError('აირჩიე წყარო');
      const item = (
        await c.query(
          'SELECT raw FROM source_items WHERE id=$1 AND job_id=$2',
          [data.itemId, job.id],
        )
      ).rows[0];
      if (!item?.raw) throw new ApiError('წყაროს მონაცემები ვერ მოიძებნა');
      draft = vacancySchema.parse(item.raw);
      review = true;
    }
    if (data.action === 'merge') {
      const target = rows.find((r) => r.id === data.targetId);
      if (
        !target ||
        target.id === job.id ||
        ['merged', 'rejected', 'archived'].includes(target.status)
      )
        throw new ApiError('აირჩიე სხვა აქტიური ვაკანსია');
      await c.query('UPDATE source_items SET job_id=$2 WHERE job_id=$1', [
        job.id,
        target.id,
      ]);
      await c.query(
        'UPDATE jobs SET automation_paused=true,needs_review=true,version=version+1,updated_at=now() WHERE id=$1',
        [target.id],
      );
      status = 'merged';
      published = null;
      review = false;
      await c.query('UPDATE jobs SET merged_into=$2 WHERE id=$1', [
        job.id,
        target.id,
      ]);
      await audit(c, target.id, 'merge.received', 'admin', null, {
        from: job.id,
      });
    }
    await c.query(
      "UPDATE jobs SET automation_paused=true,draft=$2,published=$3,status=$4,needs_review=$5,fingerprint=$6,version=version+1,updated_at=now(),published_at=CASE WHEN $7='publish' THEN now() ELSE published_at END WHERE id=$1",
      [
        job.id,
        draft,
        published,
        status,
        review,
        fingerprint(draft),
        data.action,
      ],
    );
    await audit(
      c,
      job.id,
      data.action,
      'admin',
      { draft: job.draft, published: job.published, status: job.status },
      { draft, published, status },
    );
    return { ok: true };
  });
}
