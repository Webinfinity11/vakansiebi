const repository = 'Webinfinity11/vakansiebi';
export const scraperWorkflowUrl = `https://github.com/${repository}/actions/workflows/scrape.yml`;
const api = `https://api.github.com/repos/${repository}/actions/workflows/scrape.yml`;
export function githubDispatchConfigured() {
  return Boolean(process.env.GITHUB_ACTIONS_TOKEN?.trim());
}
function headers() {
  const token = process.env.GITHUB_ACTIONS_TOKEN?.trim();
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
export async function dispatchScraper() {
  if (!githubDispatchConfigured())
    return { dispatched: false, reason: 'not_configured' } as const;
  try {
    const result = await fetch(`${api}/dispatches`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!result.ok)
      return { dispatched: false, reason: 'github_rejected' } as const;
    return { dispatched: true } as const;
  } catch {
    return { dispatched: false, reason: 'github_unavailable' } as const;
  }
}
export async function githubScraperStatus() {
  try {
    const result = await fetch(`${api}/runs?per_page=1&branch=main`, {
      headers: headers(),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
      next: { revalidate: 30 },
    });
    if (!result.ok) throw Error('GitHub unavailable');
    const data = await result.json();
    const run = data.workflow_runs?.[0];
    return {
      available: true,
      dispatchConfigured: githubDispatchConfigured(),
      url: scraperWorkflowUrl,
      latest: run
        ? {
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            event: run.event,
            startedAt: run.run_started_at || run.created_at,
            url: `${scraperWorkflowUrl.replace('/workflows/scrape.yml', '')}/runs/${Number(run.id)}`,
          }
        : null,
    };
  } catch {
    return {
      available: false,
      dispatchConfigured: githubDispatchConfigured(),
      url: scraperWorkflowUrl,
      latest: null,
    };
  }
}
