import { ApiError } from './auth';

/** Aggregate runtime evidence without logging search terms, contact details or SQL. */
export function logPublicLoadFailure(
  scope: 'jobs' | 'similar',
  error: unknown,
  started: number,
) {
  const status = error instanceof ApiError ? error.status : 500;
  if (status < 500) return;
  const rawCode =
    error && typeof error === 'object' && 'code' in error ? error.code : null;
  const code =
    typeof rawCode === 'string' && /^(timeout|[A-Z0-9]{5})$/.test(rawCode)
      ? rawCode
      : 'unknown';
  console.error(
    JSON.stringify({
      event: 'public_load_failed',
      scope,
      status,
      code,
      durationMs: Math.round(performance.now() - started),
    }),
  );
}
