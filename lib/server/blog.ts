import { cache } from 'react';
import { blogPosts } from '../blog';
import { draftPost } from '../blog-editorial';
import { editableArticleSchema, type EditableArticle } from '../blog-manual';
import { db } from './db';

/** Opt-in until migration 066 is installed; evidence is never selected publicly. */
export const publicBlogPosts = cache(async () => {
  if (process.env.BLOG_STORAGE_ENABLED !== 'true') return [...blogPosts];
  const { rows } = await db().query<{
    slug: string;
    status: string;
    content: EditableArticle;
    published_at: Date;
    updated_at: Date;
  }>(
    `SELECT slug,status,content,published_at,updated_at FROM blog_articles
     WHERE slug=ANY($1::text[]) OR id IN (
       SELECT id FROM blog_articles WHERE status='published' AND published_at<=now()
       ORDER BY published_at DESC LIMIT 500
     ) ORDER BY published_at DESC NULLS LAST`,
    [blogPosts.map((post) => post.slug)],
  );
  const dynamic = rows
    .filter(
      (row) =>
        row.status === 'published' &&
        row.published_at &&
        row.published_at.getTime() <= Date.now(),
    )
    .map((row) =>
      draftPost(
        editableArticleSchema.parse(row.content),
        row.published_at.toISOString(),
        row.updated_at.toISOString(),
      ),
    );
  return [
    ...blogPosts.filter((post) => !rows.some((row) => row.slug === post.slug)),
    ...dynamic,
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
});
export const publicBlogPost = cache(async (slug: string) => {
  const fixed = blogPosts.find((post) => post.slug === slug);
  if (process.env.BLOG_STORAGE_ENABLED !== 'true') return fixed;
  const { rows } = await db().query<{
    status: string;
    content: EditableArticle;
    published_at: Date;
    updated_at: Date;
  }>(
    'SELECT status,content,published_at,updated_at FROM blog_articles WHERE slug=$1',
    [slug],
  );
  const row = rows[0];
  if (!row) return fixed;
  return row.status === 'published' &&
    row.published_at &&
    row.published_at.getTime() <= Date.now()
    ? draftPost(
        editableArticleSchema.parse(row.content),
        row.published_at.toISOString(),
        row.updated_at.toISOString(),
      )
    : undefined;
});
