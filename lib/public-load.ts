import type { PublicJob } from './types';
import type { SearchMeta } from './server/search-plan';
import type { SimilarVacancy } from './similar-vacancies';

/** Only bounded categories are tracked; never URLs, search text or response bodies. */
export type LoadFailure =
  | 'network'
  | 'timeout'
  | 'server'
  | 'response'
  | 'missing'
  | 'limited'
  | 'request';
export type LoadArea = 'results' | 'more' | 'similar';
export type LoadFailureAction = `${LoadArea}_${LoadFailure}`;

const messages: Record<LoadFailure, string> = {
  network: 'კავშირი შეწყდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.',
  timeout: 'ჩატვირთვა დაგვიანდა. სცადე ხელახლა.',
  server: 'ვაკანსიები დროებით ვერ ჩაიტვირთა. სცადე ხელახლა.',
  response: 'ვაკანსიები ვერ ჩაიტვირთა. სცადე ხელახლა.',
  missing: 'ეს გვერდი აღარ არის ხელმისაწვდომი. განაახლე ძებნა.',
  limited: 'მოთხოვნები ძალიან გახშირდა. ცოტა ხანში სცადე ხელახლა.',
  request: 'შეცვალე ძებნის პარამეტრები და სცადე ხელახლა.',
};

export class PublicLoadError extends Error {
  constructor(public readonly reason: LoadFailure) {
    super(messages[reason]);
    this.name = 'PublicLoadError';
  }
}
export function loadFailureAction(
  area: LoadArea,
  error: unknown,
): LoadFailureAction {
  return `${area}_${error instanceof PublicLoadError ? error.reason : 'response'}`;
}
export function loadFailureMessage(error: unknown) {
  return error instanceof PublicLoadError ? error.message : messages.response;
}

export type JobsPage = {
  jobs: PublicJob[];
  total: number;
  pages: number;
  search: SearchMeta;
  companyLinksPending?: boolean;
  unavailable?: {
    id: string;
    title: string;
    company: string;
    expired: boolean;
  }[];
};
const object = (body: unknown): body is Record<string, unknown> =>
  typeof body === 'object' && body !== null;
const job = (body: unknown) =>
  object(body) && typeof body.id === 'string' && typeof body.title === 'string';
export const isJobsPage = (body: unknown): body is JobsPage =>
  object(body) &&
  Array.isArray(body.jobs) &&
  body.jobs.every(job) &&
  Number.isInteger(body.total) &&
  Number(body.total) >= 0 &&
  Number.isInteger(body.pages) &&
  Number(body.pages) >= 0 &&
  object(body.search);
export const isSimilarJobs = (
  body: unknown,
): body is { jobs: SimilarVacancy[] } =>
  object(body) &&
  Array.isArray(body.jobs) &&
  body.jobs.every(
    (row) =>
      object(row) &&
      job(row.job) &&
      Array.isArray(row.reasons) &&
      row.reasons.every((reason) => typeof reason === 'string'),
  );

/** One attempt, including the response body, with a deadline and caller cancellation.
 * Retrying is a deliberate user action; background retries would amplify a busy database. */
export async function fetchPublicJson<T>(
  url: string,
  {
    signal,
    valid,
    timeoutMs = 45_000,
  }: {
    signal: AbortSignal;
    valid: (body: unknown) => body is T;
    timeoutMs?: number;
  },
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let expired = false;
  if (signal.aborted) cancel();
  else signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);
  const checkCancelled = () => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (expired) throw new PublicLoadError('timeout');
  };
  try {
    checkCancelled();
    const response = await fetch(url, { signal: controller.signal });
    checkCancelled();
    if (!response.ok) {
      const reason =
        response.status === 429
          ? 'limited'
          : response.status === 404
            ? 'missing'
            : [408, 504].includes(response.status) ||
                response.headers.get('X-Jobx-Error') === 'timeout'
              ? 'timeout'
              : response.status >= 500
                ? 'server'
                : 'request';
      throw new PublicLoadError(reason);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      checkCancelled();
      if (error instanceof SyntaxError) throw new PublicLoadError('response');
      throw error;
    }
    checkCancelled();
    if (!valid(body)) throw new PublicLoadError('response');
    return body;
  } catch (error) {
    checkCancelled();
    if (error instanceof PublicLoadError) throw error;
    throw new PublicLoadError('network');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
