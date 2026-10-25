export const installDismissKey = 'jobx-install-dismissed-at';
export const installSeenKey = 'jobx-install-seen';
export const installAcceptedKey = 'jobx-install-accepted';
export const installQuietDays = 7;
export const installDelayMs = 30_000;

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
