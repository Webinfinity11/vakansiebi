export const installDismissKey = 'jobx-install-dismissed-at';
export const installSeenKey = 'jobx-install-seen';
export const installAcceptedKey = 'jobx-install-accepted';
export const installQuietDays = 7;
export const installDelayMs = 30_000;
export type InstallPlatform = 'ios' | 'android' | 'desktop';

export function installPlatform(
  userAgent: string,
  maxTouchPoints = 0,
): InstallPlatform {
  if (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  )
    return 'ios';
  return /Android/i.test(userAgent) ? 'android' : 'desktop';
}

export function installDismissed(at: string | null, now = Date.now()) {
  const time = Number(at);
  return (
    !!at &&
    Number.isFinite(time) &&
    time > 0 &&
    now - time < installQuietDays * 86_400_000
  );
}

/** Offer installation away from forms, administration and payment pages. */
export function installPage(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/companies' ||
    pathname === '/map' ||
    /^\/vacancies\/[^/]+$/.test(pathname)
  );
}
