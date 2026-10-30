import { z } from 'zod';
import type { BlogPost } from './blog';
import { blogCovers } from './blog-covers';

const prose = (min: number, max: number) => z.string().trim().min(min).max(max);
export const articleDraftSchema = z
  .object({
    coverKey: z.enum(['none', 'cv', 'interview', 'daily-pay', 'part-time']),
    slug: z
      .string()
      .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
      .min(8)
      .max(100),
    category: prose(3, 90),
    title: prose(15, 150),
    description: prose(50, 220),
    takeaway: prose(50, 500),
    sections: z
      .array(
        z
          .object({
            id: z
              .string()
              .regex(/^[a-z][a-z0-9-]*$/)
              .max(60),
            title: prose(8, 140),
            paragraphs: z
              .array(z.object({ text: prose(40, 2200) }).strict())
              .min(1)
              .max(5),
            checklist: z.array(prose(10, 400)).max(10),
          })
          .strict(),
      )
      .min(3)
      .max(7),
  })
  .strict();
export type ArticleDraft = z.infer<typeof articleDraftSchema>;
export type BlogEvidence = {
  researchedAt: string;
  model: string;
  notes: string;
  sources: { url: string; title: string }[];
  review: { approved: boolean; issues: string[] };
  usage: unknown[];
};
export const editorialDomains = [
  'nationalcareers.service.gov.uk',
  'europass.europa.eu',
  'careerservices.fas.harvard.edu',
];
export function editorialUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      editorialDomains.some(
        (domain) => u.hostname === domain || u.hostname.endsWith('.' + domain),
      )
    );
  } catch {
    return false;
  }
}
export const editorialTracks = [
  'რეზიუმე: კონკრეტული უნარის ან პროექტის აღწერა',
  'გასაუბრება: ერთი რთული კითხვისთვის მომზადება',
  'პირველი სამსახური და გამოცდილების გარეშე განაცხადი',
  'სამუშაო შეთავაზებების შედარება: გრაფიკი, მგზავრობა და მოვალეობები',
  'კარიერის შეცვლა და არსებული უნარების წარმოჩენა',
  'დამსაქმებელთან წერილობითი კომუნიკაცია',
  'ონლაინ გასაუბრებისთვის პრაქტიკული მომზადება',
  'სტაჟირებისთვის განაცხადის მომზადება',
  'რეზიუმეს მორგება კონკრეტულ პროფესიაზე',
  'სტუდენტის სამუშაო გრაფიკის დაგეგმვა',
  'პირველი სამუშაო კვირისთვის მომზადება',
  'პირადი პორტფოლიო და საკუთარი ნამუშევრების აღწერა',
] as const;

/** At most one run on a scheduled Tbilisi date, including delayed Actions runs. */
export function blogSlot(now: Date, weeklyPosts = 4): string | null {
  if (![3, 4].includes(weeklyPosts))
    throw new Error('BLOG_WEEKLY_POSTS must be 3 or 4');
  const local = new Date(now.getTime() + 4 * 3600_000);
  const days = weeklyPosts === 3 ? [1, 4, 6] : [1, 2, 4, 6];
  return days.includes(local.getUTCDay()) && local.getUTCHours() >= 10
    ? local.toISOString().slice(0, 10)
    : null;
}
export function articleText(draft: ArticleDraft) {
  return [
    draft.title,
    draft.description,
    draft.takeaway,
    ...draft.sections.flatMap((s) => [
      s.title,
      ...s.paragraphs.map((p) => p.text),
      ...s.checklist,
    ]),
  ].join('\n');
}
export function similarTitle(a: string, b: string) {
  const words = (s: string) =>
    new Set(s.toLowerCase().match(/[ა-ჰa-z0-9]+/g) || []);
  const left = words(a),
    right = words(b);
  const union = new Set([...left, ...right]);
  return (
    union.size > 0 &&
    [...left].filter((w) => right.has(w)).length / union.size >= 0.7
  );
}
export function validateArticle(
  input: unknown,
  recent: { slug: string; title: string }[] = [],
) {
  const draft = articleDraftSchema.parse(input);
  const text = articleText(draft);
  if (text.split(/\s+/).length < 200) throw new Error('Article is too short');
  const letters = text.match(/\p{L}/gu) || [];
  if ((text.match(/[ა-ჰ]/g) || []).length / Math.max(1, letters.length) < 0.85)
    throw new Error('Article must be in Georgian');
  if (
    /https?:|www\.|<[^>]+>|\]\(|【|\[\d+\]|(?:jobs|hr|myjobs|awork|insource)\.ge|წყაროები\s*:/i.test(
      text,
    )
  )
    throw new Error(
      'Public articles must not contain sources, citations, competitor links or HTML',
    );
  if (new Set(draft.sections.map((s) => s.id)).size !== draft.sections.length)
    throw new Error('Duplicate section anchors');
  if (
    recent.some(
      (p) => p.slug === draft.slug || similarTitle(p.title, draft.title),
    )
  )
    throw new Error('Article duplicates an existing topic');
  return draft;
}
export function draftPost(
  draft: ArticleDraft & { links?: BlogPost['links'] },
  publishedAt: string,
  updatedAt?: string,
): BlogPost {
  return {
    ...draft,
    cover: draft.coverKey === 'none' ? undefined : blogCovers[draft.coverKey],
    publishedAt,
    updatedAt,
    links: draft.links ?? [
      { label: 'ვაკანსიების ნახვა', href: '/' },
      { label: 'რეზიუმეს შექმნა', href: '/cv' },
      { label: 'ბლოგი', href: '/blog' },
    ],
  };
}
