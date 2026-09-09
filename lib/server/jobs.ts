import { z } from 'zod';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { audit } from '../../worker/importer';
import { fingerprint } from '../../worker/adapters';
import type { Vacancy } from '../types';
import { safeLogoUrl } from '../vacancy-media';
import { companyKey } from '../company-key';
import { searchTerms, sourceHealth } from '../job-intelligence';
export const vacancySchema = z.object({
  logoUrl: z
    .string()
    .max(2000)
    .optional()
    .default('')
    .refine((v) => !v || safeLogoUrl(v) === v, 'ლოგოს მისამართი დაუშვებელია'),
  employmentType: z.string().max(150).optional().default(''),
  facts: z
    .array(
      z.object({ label: z.string().max(200), value: z.string().max(1500) }),
    )
    .max(30)
    .optional()
    .default([]),
  applicationLinks: z
    .array(
      z.object({
        label: z.string().max(150),
        url: z
          .url()
          .refine(
            (v) =>
              new URL(v).protocol === 'https:' &&
              !new URL(v).username &&
              !new URL(v).password,
          ),
      }),
    )
    .max(12)
    .optional()
    .default([]),
  warnings: z.array(z.string().max(500)).max(10).optional().default([]),
  title: z.string().trim().min(2).max(300),
  company: z.string().trim().max(300),
  city: z.string().max(300),
  category: z.string().max(100),
  salary: z.string().max(300),
  salaryMin: z.number().nonnegative().max(100000000).nullable(),
  currency: z.string().max(20),
  salaryPeriod: z.string().max(30),
  mode: z.string().max(100),
  description: z.string().trim().min(40).max(100000),
  url: z.url().refine((v) => new URL(v).protocol === 'https:'),
  source: z.string().max(100),
  deadline: z.string().refine(validDate),
  datePosted: z.string().refine(validDate),
});
function validDate(s: string) {
  return (
    s === '' ||
    (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s)
  );
}
export async function publicJobs(params: URLSearchParams, preview = false) {
  const page = Math.max(1, Math.min(10000, Number(params.get('page')) || 1));
  const limit = 20;
  const q = (params.get('q') || '').slice(0, 200);
  const city = params.get('city') || '';
  const category = params.get('category') || '';
  const source = params.get('source') || '';
  const paid = params.get('paid') === 'true';
  const remote = params.get('remote') === 'true';
  let where = `j.status='published' AND j.published IS NOT NULL AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')) AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text($1::jsonb) term WHERE strpos(lower(concat_ws(' ',j.published->>'title',j.published->>'company',j.published->>'city',j.published->>'description')),term)=0) AND ($2='' OR strpos(j.published->>'city',$2)>0) AND ($3='' OR j.published->>'category'=$3) AND ($4='' OR EXISTS(SELECT 1 FROM source_items si JOIN sources s ON s.id=si.source_id WHERE si.job_id=j.id AND NOT s.retired AND s.name=$4)) AND (NOT $5 OR COALESCE(j.published->>'salary','')<>'') AND (NOT $6 OR j.published->>'mode'='დისტანციური')`;
  if (preview)
    where = where
      .replace(
        "j.status='published' AND j.published IS NOT NULL",
        "j.status IN ('pending','published')",
      )
      .replaceAll('j.published', 'j.draft');
  where +=
    ' AND EXISTS(SELECT 1 FROM source_items active_item JOIN sources active_source ON active_source.id=active_item.source_id WHERE active_item.job_id=j.id AND NOT active_source.retired)';
  const args = [
    JSON.stringify(searchTerms(q)),
    city,
    category,
    source,
    paid,
    remote,
  ];
  const requestedIds = params.get('ids');
  if (requestedIds !== null) {
    const ids = requestedIds
      .split(',')
      .filter((id) => z.uuid().safeParse(id).success)
      .slice(0, 100);
    where += ` AND j.id::text = ANY(string_to_array($7,','))`;
    args.push(ids.join(','));
  }
  const count = (
    await db().query(
      `SELECT count(*)::int AS count FROM jobs j WHERE ${where}`,
      args,
    )
  ).rows[0].count;
  let ordering =
    params.get('sort') === 'salary'
      ? `CASE WHEN j.published->>'currency'='GEL' AND j.published->>'salaryPeriod'='თვე' THEN (j.published->>'salaryMin')::numeric END DESC NULLS LAST,j.published_at DESC`
      : 'j.published_at DESC';
  if (params.get('sort') === 'deadline')
    ordering =
      "NULLIF(j.published->>'deadline','') ASC NULLS LAST,j.published_at DESC";
  if (
    q.trim() &&
    !['salary', 'new', 'deadline'].includes(params.get('sort') || '')
  ) {
    ordering = `(SELECT COALESCE(sum(CASE WHEN strpos(lower(j.published->>'title'),term)>0 THEN 5 ELSE 0 END + CASE WHEN strpos(lower(j.published->>'company'),term)>0 THEN 2 ELSE 0 END),0) FROM jsonb_array_elements_text($1::jsonb) term) DESC,j.published_at DESC`;
  }
  if (preview) ordering = ordering.replaceAll('j.published->', 'j.draft->');
  if (preview) ordering = ordering.replaceAll('j.published_at', 'j.created_at');
  const summary = params.get('summary') === '1';
  const snapshot = preview ? 'j.draft' : 'j.published';
  const projection = summary
    ? `(${snapshot} - ARRAY['description','facts','applicationLinks','warnings'])`
    : snapshot;
  const rows = (
    await db().query(
      `SELECT j.id,(j.needs_review AND EXISTS(SELECT 1 FROM audit_log changed WHERE changed.job_id=j.id AND changed.action='source.changed' AND changed.created_at>j.published_at)) AS source_changed,${projection} AS published,j.created_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('source',s.name,'url',si.url,'checkedAt',si.last_checked_at,'error',si.error)) FROM source_items si JOIN sources s ON s.id=si.source_id WHERE si.job_id=j.id AND NOT s.retired),'[]'::jsonb) AS sources FROM jobs j WHERE ${where} ORDER BY ${ordering},j.id LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, limit, (page - 1) * limit],
    )
  ).rows;
  const companyKeys = [
    ...new Set(rows.map((r) => companyKey(r.published.company || ''))),
  ];
  const profiles = companyKeys.length
    ? (
        await db().query(
          'SELECT * FROM company_profiles WHERE company_key=ANY($1::text[])',
          [companyKeys],
        )
      ).rows
    : [];
  const companyProfiles = new Map(profiles.map((p) => [p.company_key, p]));
  return {
    jobs: rows.map((r) => ({
      description: '',
      ...r.published,
      summary,
      ...(typeof r.published.salaryMin === 'number' &&
      (!Number.isFinite(r.published.salaryMin) ||
        r.published.salaryMin > 100000000 ||
        r.published.salaryMin < 0)
        ? { salary: '', salaryMin: null, currency: '', salaryPeriod: '' }
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
    total: count,
    page,
    pages: Math.ceil(count / limit),
  };
}
export async function adminJobs(status: string, q: string, page = 1) {
  const where = `j.status<>'merged' AND ($1='all' OR ($1='review' AND j.needs_review=true) OR j.status=$1) AND ($2='' OR strpos(lower(concat_ws(' ',j.draft->>'title',j.draft->>'company')),lower($2))>0)`;
  const rows = (
    await db().query(
      `SELECT j.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',si.id,'source_id',si.source_id,'url',si.url,'raw',si.raw,'last_checked_at',si.last_checked_at,'error',si.error)) FROM source_items si WHERE si.job_id=j.id),'[]'::jsonb) AS items,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.draft->>'title','company',d.draft->>'company')) FROM jobs d WHERE d.fingerprint=j.fingerprint AND d.id<>j.id AND d.status NOT IN ('merged','rejected','archived')),'[]'::jsonb) AS duplicates FROM jobs j WHERE ${where} ORDER BY j.needs_review DESC,j.updated_at DESC LIMIT 30 OFFSET $3`,
      [status, q, (page - 1) * 30],
    )
  ).rows;
  const total = (
    await db().query(`SELECT count(*)::int count FROM jobs j WHERE ${where}`, [
      status,
      q,
    ])
  ).rows[0].count;
  const counts = (
    await db().query(
      "SELECT count(*) FILTER(WHERE status='pending')::int pending,count(*) FILTER(WHERE status='published')::int published,count(*) FILTER(WHERE needs_review AND status<>'merged')::int review,count(*) FILTER(WHERE status='archived')::int archived FROM jobs",
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
        'UPDATE jobs SET needs_review=true,version=version+1,updated_at=now() WHERE id=$1',
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
      "UPDATE jobs SET draft=$2,published=$3,status=$4,needs_review=$5,fingerprint=$6,version=version+1,updated_at=now(),published_at=CASE WHEN $7='publish' THEN now() ELSE published_at END WHERE id=$1",
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
