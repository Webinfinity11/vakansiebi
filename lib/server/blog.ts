import { cache } from 'react';
import { blogPosts } from '../blog';
import {
  draftPost,
  articleDraftSchema,
  type ArticleDraft,
} from '../blog-editorial';
import { db } from './db';

/** Opt-in until migration 066 is installed; evidence is never selected publicly. */
export const publicBlogPosts = cache(async () => {
  if (process.env.BLOG_STORAGE_ENABLED !== 'true') return [...blogPosts];
  const { rows } = await db().query<{
    content: ArticleDraft;
    published_at: Date;
    updated_at: Date;
  }>(
    "SELECT content,published_at,updated_at FROM blog_articles WHERE status='published' AND published_at<=now() ORDER BY published_at DESC LIMIT 500",
  );
  const dynamic = rows.map((row) =>
    draftPost(
      articleDraftSchema.parse(row.content),
      row.published_at.toISOString(),
      row.updated_at.toISOString(),
    ),
  );
  return [
    ...blogPosts,
    ...dynamic.filter((p) => !blogPosts.some((s) => s.slug === p.slug)),
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
});
export const publicBlogPost = cache(async (slug: string) => {
  const fixed = blogPosts.find((post) => post.slug === slug);
  if (fixed || process.env.BLOG_STORAGE_ENABLED !== 'true') return fixed;
  const { rows } = await db().query<{
    content: ArticleDraft;
    published_at: Date;
    updated_at: Date;
  }>(
    "SELECT content,published_at,updated_at FROM blog_articles WHERE slug=$1 AND status='published' AND published_at<=now()",
    [slug],
  );
  const row = rows[0];
  return row
    ? draftPost(
        articleDraftSchema.parse(row.content),
        row.published_at.toISOString(),
        row.updated_at.toISOString(),
      )
    : undefined;
});
