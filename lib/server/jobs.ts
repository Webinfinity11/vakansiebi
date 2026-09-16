import { confirmInvoice, cancelUnusedInvoice } from './billing';
import { placementTiers } from '../placement';
import { bonusCompanyKey } from './job-placement';
import { approvePlacement } from './job-placement';
import { employerlessSources, privateListingLabel } from '../types';
import { z } from 'zod';
import type { QueryResultRow } from 'pg';
import { db, transaction } from './db';
import { readSearch } from '../search-state';
import { ApiError } from './auth';
import { audit } from '../../worker/importer';
import { reconcileJob } from '../../worker/automation';
import { fingerprint } from '../../worker/adapters';
import type { Vacancy } from '../types';
import { vacancySchema } from '../vacancy-schema';
export { vacancySchema } from '../vacancy-schema';
import { companyKey } from '../company-key';
import { contactAsCompany } from '../employer-identity';
import { sourceHealth } from '../job-intelligence';
import {
  searchPlan,
  shorterSearches,
  publicRead,
  filterLabels,
  type FilterKey,
  type SearchMeta,
} from './search-plan';
import { suggestSearch } from '../search-language';
import { logoCompanyKey } from '../company-logo-identity';
import { resolveCompanyLogos } from './company-logos';
import { employerPages, employerPagesIfReady } from './employers';
import { createPublicJobsCache, publicJobsCacheKey } from './jobs-cache';

const publicResponses =
  createPublicJobsCache<Awaited<ReturnType<typeof loadPublicJobs>>>();
// Benchmarks and snapshot-write integration tests can explicitly measure a miss.
export function clearPublicJobsCache() {
  publicResponses.clear();
}
export async function publicJobs(
  params: URLSearchParams,
  preview = false,
  options: { jobIds?: readonly string[] } = {},
) {
  const answer = await publicResponses.get(
    publicJobsCacheKey(params, preview, options.jobIds),
    () => loadPublicJobs(params, preview, options),
  );
  if (answer.total > 0) return answer;
  const again = (changed: URLSearchParams) =>
    publicResponses.get(
      publicJobsCacheKey(changed, preview, options.jobIds),
      () => loadPublicJobs(changed, preview, options),
    );
  /* A misspelt word is worth more than an empty page with a button on it: the
     correction is searched at once and the page says which word it answered,
     the way a search engine does. The reader's own text stays in the field. */
  const correction =
    answer.search.suggestion?.kind === 'spelling'
      ? answer.search.suggestion
      : null;
  if (correction) {
    const corrected = new URLSearchParams(params);
    corrected.set('q', correction.query);
    const fixed = await again(corrected);
    if (fixed.total > 0)
      return {
        ...fixed,
        search: {
          ...fixed.search,
          corrected: {
            from: readSearch(params).query.trim(),
            to: correction.query,
          },
        },
      };
  }
  /* Nothing under the titles, and the descriptions hold something: the reader
     gets those rather than an empty page — a word like "wordpress" never appears
     in a title. The page says so, and the search stays narrow next time. */
  if (!answer.search.wider) return answer;
  const wider = new URLSearchParams(params);
  wider.set('deep', 'true');
  const widened = await again(wider);
  return { ...widened, search: { ...widened.search, widened: true } };
}
async function loadPublicJobs(
  params: URLSearchParams,
  preview = false,
  options: { jobIds?: readonly string[] } = {},
) {
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
    { grouped: true, jobIds: options.jobIds },
  );
  const summary = params.get('summary') === '1';
  /* The snapshot itself is read from the table, for the twenty rows of this page
     only. Carrying it through the search would detoast every visible vacancy. */
  const record = preview ? 'record.draft' : 'record.published';
  const projection = summary
    ? `(${record} - ARRAY['description','facts','applicationLinks','warnings','fullTextUrl'])`
    : record;
  const countsOnly = params.get('countsOnly') === '1';
  const cut = metrics.indexOf(
    '\n    SELECT (SELECT count(*)::int FROM matches',
  );
  /* Whatever the filters and the chosen sort, a matching premium vacancy comes first, then VIP,
     each group newest-published first; everything else follows in the chosen order. A saved
     list (ids) keeps its own order, and the admin preview shows no promotion. */
  const boosted = !preview && !params.has('ids');
  const priority = boosted
    ? 'j.promotion_rank DESC,CASE WHEN j.promotion_rank>0 THEN COALESCE(j.published_at,j.created_at) END DESC NULLS LAST,'
    : '';
  // A card needs one recent link per source; detail retains every original link.
  const sources = summary
    ? `COALESCE((SELECT jsonb_agg(jsonb_build_object('source',recent.source,'url',recent.url,'checkedAt',recent.checked_at,'error',recent.error) ORDER BY recent.posted_at DESC NULLS LAST,recent.source,recent.url) FROM (SELECT * FROM (SELECT DISTINCT ON (s.name) s.name AS source,si.url,CASE WHEN si.quality_warning IS NOT NULL THEN si.last_verified_at ELSE si.last_checked_at END AS checked_at,si.error,m.posted_at FROM members m JOIN source_items si ON si.job_id=m.id JOIN sources s ON s.id=si.source_id WHERE m.group_key=j.group_key AND NOT s.retired ORDER BY s.name,m.posted_at DESC NULLS LAST,si.last_checked_at DESC NULLS LAST,si.url) per_source ORDER BY posted_at DESC NULLS LAST,source,url LIMIT 6) recent),'[]'::jsonb)`
    : `COALESCE((SELECT jsonb_agg(jsonb_build_object('source',s.name,'url',si.url,'checkedAt',CASE WHEN si.quality_warning IS NOT NULL THEN si.last_verified_at ELSE si.last_checked_at END,'error',si.error) ORDER BY (m.id=j.id) DESC,m.posted_at DESC,s.name,si.url) FROM members m JOIN source_items si ON si.job_id=m.id JOIN sources s ON s.id=si.source_id WHERE m.group_key=j.group_key AND NOT s.retired),'[]'::jsonb)`;
  const statement = countsOnly
    ? metrics
    : metrics.slice(0, cut) +
      `, ranked AS (SELECT j.id, row_number() OVER (ORDER BY ${priority}${ordering},j.id) AS ord FROM searchable j WHERE ${where}), page AS (SELECT r.ord,j.id,j.promotion_rank,j.placement_expires_at,${boosted ? 'j.promotion_rank>0' : 'false'} AS priority_placement,(j.needs_review AND EXISTS(SELECT 1 FROM audit_log changed WHERE changed.job_id=j.id AND changed.action='source.changed' AND changed.created_at>j.published_at)) AS source_changed,${projection} AS published,j.created_at,${sources} AS sources, (SELECT m.id FROM members m WHERE m.group_key=j.group_key ORDER BY m.posted_at DESC NULLS LAST,m.id LIMIT 1) AS canonical_id FROM ranked r JOIN searchable j ON j.id=r.id JOIN jobs record ON record.id=r.id WHERE r.ord > $${args.length + 2} AND r.ord <= $${args.length + 2} + $${args.length + 1})` +
      metrics.slice(cut) +
      `, (SELECT COALESCE(jsonb_agg(to_jsonb(pg) - 'ord' ORDER BY pg.ord),'[]'::jsonb) FROM page pg) AS page_rows`;
  const measured = (
    await publicRead(
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
  /* The descriptions are one click away, and the click is offered with its own
     number. When the narrow search finds nothing at all, it is taken for the
     reader instead: a word like "wordpress" lives only in descriptions. */
  const deepTotal = Number(measured.deep_total ?? 0);
  if (deepTotal > count) search.wider = deepTotal;
  const correction = count === 0 ? suggestSearch(filters.query) : null;
  if (correction) {
    const corrected = new URLSearchParams(params);
    corrected.set('q', correction);
    const plan = searchPlan(corrected, preview, { grouped: true });
    const n = (
      await publicRead(
        `${plan.cte} SELECT count(*)::int count FROM searchable j WHERE ${plan.where}`,
        plan.args,
      )
    ).rows[0].count;
    if (n > 0)
      search.suggestion = { query: correction, count: n, kind: 'spelling' };
  }
  /* Nothing found and no misspelling to blame: one of the words is the reason.
     Ask what the others would find and offer that, instead of leaving the reader
     with nothing but "remove the search word". */
  const shorter =
    count === 0 && !search.suggestion ? shorterSearches(params, preview) : null;
  if (shorter) {
    const counts = (await publicRead(shorter.statement, shorter.args)).rows[0]
      .dropped as Record<string, number>;
    const [best] = Object.entries(counts)
      .map(([index, n]) => ({ index: Number(index), count: Number(n) || 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index);
    const words = best
      ? shorter.queryTerms.filter((_, index) => index !== best.index)
      : [];
    if (best && words.length)
      search.suggestion = {
        query: words.join(' '),
        count: best.count,
        kind: 'fewer-words',
      };
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
  /* Counts and page share the expensive searchable CTE in one statement. The page
     is numbered by the same ordering it is limited by, so the aggregate keeps
     the order without relying on the planner. */
  // Rows arrive as JSON; the timestamp is restored so the response shape is unchanged.
  const pageRows: QueryResultRow[] = measured.page_rows || [];
  for (const r of pageRows) r.created_at = new Date(r.created_at);
  const rows = pageRows;
  const companyKeys = [
    ...new Set(rows.map((r) => companyKey(r.published.company || ''))),
  ];
  const [profilesResult, sharedLogos, employers] = await Promise.all([
    companyKeys.length
      ? publicRead(
          `SELECT company_key,logo_url${summary ? '' : ',website,description'} FROM company_profiles WHERE company_key=ANY($1::text[])`,
          [companyKeys],
        )
      : Promise.resolve({ rows: [] }),
    resolveCompanyLogos(
      rows
        .filter((r) => !r.published.logoUrl)
        .map((r) => r.published.company || ''),
    ),
    preview
      ? Promise.resolve(null)
      : (summary ? employerPagesIfReady() : employerPages()).catch(() => null),
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
      ...((!String(r.published.company || '').trim() &&
        employerlessSources.includes(String(r.published.source || ''))) ||
      contactAsCompany(String(r.published.company || ''))
        ? { company: privateListingLabel }
        : {}),
      id: r.id,
      ...(r.promotion_rank > 0 && r.placement_expires_at
        ? {
            placement: {
              tier: r.promotion_rank === 2 ? 'premium' : 'vip',
              expiresAt: r.placement_expires_at,
              priority: !!r.priority_placement,
            },
          }
        : {}),
      ...(!summary ? { canonicalId: r.canonical_id || r.id } : {}),
      companyPath: employers?.byJob.has(r.id)
        ? `/companies/${encodeURIComponent(employers.byJob.get(r.id)!)}`
        : undefined,
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
      ...(!summary
        ? {
            companyProfile: {
              website:
                companyProfiles.get(companyKey(r.published.company || ''))
                  ?.website || '',
              description:
                companyProfiles.get(companyKey(r.published.company || ''))
                  ?.description || '',
            },
          }
        : {}),
    })),
    preview,
    companyLinksPending: !preview && summary && !employers,
    search,
    ...(params.has('ids') && !preview
      ? await savedAvailability(params.get('ids') || '')
      : {}),
    total: count,
    page,
    pages: Math.ceil(count / limit),
  };
}
/* Unavailable saved items remain under the reader's control. Never expose a draft,
   rejected record, or removed source snapshot through this status lookup. */
async function savedAvailability(raw: string) {
  const ids = [
    ...new Set(raw.split(',').filter((id) => z.uuid().safeParse(id).success)),
  ].slice(0, 100);
  const plan = searchPlan(new URLSearchParams({ ids: ids.join(',') }), false);
  const { rows } = await publicRead(
    `${plan.cte} SELECT j.id::text AS id FROM searchable j WHERE ${plan.where}`,
    plan.args,
  );
  const available = rows.map((r: { id: string }) => r.id);
  const live = new Set(available);
  const missing = ids.filter((id) => !live.has(id));
  const ended = missing.length
    ? (
        await publicRead(
          `SELECT id::text, published->>'title' AS title, published->>'company' AS company,
      COALESCE(published->>'deadline','')<>'' AND published->>'deadline'<to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD') AS expired
      FROM jobs WHERE id=ANY($1::uuid[]) AND status IN ('published','archived') AND published IS NOT NULL`,
          [missing],
        )
      ).rows
    : [];
  const known = new Map(ended.map((row) => [row.id, row]));
  return {
    available,
    unavailable: missing.map((id) => {
      const row = known.get(id);
      return {
        id,
        title: row?.title || 'შენახული ვაკანსია',
        company: row?.company || '',
        expired: row?.expired === true,
      };
    }),
  };
}
export async function adminJobs(
  status: string,
  q: string,
  page = 1,
  source = '',
  jobId: string | null = null,
) {
  // `paused` and `manual` are automation states rather than record statuses: with automatic
  // publication on, the records an editor has to look at are the ones automation stopped
  // managing, not the whole catalogue.
  // The source parameter is numbered differently in the page and count queries, so the
  // predicate is built once and given the placeholder each one uses.
  const where = (sourceParam: string, idParam: string) => `j.status<>'merged'
    AND ($1='all' OR ($1='review' AND j.needs_review=true)
      OR ($1 IN ('submissions','submissions-published','submissions-closed','submissions-all')
        AND EXISTS (SELECT 1 FROM job_submissions sub WHERE sub.job_id=j.id)
        AND CASE $1 WHEN 'submissions' THEN j.status='pending'
          WHEN 'submissions-published' THEN j.status='published'
          WHEN 'submissions-closed' THEN j.status IN ('archived','rejected')
          ELSE true END)
      OR ($1='paused' AND j.automation_paused AND j.status<>'rejected')
      OR ($1='manual' AND NOT j.automation_managed AND j.status<>'rejected')
      OR ($1='blocked' AND j.automation_reason IS NOT NULL AND j.status<>'published')
      OR j.status=$1)
    AND ($2='' OR strpos(lower(concat_ws(' ',j.draft->>'title',j.draft->>'company')),lower($2))>0)
    AND (${idParam}::uuid IS NULL OR j.id=${idParam}::uuid)
    AND (${sourceParam}='' OR EXISTS (SELECT 1 FROM source_items f WHERE f.job_id=j.id AND f.source_id=${sourceParam}))`;
  const rows = (
    await db().query(
      `SELECT j.*,(SELECT requested_placement FROM job_submissions sub WHERE sub.job_id=j.id) AS requested_placement,(SELECT created_at FROM job_submissions sub WHERE sub.job_id=j.id) AS submitted_at,(SELECT jsonb_build_object('status',inv.status,'number',inv.number,'created_at',inv.created_at,'token',inv.token,'amount_gel',inv.amount_gel) FROM job_invoices inv WHERE inv.job_id=j.id) AS invoice,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',si.id,'source_id',si.source_id,'url',si.url,'raw',si.raw,'last_checked_at',si.last_checked_at,'next_check_at',si.next_check_at,'failures',si.failures,'quality_warning',si.quality_warning,'error',si.error)) FROM source_items si WHERE si.job_id=j.id),'[]'::jsonb) AS items,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.draft->>'title','company',d.draft->>'company')) FROM jobs d WHERE d.fingerprint=j.fingerprint AND d.id<>j.id AND d.status NOT IN ('merged','rejected','archived')),'[]'::jsonb) AS duplicates FROM jobs j WHERE ${where('$4', '$5')} ORDER BY j.needs_review DESC,j.updated_at DESC LIMIT 30 OFFSET $3`,
      [status, q, (page - 1) * 30, source, jobId],
    )
  ).rows;
  const total = (
    await db().query(
      `SELECT count(*)::int count FROM jobs j WHERE ${where('$3', '$4')}`,
      [status, q, source, jobId],
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
      count(*) FILTER(WHERE automation_reason IS NOT NULL AND status NOT IN ('merged','rejected','published'))::int blocked,
      count(*) FILTER(WHERE status='pending' AND EXISTS (SELECT 1 FROM job_submissions sub WHERE sub.job_id=jobs.id))::int submissions
      FROM jobs`,
    )
  ).rows[0];
  // An employer's vacancy is offered the free VIP by default, so the editor needs to know
  // up front whether this company has already used it.
  const keys = rows
    .filter((r) => r.submitted_at)
    .map((r) => bonusCompanyKey(r.draft.company || ''));
  const used = new Set(
    keys.length
      ? (
          await db().query(
            'SELECT job_id,bonus_company_key FROM job_submissions WHERE bonus_company_key=ANY($1)',
            [keys],
          )
        ).rows.map((r) => r.bonus_company_key + '|' + r.job_id)
      : [],
  );
  for (const r of rows)
    if (r.submitted_at) {
      const key = bonusCompanyKey(r.draft.company || '');
      r.vip_available =
        key.length >= 2 &&
        ![...used].some(
          (u) => u.startsWith(key + '|') && !u.endsWith('|' + r.id),
        );
    }
  return { jobs: rows, total, counts };
}
export async function bulkPublishCandidates() {
  return (
    await db().query(`SELECT j.id,j.version FROM jobs j
    WHERE j.status='pending' AND NOT EXISTS(SELECT 1 FROM job_submissions sub WHERE sub.job_id=j.id) AND EXISTS (SELECT 1 FROM source_items i
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
  clearPublicJobsCache();
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
        'confirm-payment',
        'confirm-refund',
      ]),
      draft: vacancySchema.optional(),
      placement: z.enum(placementTiers).optional(),
      itemId: z.uuid().optional(),
      targetId: z.uuid().optional(),
    })
    .parse(input);
  // A moderated vacancy has to show (or disappear) on the next list this server builds, not
  // after its held copy expires.
  const result = await transaction(async (c) => {
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
    if (data.action === 'confirm-payment' || data.action === 'confirm-refund') {
      if (
        data.action === 'confirm-payment' &&
        ['rejected', 'archived', 'merged'].includes(job.status)
      )
        throw new ApiError('ეს განცხადება გაუქმებულია');
      await confirmInvoice(c, job.id, data.action);
      return { ok: true };
    }
    if (data.pendingOnly) {
      const active = (
        await c.query(
          `SELECT 1 FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.job_id=$1 AND NOT s.retired LIMIT 1`,
          [job.id],
        )
      ).rowCount;
      if (
        job.status !== 'pending' ||
        !active ||
        (
          await c.query('SELECT 1 FROM job_submissions WHERE job_id=$1', [
            job.id,
          ])
        ).rowCount
      )
        throw new ApiError('ჩანაწერი აღარ არის დასადასტურებელი', 409);
    }
    if (job.status === 'merged')
      throw new ApiError('ვაკანსია უკვე გაერთიანებულია', 409);
    // Handing a record back to automation is the one action that must not pause it again.
    // The source snapshot then decides what the record becomes, exactly as for a new import.
    if (data.action === 'resume-automation') {
      if (
        (
          await c.query(
            "SELECT 1 FROM source_items WHERE job_id=$1 AND source_id='jobx'",
            [job.id],
          )
        ).rowCount
      )
        throw new ApiError(
          'JOBX-ზე დამატებულ განცხადებას ადმინისტრატორი მართავს',
        );
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
      const submission = (
        await c.query(
          'SELECT requested_placement FROM job_submissions WHERE job_id=$1',
          [job.id],
        )
      ).rows[0];
      const placement =
        data.placement ||
        (submission
          ? job.placement_expires_at
            ? job.placement_tier
            : submission.requested_placement
          : undefined);
      if (placement) {
        await approvePlacement(c, job, draft.company, placement);
        if (placement !== 'premium') await cancelUnusedInvoice(c, job.id);
      }
      published = draft;
      status = 'published';
      review = false;
    }
    if (['archive', 'reject', 'merge'].includes(data.action))
      await cancelUnusedInvoice(c, job.id);
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
  clearPublicJobsCache();
  return result;
}
