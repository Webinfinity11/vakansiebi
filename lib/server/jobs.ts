import { z } from 'zod';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { audit } from '../../worker/importer';
import { fingerprint } from '../../worker/adapters';
import type { Vacancy } from '../types';
export const vacancySchema = z.object({
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
  let where = `j.status='published' AND j.published IS NOT NULL AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')) AND ($1='' OR strpos(lower(concat_ws(' ',j.published->>'title',j.published->>'company',j.published->>'description')),lower($1))>0) AND ($2='' OR strpos(j.published->>'city',$2)>0) AND ($3='' OR j.published->>'category'=$3) AND ($4='' OR EXISTS(SELECT 1 FROM source_items si JOIN sources s ON s.id=si.source_id WHERE si.job_id=j.id AND s.name=$4)) AND (NOT $5 OR COALESCE(j.published->>'salary','')<>'') AND (NOT $6 OR j.published->>'mode'='დისტანციური')`;
  if (preview)
    where = where
      .replace(
        "j.status='published' AND j.published IS NOT NULL",
        "j.status IN ('pending','published')",
      )
      .replaceAll('j.published', 'j.draft');
  const args = [q, city, category, source, paid, remote];
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
  if (preview) ordering = ordering.replaceAll('j.published->', 'j.draft->');
  const rows = (
    await db().query(
      `SELECT j.id,${preview ? 'j.draft' : 'j.published'} AS published,j.created_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('source',s.name,'url',si.url)) FROM source_items si JOIN sources s ON s.id=si.source_id WHERE si.job_id=j.id),'[]'::jsonb) AS sources FROM jobs j WHERE ${where} ORDER BY ${ordering},j.id LIMIT $7 OFFSET $8`,
      [...args, limit, (page - 1) * limit],
    )
  ).rows;
  return {
    jobs: rows.map((r) => ({
      ...r.published,
      id: r.id,
      createdAt: r.created_at.toISOString(),
      sources: r.sources,
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
export async function mutateJob(input: unknown) {
  const data = z
    .object({
      id: z.uuid(),
      version: z.number().int(),
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
