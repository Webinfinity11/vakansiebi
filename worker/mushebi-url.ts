export const mushebiOrigin = 'https://mushebi.ge';
export const mushebiCareersUrl = mushebiOrigin + '/ka/vacancies';

// One public page contains several roles. A browser text fragment links to the
// actual heading without inventing separate vacancy pages on the employer's site.
export function mushebiVacancyUrl(title: string) {
  return `${mushebiCareersUrl}#:~:text=${encodeURIComponent(title)}`;
}

export function mushebiVacancyId(value: string | URL): string | null {
  try {
    const u = new URL(value);
    if (
      u.origin !== mushebiOrigin ||
      u.pathname !== '/ka/vacancies' ||
      u.username ||
      u.password ||
      u.port ||
      u.search ||
      !u.hash.startsWith('#:~:text=')
    )
      return null;
    const title = decodeURIComponent(u.hash.slice('#:~:text='.length));
    if (!/^[\p{L}\p{N} /(),–-]{2,120}$/u.test(title) || title.trim() !== title)
      return null;
    return title;
  } catch {
    return null;
  }
}
