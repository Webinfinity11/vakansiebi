import { landingFor, landingHeading } from './seo-landing';
import { homeTitle } from './seo';

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

/** A typed search can appear in document.title even when its URL was sanitized. */
export function analyticsTitle(page: string, documentTitle: string) {
  const url = new URL(page);
  if (url.pathname !== '/') return documentTitle;
  const landing = landingFor(url.searchParams);
  return landing ? `${landingHeading(landing)} | JOBX` : homeTitle;
}

/** Contact clicks are intent, not confirmed calls or delivered applications. */
export function analyticsEvent(
  kind: string,
  value: string,
): { name: string; params?: Record<string, string> } | null {
  const contactEvents: Record<string, [string, string]> = {
    call: ['call_click', 'phone'],
    cv: ['cv_email_click', 'cv_email'],
    email: ['contact_email_click', 'email'],
    apply: ['application_click', 'external_form'],
  };
  if (Object.hasOwn(contactEvents, kind)) {
    const [name, method] = contactEvents[kind];
    return { name, params: { contact_method: method } };
  }
  if (kind === 'post' && value === 'done') return { name: 'job_submitted' };
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
