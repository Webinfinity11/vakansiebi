import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repository = 'Webinfinity11/vakansiebi';
const healthUrl = 'https://jobx.ge/api/health';
const shaPattern = /^[a-f0-9]{40}$/;

// Only explicitly non-runtime paths are ignored. Unknown paths require a build.
export function needsBuild(current, target, comparison) {
  if (current === target) return false;
  if (!shaPattern.test(current ?? '')) return true;
  if (!comparison || comparison.status !== 'ahead') return true;
  // GitHub's compare endpoint truncates the changed-file list at 300 files.
  if (!comparison.files?.length || comparison.files.length >= 300) return true;
  const ignored = /^(?:docs\/|tests\/|\.github\/|\.devapp\/|(?:README|AGENTS|CLAUDE)\.md$)/;
  return comparison.files.some((file) =>
    !ignored.test(file.filename) || (file.previous_filename && !ignored.test(file.previous_filename)),
  );
}

export async function run({ fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const report = (message) => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  };
  const github = async (path) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub read failed (${response.status}). No additional deployment requested.`);
    return response.json();
  };
  const health = async () => {
    const response = await fetchImpl(healthUrl, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Production health check failed (${response.status}).`);
    const result = await response.json();
    if (result.status !== 'ok') throw new Error('Production is unhealthy. Investigate before rebuilding.');
    return result.revision;
  };

  // Read live main, not the possibly stale SHA attached to a queued workflow run.
  const target = (await github('git/ref/heads/main')).object.sha;
  if (!shaPattern.test(target)) throw new Error('Invalid main revision.');
  const current = await health();
  const comparison = current !== target && shaPattern.test(current ?? '')
    ? await github(`compare/${current}...${target}`) : undefined;
  if (!needsBuild(current, target, comparison)) {
    report(`Skipped: production ${current} already contains the current application code. No Vercel build requested.`);
    return;
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook?.startsWith('https://api.vercel.com/v1/integrations/deploy/')) throw new Error('Missing or invalid VERCEL_DEPLOY_HOOK.');
  // Do not automatically retry a POST: an ambiguous network failure may already have queued a build.
  let response;
  try {
    response = await fetchImpl(hook, { method: 'POST', signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error('Deploy request could not be confirmed. Check Vercel before retrying.');
  }
  if (!response.ok) throw new Error(`Deploy hook rejected the request (${response.status}).`);
  report(`Requested one production build for main (${target}). Waiting for the healthy live revision.`);
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(15_000);
    let deployed;
    try { deployed = await health(); } catch { continue; }
    if (deployed === current || !shaPattern.test(deployed ?? '')) continue;
    // A push can race the hook, which resolves main when Vercel receives it.
    if (deployed === target || (await github(`compare/${target}...${deployed}`)).status === 'ahead') {
      report(`Verified: https://jobx.ge is healthy and serves revision ${deployed}.`);
      return;
    }
  }
  throw new Error('Production did not reach the requested revision within 10 minutes. Check Vercel deployment logs; no second build was requested.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
