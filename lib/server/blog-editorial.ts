import { randomUUID } from 'node:crypto';
import { db, transaction } from './db';
import { blogPosts } from '../blog';
import {
  editorialUrl,
  validateArticle,
  type BlogEvidence,
} from '../blog-editorial';
import { ApiError } from './auth';
import {
  editablePost,
  validateEditableArticle,
  type EditableArticle,
} from '../blog-manual';

export type EditorialArticle = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'rejected';
  content: EditableArticle;
  evidence: BlogEvidence;
  revision: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
export function staticEditorialArticles(): EditorialArticle[] {
  return blogPosts.map((post) => ({
    id: `static:${post.slug}`,
    slug: post.slug,
    title: post.title,
    status: 'published',
    content: editablePost(post),
    revision: 0,
    created_at: post.publishedAt,
    updated_at: post.updatedAt ?? post.publishedAt,
    published_at: post.publishedAt,
    evidence: {
      model: 'static',
      researchedAt: post.updatedAt ?? post.publishedAt,
      notes: 'სარედაქციო ჩანაწერები ინახება docs/ საქაღალდეში.',
      sources: [],
      review: { approved: false, issues: [] },
      usage: [],
    },
  }));
}
export async function editorialArticles() {
  const stored = (
    await db().query<EditorialArticle>(
      'SELECT * FROM blog_articles ORDER BY created_at DESC LIMIT 100',
    )
  ).rows;
  return [
    ...stored,
    ...staticEditorialArticles().filter(
      (post) => !stored.some((row) => row.slug === post.slug),
    ),
  ];
}
export async function createEditorialArticle(input: unknown) {
  return transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(917466)');
    const others = (
      await c.query<{ slug: string; title: string }>(
        'SELECT slug,title FROM blog_articles',
      )
    ).rows;
    let content: EditableArticle;
    try {
      content = validateEditableArticle(input, [...blogPosts, ...others]);
    } catch (error) {
      throw new ApiError(
        error instanceof Error && !('issues' in error)
          ? error.message
          : 'შეამოწმე სათაური, მისამართი და ტექსტის მოცულობა.',
      );
    }
    const evidence: BlogEvidence = {
      model: 'manual',
      researchedAt: new Date().toISOString(),
      notes: 'ხელით შექმნილი სტატია.',
      sources: [],
      review: { approved: false, issues: [] },
      usage: [],
    };
    const { rows } = await c.query<EditorialArticle>(
      'INSERT INTO blog_articles(slug,title,content,evidence) VALUES($1,$2,$3,$4) RETURNING *',
      [content.slug, content.title, content, evidence],
    );
    return rows[0];
  });
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
    if (id.startsWith('static:')) {
      const original = staticEditorialArticles().find((post) => post.id === id);
      if (!original) throw new ApiError('სტატია ვერ მოიძებნა', 404);
      const existing = await c.query(
        'SELECT id FROM blog_articles WHERE slug=$1',
        [original.slug],
      );
      if (existing.rowCount)
        throw new ApiError('სტატია უკვე შეიცვალა. განაახლე გვერდი.', 409);
      const imported = await c.query<{ id: string }>(
        `INSERT INTO blog_articles(slug,title,status,content,evidence,revision,created_at,updated_at,published_at) VALUES($1,$2,'published',$3,$4,0,$5,$6,$5) RETURNING id`,
        [
          original.slug,
          original.title,
          original.content,
          original.evidence,
          original.published_at,
          original.updated_at,
        ],
      );
      id = imported.rows[0].id;
    }
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
    let content: EditableArticle;
    try {
      const duplicateCandidates = [
        ...blogPosts.filter((post) => post.slug !== current.slug),
        ...others,
      ];
      const candidate =
        action === 'save' || action === 'publish'
          ? (input ?? current.content)
          : current.content;
      content = validateEditableArticle(
        candidate,
        duplicateCandidates,
        action === 'publish',
      );
      if (
        action === 'publish' &&
        !['manual', 'static'].includes(current.evidence.model)
      )
        validateArticle(candidate, duplicateCandidates);
    } catch (error) {
      throw new ApiError(
        error instanceof Error && !('issues' in error)
          ? error.message
          : 'შეამოწმე ტექსტი, ქვეთავები და სათაურის უნიკალურობა.',
      );
    }
    if (content.slug !== current.slug)
      throw new ApiError('სტატიის მისამართის შეცვლა დაუშვებელია');
    if (action === 'publish' && content.coverKey === 'none')
      throw new ApiError('გამოქვეყნებამდე შეარჩიე თემის შესაბამისი ბანერი.');
    if (
      action === 'publish' &&
      !['manual', 'static'].includes(current.evidence.model) &&
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
