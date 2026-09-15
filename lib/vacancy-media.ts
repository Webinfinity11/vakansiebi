const logoHosts = new Set([
  'www.hr.ge',
  'hr.ge',
  'd1hedpmorgly0j.cloudfront.net',
  'samushao.ge',
  'static.ss.ge',
  'jobs.ge',
  'www.jobs.ge',
  'helio-ai-assets-prod.s3.amazonaws.com',
  'c.smartrecruiters.com',
]);

export function isLocalLogoUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === 75 &&
    /^\/api\/logos\/[a-f0-9]{64}$/.test(value)
  );
}

export function safeLogoUrl(value: unknown, base?: string): string {
  if (isLocalLogoUrl(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, base);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !(
        logoHosts.has(url.hostname) ||
        /^[a-z0-9-]+\.selfrecruit\.ge$/.test(url.hostname)
      )
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
