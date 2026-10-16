import { landingFor } from './seo-landing';

/** GA only measures public pages on the canonical production site. */
export function analyticsPage(url: string, { includeCv = false } = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://jobx.ge') return null;
    const path = parsed.pathname;
    if (
      path !== '/' &&
      path !== '/post-job' &&
      path !== '/companies' &&
      path !== '/business' &&
      path !== '/map' &&
      !(includeCv && path === '/cv') &&
      !/^\/vacancies\/[^/]+$/.test(path) &&
      !/^\/companies\/[^/]+$/.test(path)
    )
      return null;
    if (parsed.searchParams.has('preview')) return null;
    // Reviewed SEO landings must retain their identity so GA can join them to
    // Search Console. Arbitrary searches, contact details and tokens stay out.
    if (path === '/') {
      const params = new URLSearchParams();
      for (const key of [
        'category',
        'subcategory',
        'city',
        'q',
        'remote',
        'paid',
        'entryLevel',
        'employment',
        'salaryPeriod',
      ]) {
        const values = parsed.searchParams.getAll(key);
        if (values.length > 1) return parsed.origin + path;
        if (values.length) params.set(key, values[0]);
      }
      return parsed.origin + (landingFor(params)?.path ?? path);
    }
    return parsed.origin + path;
  } catch {
    return null;
  }
}

/** Explicit outcomes, without search text, CV fields, contact details or job IDs. */
export function analyticsEvent(
  kind: string,
  value: string,
): { name: string; params?: Record<string, string> } | null {
  if (['call', 'cv', 'apply'].includes(kind))
    return {
      name: 'contact_employer',
      params: { contact_method: kind === 'cv' ? 'email' : kind },
    };
  if (kind === 'post' && value === 'submitted')
    return { name: 'job_submitted' };
  if (kind === 'resume' && value === 'printed') return { name: 'cv_print' };
  if (kind === 'save') return { name: 'save_job' };
  return null;
}

export function analyticsReferrer(referrer: string) {
  try {
    const parsed = new URL(referrer);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return analyticsPage(referrer) || parsed.origin + '/';
  } catch {
    return '';
  }
}
