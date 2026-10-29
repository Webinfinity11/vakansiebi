export const libertyOrigin = 'https://www.libertybank.ge';
export const libertyCareersPath = '/ka/kariera/mimdinare-vakansiebi';

/** Only public Georgian vacancy pages on the bank's own two hostnames. */
export function libertyVacancyId(value: string | URL): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !['libertybank.ge', 'www.libertybank.ge'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;
    return (
      url.pathname.match(
        /^\/ka\/kariera\/mimdinare-vakansiebi\/([1-9]\d{0,8})(?:\/[^/]+)?\/?$/,
      )?.[1] || null
    );
  } catch {
    return null;
  }
}
