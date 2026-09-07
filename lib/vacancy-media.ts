const logoHosts = new Set([
  'www.hr.ge',
  'hr.ge',
  'd1hedpmorgly0j.cloudfront.net',
  'samushao.ge',
  'static.ss.ge',
  'jobs.ge',
  'www.jobs.ge',
]);

export function safeLogoUrl(value: unknown, base?: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, base);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !logoHosts.has(url.hostname)
    )
      return '';
    if (/background\.|placeholder|default[-_]?logo/i.test(url.pathname))
      return '';
    return url.href;
  } catch {
    return '';
  }
}

export function safeExternalUrl(value: string, base?: string): string {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}
