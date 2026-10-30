import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { blogGuides } from '../lib/blog-guides';
import { blogPosts } from '../lib/blog';
import { editablePost } from '../lib/blog-manual';
import {
  claimBlogSlot,
  saveGeneratedArticle,
  updateEditorialArticle,
  failBlogSlot,
  createEditorialArticle,
  editorialArticles,
} from '../lib/server/blog-editorial';
import { publicBlogPosts, publicBlogPost } from '../lib/server/blog';
import type { ArticleDraft, BlogEvidence } from '../lib/blog-editorial';

void test(
  'editorial storage isolates drafts, claims slots once and publishes only the reviewed revision',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'blog_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: url.href });
    const originalUrl = process.env.DATABASE_URL,
      originalEnabled = process.env.BLOG_STORAGE_ENABLED;
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await client.query(
        readFileSync('db/migrations/066_blog_editorial.sql', 'utf8'),
      );
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      process.env.BLOG_STORAGE_ENABLED = 'true';
      const claims = await Promise.all([
        claimBlogSlot('2026-10-29'),
        claimBlogSlot('2026-10-29'),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const lease = claims.find(Boolean)!;
      const post = blogGuides[0];
      const content: ArticleDraft = {
        coverKey: 'cv',
        slug: 'editorial-integration-example',
        title: 'პროექტის აღწერა პირველი განაცხადისთვის',
        category: post.category,
        description: post.description,
        takeaway: post.takeaway,
        sections: post.sections.map((section) => ({
          ...section,
          checklist: section.checklist ?? [],
        })),
      };
      const evidence: BlogEvidence = {
        researchedAt: new Date().toISOString(),
        model: 'test-model',
        notes: 'PRIVATE_RESEARCH_MUST_NOT_BE_PUBLIC',
        sources: [
          {
            url: 'https://nationalcareers.service.gov.uk/careers-advice/cv-sections',
            title: 'CV',
          },
          {
            url: 'https://europass.europa.eu/en/create-europass-cv',
            title: 'Europass',
          },
        ],
        review: { approved: true, issues: [] },
        usage: [],
      };
      await assert.rejects(
        saveGeneratedArticle('2026-10-29', randomUUID(), content, evidence),
        /lease lost/,
      );
      const id = await saveGeneratedArticle(
        '2026-10-29',
        lease,
        content,
        evidence,
      );
      assert.equal(await claimBlogSlot('2026-10-29'), null);
      assert.equal(await publicBlogPost(content.slug), undefined);
      assert.equal(
        (await publicBlogPosts()).some((p) => p.slug === content.slug),
        false,
      );
      const published = await updateEditorialArticle(id, 1, 'publish');
      assert.equal(published.status, 'published');
      assert.equal(published.revision, 2);
      const visible = await publicBlogPost(content.slug);
      assert.equal(visible?.title, content.title);
      assert.ok(visible?.publishedAt);
      assert.equal(JSON.stringify(visible).includes('PRIVATE_RESEARCH'), false);
      assert.equal(Object.hasOwn(visible!, 'evidence'), false);
      await assert.rejects(
        updateEditorialArticle(id, 1, 'save'),
        /უკვე შეიცვალა/,
      );
      await assert.rejects(
        updateEditorialArticle(id, 2, 'save'),
        /გამოქვეყნებული/,
      );
      const unpublished = await updateEditorialArticle(id, 2, 'unpublish');
      assert.equal(unpublished.status, 'draft');
      assert.equal(await publicBlogPost(content.slug), undefined);
      const restored = await updateEditorialArticle(id, 3, 'publish');
      assert.equal(
        new Date(restored.published_at!).toISOString(),
        new Date(published.published_at!).toISOString(),
      );
      const manual = await createEditorialArticle({
        ...content,
        slug: 'manual-article-example',
        title: 'სამუშაო პირობების შეთანხმება დამსაქმებელთან',
        sections: [
          { id: 'first', title: '', paragraphs: [{ text: '' }], checklist: [] },
        ],
      });
      assert.equal(manual.status, 'draft');
      assert.equal(await publicBlogPost(manual.slug), undefined);
      await assert.rejects(
        updateEditorialArticle(manual.id, 1, 'publish'),
        /შეავსე/,
      );
      const filled = {
        ...manual.content,
        sections: [
          {
            id: 'first',
            title: 'სამუშაო პირობების განხილვა',
            paragraphs: [
              {
                text: 'შეთავაზების მიღებამდე დამსაქმებელთან განიხილე სამუშაო გრაფიკი, მოვალეობები და ანაზღაურების პირობები.',
              },
            ],
            checklist: [],
          },
        ],
      };
      await updateEditorialArticle(manual.id, 1, 'publish', filled);
      assert.equal((await publicBlogPost(manual.slug))?.title, manual.title);
      await assert.rejects(createEditorialArticle(filled), /უკვე არსებობს/);
      const original = blogPosts.find((post) =>
        post.sections.some((section) => section.table),
      )!;
      assert.ok(
        (await editorialArticles()).some(
          (post) => post.id === `static:${original.slug}`,
        ),
      );
      const edit = {
        ...editablePost(original),
        description: original.description + ' დამატებითი ინფორმაცია.',
      };
      const edited = await updateEditorialArticle(
        `static:${original.slug}`,
        0,
        'publish',
        edit,
      );
      assert.equal(edited.revision, 1);
      const publicEdit = await publicBlogPost(original.slug);
      assert.equal(publicEdit?.description, edit.description);
      assert.deepEqual(
        publicEdit?.sections.find((section) => section.table)?.table,
        original.sections.find((section) => section.table)?.table,
      );
      assert.deepEqual(publicEdit?.links, original.links);
      assert.equal(
        (await publicBlogPosts()).filter((post) => post.slug === original.slug)
          .length,
        1,
      );
      await assert.rejects(
        updateEditorialArticle(`static:${original.slug}`, 0, 'publish', edit),
        /უკვე შეიცვალა/,
      );
      await updateEditorialArticle(edited.id, 1, 'unpublish');
      assert.equal(
        await publicBlogPost(original.slug),
        undefined,
        'unpublishing a migrated static article must not restore its old public copy',
      );
      assert.equal(
        (await publicBlogPosts()).some((post) => post.slug === original.slug),
        false,
      );
      process.env.BLOG_STORAGE_ENABLED = 'false';
      assert.equal(await publicBlogPost(content.slug), undefined);
      const failedLease = await claimBlogSlot('2026-10-31');
      assert.ok(failedLease);
      await failBlogSlot('2026-10-31', failedLease);
      const retry = await claimBlogSlot('2026-10-31');
      assert.ok(retry);
      assert.notEqual(retry, failedLease);
      await failBlogSlot('2026-10-31', retry);
      assert.equal(await claimBlogSlot('2026-10-31'), null);
    } finally {
      const globalDb = globalThis as unknown as {
        ertadPool?: ReturnType<typeof db>;
      };
      if (globalDb.ertadPool) {
        await globalDb.ertadPool.end();
        delete globalDb.ertadPool;
      }
      process.env.DATABASE_URL = originalUrl;
      if (originalEnabled === undefined)
        delete process.env.BLOG_STORAGE_ENABLED;
      else process.env.BLOG_STORAGE_ENABLED = originalEnabled;
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    }
  },
);
