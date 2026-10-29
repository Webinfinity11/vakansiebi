import { randomUUID } from 'node:crypto';
import { db, transaction } from './db';
import { blogPosts } from '../blog';
import {
  editorialUrl,
  validateArticle,
  type ArticleDraft,
  type BlogEvidence,
} from '../blog-editorial';
import { ApiError } from './auth';

export type EditorialArticle = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'rejected';
  content: ArticleDraft;
  evidence: BlogEvidence;
  revision: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
export async function editorialArticles() {
  return (
    await db().query<EditorialArticle>(
      'SELECT * FROM blog_articles ORDER BY created_at DESC LIMIT 100',
    )
  ).rows;
}
export async function recentArticles() {
  return [
    ...blogPosts.map(({ slug, title }) => ({ slug, title })),
    ...(
      await db().query<{ slug: string; title: string }>(
        'SELECT slug,title FROM blog_articles ORDER BY created_at DESC LIMIT 250',
      )
    ).rows,
  ];
}
export async function claimBlogSlot(slot: string) {
  const lease = randomUUID();
  const { rows } = await db().query<{ lease: string }>(
    `INSERT INTO blog_generation_runs(slot,status,lease) VALUES($1,'running',$2)
    ON CONFLICT(slot) DO UPDATE SET status='running', lease=$2, started_at=now(), finished_at=NULL, attempts=blog_generation_runs.attempts+1, error=NULL
    WHERE blog_generation_runs.attempts<2 AND (blog_generation_runs.status='failed' OR (blog_generation_runs.status='running' AND blog_generation_runs.started_at<now()-interval '30 minutes')) RETURNING lease`,
    [slot, lease],
  );
  return rows[0]?.lease ?? null;
}
export async function failBlogSlot(slot: string, lease: string) {
  // Store a fixed error, never provider bodies, credentials or raw source content.
  await db().query(
    "UPDATE blog_generation_runs SET status='failed',finished_at=now(),error='Generation or editorial validation failed; inspect runner logs.' WHERE slot=$1 AND lease=$2 AND status='running'",
    [slot, lease],
  );
}
export async function saveGeneratedArticle(
  slot: string,
  lease: string,
  input: unknown,
  evidence: BlogEvidence,
) {
  const content = validateArticle(input, await recentArticles());
  if (
    evidence.sources.length < 2 ||
    evidence.sources.some((source) => !editorialUrl(source.url))
  )
    throw new Error('Invalid editorial evidence');
  return transaction(async (c) => {
    const run = await c.query(
      "SELECT slot FROM blog_generation_runs WHERE slot=$1 AND lease=$2 AND status='running' FOR UPDATE",
      [slot, lease],
    );
    if (!run.rowCount) throw new Error('Blog generation lease lost');
    const { rows } = await c.query<{ id: string }>(
      'INSERT INTO blog_articles(slug,title,content,evidence) VALUES($1,$2,$3,$4) RETURNING id',
      [content.slug, content.title, content, evidence],
    );
    await c.query(
      "UPDATE blog_generation_runs SET status='completed',finished_at=now(),article_id=$3 WHERE slot=$1 AND lease=$2",
      [slot, lease, rows[0].id],
    );
    return rows[0].id;
  });
}
export async function updateEditorialArticle(
  id: string,
  revision: number,
  action: 'save' | 'publish' | 'unpublish' | 'reject',
  input?: unknown,
) {
  return transaction(async (c) => {
    // Serialize approvals so concurrent drafts cannot publish equivalent titles.
    await c.query('SELECT pg_advisory_xact_lock(917466)');
    const { rows } = await c.query<EditorialArticle>(
      'SELECT * FROM blog_articles WHERE id=$1 FOR UPDATE',
      [id],
    );
    const current = rows[0];
    if (!current) throw new ApiError('სტატია ვერ მოიძებნა', 404);
    if (current.revision !== revision)
      throw new ApiError('სტატია უკვე შეიცვალა. განაახლე გვერდი.', 409);
    const others = (
      await c.query<{ slug: string; title: string }>(
        'SELECT slug,title FROM blog_articles WHERE id<>$1',
        [id],
      )
    ).rows;
    let content: ArticleDraft;
    try {
      content = validateArticle(input ?? current.content, [
        ...blogPosts,
        ...others,
      ]);
    } catch {
      throw new ApiError(
        'ტექსტი ვერ შემოწმდა: გადაამოწმე მოცულობა, ქართული ტექსტი, ქვეთავები და სათაურის უნიკალურობა.',
      );
    }
    if (content.slug !== current.slug)
      throw new ApiError('სტატიის მისამართის შეცვლა დაუშვებელია');
    if (action === 'publish' && content.coverKey === 'none')
      throw new ApiError('გამოქვეყნებამდე შეარჩიე თემის შესაბამისი ბანერი.');
    if (
      action === 'publish' &&
      (current.evidence.sources.length < 2 ||
        current.evidence.sources.some((source) => !editorialUrl(source.url)))
    )
      throw new ApiError('გამოქვეყნებისთვის გადამოწმებული წყაროებია საჭირო.');
    if (action === 'save' && current.status === 'published')
      throw new ApiError(
        'გამოქვეყნებული სტატიის შესაცვლელად გადაამოწმე ტექსტი და გამოიყენე გამოქვეყნების ღილაკი.',
      );
    const status =
      action === 'publish'
        ? 'published'
        : action === 'reject'
          ? 'rejected'
          : action === 'unpublish'
            ? 'draft'
            : current.status;
    const saved = await c.query<EditorialArticle>(
      `UPDATE blog_articles SET content=$2,title=$3,status=$4,revision=revision+1,updated_at=now(),published_at=CASE WHEN $4='published' THEN coalesce(published_at,now()) ELSE published_at END,human_reviewed_at=CASE WHEN $4='published' THEN now() ELSE human_reviewed_at END WHERE id=$1 RETURNING *`,
      [id, content, content.title, status],
    );
    return saved.rows[0];
  });
}
