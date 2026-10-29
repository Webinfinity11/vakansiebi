<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Production deployment budget

Production deploys through `.github/workflows/deploy.yml` when code is pushed
to `main`, only when application code differs from the live revision. There is
no scheduled website deployment. To retry a failed release, dispatch that
workflow on `main`. Do not pair a Git push with `vercel --prod`, or re-enable
Vercel's automatic Git deployments: that creates duplicate builds.
Environment-only changes require an explicit Vercel redeploy. Keep the
project-specific deploy hook in GitHub Secrets.
Scraper/database updates are independent and do not require website builds.

## Typography and natural text flow

User preference: do not squeeze text or force a heading into an artificially
narrow column while useful space remains beside it.

- Let page headings and introductory text use the available content width.
  Do not add arbitrary narrow `max-width` values or manual line breaks just to
  create a stacked heading.
- Do not compress text with negative letter spacing, horizontal scaling or a
  smaller font merely to force it onto one line. Preserve readable typography.
- Let text wrap naturally when the viewport requires it, especially on phones.
  Do not replace natural wrapping with `white-space: nowrap`, clipping or
  ellipsis on page headings.
- A readable line length for long article paragraphs is appropriate; do not
  automatically impose that same narrow width on a page's introductory heading.
- Check changed headings in Georgian and English on desktop and mobile for
  unnecessary wrapping and horizontal overflow.

## Georgian wording and terminology

Natural Georgian is an explicit user priority. Write Georgian interface copy
directly; do not translate English marketing slogans word for word or invent
unnatural phrases to fill a heading or add SEO keywords.

- Name the page, subject or action plainly: for example, `ბლოგი`, `წაკითხვა`,
  `ვაკანსიების ნახვა` and `რეზიუმეს შექმნა`.
- Do not reuse the rejected heading `სამსახურის ძიება, უფრო გარკვევით` or
  similarly vague slogans such as an unspecified "next step".
- Keep terminology consistent between the header, menu, footer and article
  actions. Prefer `რეზიუმე` for the document; use `CV` where the abbreviation
  helps, without changing the document's content or language.
- For unfamiliar wording, check how Georgian employment services use the term.
  Peer usage is evidence, not a reason to copy an awkward phrase or reproduce
  another site's article. Prefer a short established label when in doubt.
- Read new titles, descriptions and calls to action as Georgian sentences:
  check meaning, grammar, register and whether they describe the actual content.

## Blog sources and presentation

The user explicitly does not want source sections, inline citation links or
source-review labels on public blog pages. Do not add competitor mentions or
links to those pages. Keep research evidence and review dates in the editorial
documents under `docs/`; factual claims still require verification. Label
hypothetical examples clearly rather than presenting them as real vacancies.

## Blog cover artwork

Before creating or replacing blog cover images, read `docs/blog-cover-style.md`
and inspect its linked approved covers. Keep the matte blue 3D illustration
series consistent; do not replace topic-specific artwork with repeated outline
icons. Exact generation prompts live in `docs/blog-cover-art-direction.json`.
