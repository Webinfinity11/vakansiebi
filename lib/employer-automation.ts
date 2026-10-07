export type EmployerEvidence = { logos: Set<string>; domains: Set<string> };
const nonEmployerDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'mail.ru',
  'yandex.ru',
  'icloud.com',
  'jobs.ge',
  'hr.ge',
  'ss.ge',
  'awork.ge',
  'myjobs.ge',
  'jobx.ge',
]);
/** An application portal or free mailbox is not evidence of a common employer. */
export function employerDomain(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (
      nonEmployerDomains.has(host) ||
      [...nonEmployerDomains].some((d) => host.endsWith('.' + d))
    )
      return null;
    return host;
  } catch {
    return null;
  }
}
/** Similar spelling alone stays separate; two independent matching facts can join it. */
export function automaticEmployerDecision(
  a: EmployerEvidence,
  b: EmployerEvidence,
) {
  const domains = [...a.domains].filter((d) => b.domains.has(d));
  const logos = [...a.logos].filter((l) => b.logos.has(l));
  return {
    decision:
      domains.length && logos.length
        ? ('merge' as const)
        : ('separate' as const),
    reason:
      domains.length && logos.length
        ? 'shared_logo_and_employer_domain'
        : 'no_confirmed_common_identity',
    domains,
    logos,
  };
}
