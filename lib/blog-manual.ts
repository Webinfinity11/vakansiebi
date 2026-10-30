import { z } from 'zod';
import type { BlogPost } from './blog';
import {
  articleDraftSchema,
  articleText,
  similarTitle,
} from './blog-editorial';
import { blogCovers } from './blog-covers';

// Manual drafts can be saved while incomplete. Generated articles keep their
// stricter writing schema; publication still validates the public content.
const text = (max: number) => z.string().max(max);
export const editableArticleSchema = articleDraftSchema.extend({
  title: z.string().trim().min(1).max(150),
  category: text(90),
  description: text(220),
  takeaway: text(500),
  sections: z
    .array(
      z
        .object({
          id: z
            .string()
            .regex(/^[a-z][a-z0-9-]*$/)
            .max(60),
          title: text(140),
          paragraphs: z.array(z.object({ text: text(12000) }).strict()).max(20),
          checklist: z.array(text(800)).max(30),
          table: z
            .object({
              caption: text(300),
              columns: z.array(text(300)).min(1).max(10),
              rows: z.array(z.array(text(2000)).min(1).max(10)).max(50),
              note: text(2000),
            })
            .strict()
            .optional(),
        })
        .strict(),
    )
    .min(1)
    .max(20),
  links: z
    .array(
      z
        .object({
          label: z.string().trim().min(1).max(120),
          href: z
            .string()
            .max(500)
            .regex(/^\/(?!\/)[^\s\\]*$/),
        })
        .strict(),
    )
    .max(12)
    .optional(),
});
export type EditableArticle = z.infer<typeof editableArticleSchema>;

export function editablePost(post: BlogPost): EditableArticle {
  return {
    slug: post.slug,
    title: post.title,
    category: post.category,
    description: post.description,
    takeaway: post.takeaway,
    coverKey:
      (Object.keys(blogCovers) as (keyof typeof blogCovers)[]).find(
        (key) => blogCovers[key].src === post.cover?.src,
      ) ?? 'none',
    sections: post.sections.map((section) => ({
      ...section,
      checklist: section.checklist ?? [],
    })),
    links: post.links,
  };
}

export function validateEditableArticle(
  input: unknown,
  others: { slug: string; title: string }[],
  publish = false,
) {
  const draft = editableArticleSchema.parse(input);
  if (
    new Set(draft.sections.map((section) => section.id)).size !==
    draft.sections.length
  )
    throw new Error('ქვეთავების მისამართები მეორდება.');
  if (
    others.some(
      (post) =>
        post.slug === draft.slug || similarTitle(post.title, draft.title),
    )
  )
    throw new Error('ამ სათაურით ან მისამართით სტატია უკვე არსებობს.');
  if (publish) {
    if (
      draft.title.trim().length < 8 ||
      !draft.category.trim() ||
      draft.description.trim().length < 20 ||
      draft.takeaway.trim().length < 20 ||
      draft.sections.some(
        (section) =>
          !section.title.trim() ||
          !section.paragraphs.some((p) => p.text.trim().length >= 20),
      )
    )
      throw new Error(
        'გამოქვეყნებამდე შეავსე სათაური, თემა, აღწერა, მთავარი რჩევა და ქვეთავების ტექსტი.',
      );
    const body = [
      articleText(draft),
      ...draft.sections.flatMap((section) =>
        section.table
          ? [
              section.table.caption,
              ...section.table.columns,
              ...section.table.rows.flat(),
              section.table.note,
            ]
          : [],
      ),
      ...(draft.links ?? []).map((link) => link.label),
    ].join('\n');
    if (
      /https?:|www\.|<[^>]+>|\]\(|【|\[\d+\]|(?:jobs|hr|myjobs|awork|insource)\.ge|წყაროები\s*:/i.test(
        body,
      )
    )
      throw new Error(
        'საჯარო ტექსტში წყაროების ბმულები, ციტირებები და HTML არ უნდა იყოს.',
      );
    if (
      (body.match(/[ა-ჰ]/g) ?? []).length /
        Math.max(1, (body.match(/\p{L}/gu) ?? []).length) <
      0.85
    )
      throw new Error('სტატიის ტექსტი ქართულად უნდა იყოს.');
  }
  return draft;
}
