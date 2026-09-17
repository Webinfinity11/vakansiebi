<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Production deployment budget

Production deploys through `.github/workflows/deploy.yml` at 09:00, 15:00 and
21:00 Asia/Tbilisi, only when application code differs from the live revision.
For an urgent code release, dispatch that workflow on `main`. Do not pair a Git
push with `vercel --prod`, or re-enable automatic Git deployments: that bypasses
the schedule and creates duplicate builds. Environment-only changes require an
explicit Vercel redeploy. Keep the project-specific deploy hook in GitHub Secrets.
Scraper/database updates are independent and do not require website builds.
