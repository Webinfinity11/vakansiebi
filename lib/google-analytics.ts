/** GA only measures public pages on the canonical production site. */
export function analyticsPage(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://jobx.ge') return null;
    const path = parsed.pathname;
    if (
      path !== '/' &&
      path !== '/post-job' &&
      !/^\/vacancies\/[\da-f-]{36}$/.test(path) &&
      !/^\/companies\/[^/]+$/.test(path)
    )
      return null;
    if (parsed.searchParams.has('preview')) return null;
    // Search text, contact details and URL tokens never enter page_location.
    return parsed.origin + path;
  } catch {
    return null;
  }
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
