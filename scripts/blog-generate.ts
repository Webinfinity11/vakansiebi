import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { blogSlot, editorialTracks } from '../lib/blog-editorial';
import {
  claimBlogSlot,
  failBlogSlot,
  recentArticles,
  saveGeneratedArticle,
} from '../lib/server/blog-editorial';
import { generateBlogDraft } from '../lib/server/blog-generator';
import { db } from '../lib/server/db';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--dry-run'))
  throw new Error(
    'Only --dry-run is supported. Generation always observes the weekly schedule.',
  );
const slot = blogSlot(new Date(), Number(process.env.BLOG_WEEKLY_POSTS || 4));
const enabled = process.env.BLOG_AUTOMATION_ENABLED === 'true';
if (args.includes('--dry-run')) {
  console.log(
    JSON.stringify({
      enabled,
      slot,
      mode: 'draft',
      weeklyPosts: Number(process.env.BLOG_WEEKLY_POSTS || 4),
      configured: {
        apiKey: !!process.env.OPENAI_API_KEY,
        model: !!process.env.BLOG_AI_MODEL,
        database: !!process.env.DATABASE_URL,
      },
      schedule:
        '10:00 Asia/Tbilisi; Mon, Thu, Sat; plus Tue when weeklyPosts=4',
      writes: false,
    }),
  );
} else if (!enabled || !slot) {
  console.log(
    enabled ? 'No blog slot is due today.' : 'Blog automation is disabled.',
  );
} else {
  if (
    !process.env.OPENAI_API_KEY ||
    !process.env.BLOG_AI_MODEL ||
    !process.env.DATABASE_URL
  )
    throw new Error(
      'Configure OPENAI_API_KEY, BLOG_AI_MODEL and DATABASE_URL before activation.',
    );
  let lease: string | null = null;
  try {
    lease = await claimBlogSlot(slot);
    if (!lease)
      console.log('This slot is already claimed or completed; no generation.');
    else {
      const recent = await recentArticles();
      const count = (
        await db().query<{ count: number }>(
          "SELECT count(*)::int AS count FROM blog_generation_runs WHERE status='completed'",
        )
      ).rows[0].count;
      const result = await generateBlogDraft(
        editorialTracks[count % editorialTracks.length],
        recent,
        {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.BLOG_AI_MODEL,
        },
      );
      const id = await saveGeneratedArticle(
        slot,
        lease,
        result.draft,
        result.evidence,
      );
      // Private editorial evidence is retained in the DB and exported under docs/.
      // The workflow keeps this as an artifact; no Git commit or website build.
      await mkdir('docs/blog-automation', { recursive: true });
      await writeFile(
        `docs/blog-automation/${slot}.json`,
        JSON.stringify(
          { id, slot, slug: result.draft.slug, evidence: result.evidence },
          null,
          2,
        ) + '\n',
      );
      console.log(
        JSON.stringify({
          id,
          slug: result.draft.slug,
          status: 'draft',
          reviewPassed: result.evidence.review.approved,
        }),
      );
    }
  } catch {
    if (lease) await failBlogSlot(slot, lease);
    console.error(
      'Blog generation failed. No article was automatically published. Check provider configuration and the editorial run record.',
    );
    process.exitCode = 1;
  } finally {
    await db().end();
  }
}
