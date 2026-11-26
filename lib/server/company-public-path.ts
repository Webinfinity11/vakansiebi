import { companyKey } from '../company-key';
import type { EmployerPage } from './employers';

/** Match the same profile keys used by the public page, including merged names.
 * The directory owns canonical slugs; never derive a URL from the account name.
 */
export async function companyPublicPath(
  key: string,
  pages: Iterable<EmployerPage> | null,
  suppressed: (page: EmployerPage) => Promise<boolean>,
): Promise<string | null | undefined> {
  // A cold directory is unknown, not evidence that the company has no page.
  if (pages === null) return undefined;
  if (!key) return null;
  const matches = [...pages].filter((page) => page.names.some((name) => companyKey(name) === key));
  // Ambiguous identities must not send an account to another employer's page.
  if (matches.length !== 1 || await suppressed(matches[0])) return null;
  return `/companies/${encodeURIComponent(matches[0].slug)}`;
}
