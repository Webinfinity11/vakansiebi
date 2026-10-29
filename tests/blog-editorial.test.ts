import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blogSlot,
  validateArticle,
  editorialUrl,
  similarTitle,
  type ArticleDraft,
} from '../lib/blog-editorial';
import { blogGuides } from '../lib/blog-guides';
import { generateBlogDraft } from '../lib/server/blog-generator';

export function articleFixture(): ArticleDraft {
  const { slug, category, title, description, takeaway, sections } =
    blogGuides[0];
  return {
    coverKey: 'cv',
    slug,
    category,
    title,
    description,
    takeaway,
    sections: sections.map((section) => ({
      ...section,
      checklist: section.checklist ?? [],
    })),
  };
}
void test('weekly slots follow Tbilisi time, enforce 3 or 4 and do not catch up other days', () => {
  assert.equal(blogSlot(new Date('2026-10-26T05:59:59Z')), null);
  assert.equal(blogSlot(new Date('2026-10-26T06:00:00Z')), '2026-10-26');
  assert.equal(blogSlot(new Date('2026-10-27T06:00:00Z'), 3), null);
  assert.equal(blogSlot(new Date('2026-10-27T06:00:00Z'), 4), '2026-10-27');
  assert.equal(blogSlot(new Date('2026-10-28T09:00:00Z')), null);
  assert.equal(blogSlot(new Date('2026-10-29T19:59:59Z')), '2026-10-29');
  assert.equal(blogSlot(new Date('2026-10-29T20:00:00Z')), null);
  assert.throws(() => blogSlot(new Date(), 5));
});
void test('public article validation rejects sources, HTML, repetition and mostly non-Georgian text', () => {
  const draft = articleFixture();
  assert.equal(validateArticle(draft).slug, draft.slug);
  for (const text of [
    'https://hr.ge',
    '<script>alert(1)</script>',
    'წყაროები:',
    '【1】',
  ])
    assert.throws(() =>
      validateArticle({ ...draft, takeaway: draft.takeaway + text }),
    );
  assert.throws(() =>
    validateArticle(draft, [{ slug: draft.slug, title: 'სხვა' }]),
  );
  assert.throws(() =>
    validateArticle({
      ...draft,
      sections: draft.sections.map((s) => ({ ...s, id: 'duplicate' })),
    }),
  );
  assert.throws(() =>
    validateArticle({
      ...draft,
      takeaway: 'hello '.repeat(60),
      sections: draft.sections.map((s) => ({
        ...s,
        paragraphs: [{ text: 'English text '.repeat(100) }],
      })),
    }),
  );
  assert.equal(
    similarTitle(
      'როგორ მოვემზადოთ გასაუბრებისთვის',
      'გასაუბრებისთვის როგორ მოვემზადოთ',
    ),
    true,
  );
  assert.equal(
    editorialUrl('https://nationalcareers.service.gov.uk/careers-advice'),
    true,
  );
  assert.equal(
    editorialUrl('https://nationalcareers.service.gov.uk.evil.example/x'),
    false,
  );
  assert.equal(
    editorialUrl('https://user:secret@nationalcareers.service.gov.uk/x'),
    false,
  );
});
void test('generator researches, writes and reviews with bounded private requests and verified sources', async () => {
  const draft = articleFixture();
  const calls: Record<string, unknown>[] = [];
  const results = [
    {
      status: 'completed',
      output: [
        {
          type: 'web_search_call',
          action: {
            sources: [
              {
                url: 'https://nationalcareers.service.gov.uk/careers-advice/cv-sections',
                title: 'CV',
              },
              {
                url: 'https://europass.europa.eu/en/create-europass-cv',
                title: 'CV guidance',
              },
            ],
          },
        },
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'Private verified notes' }],
        },
      ],
    },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(draft) }],
        },
      ],
    },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ approved: true, issues: [] }),
            },
          ],
        },
      ],
    },
  ];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init!.body as string);
    calls.push(body);
    assert.equal(body.store, false);
    assert.ok(body.max_output_tokens <= 14000);
    assert.equal(JSON.stringify(body).includes('test-private-key'), false);
    return Response.json(results[calls.length - 1]);
  };
  const result = await generateBlogDraft('CV', [], {
    apiKey: 'test-private-key',
    model: 'test-model',
    fetcher,
  });
  assert.equal(calls.length, 3);
  assert.equal(result.draft.slug, draft.slug);
  assert.equal(result.evidence.sources.length, 2);
  assert.equal(result.evidence.review.approved, true);
  assert.deepEqual(calls[0].include, ['web_search_call.action.sources']);
  assert.equal(
    JSON.stringify(result.draft).includes('Private verified'),
    false,
  );
});
void test('generator fails closed on provider failure and insufficient research', async () => {
  await assert.rejects(
    generateBlogDraft('CV', [], {
      apiKey: 'x',
      model: 'test',
      fetcher: async () => new Response('secret failure body', { status: 429 }),
    }),
    /429/,
  );
  await assert.rejects(
    generateBlogDraft('CV', [], {
      apiKey: 'x',
      model: 'test',
      fetcher: async () => Response.json({ status: 'incomplete' }),
    }),
    /incomplete/,
  );
  await assert.rejects(
    generateBlogDraft('CV', [], {
      apiKey: 'x',
      model: 'test',
      fetcher: async () =>
        Response.json({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: 'Invented source: https://example.com',
                },
              ],
            },
          ],
        }),
    }),
    /primary source/,
  );
});
