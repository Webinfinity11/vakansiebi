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

/** Known embedded browsers cannot offer the normal browser installation flow. */
export function isInAppBrowser(userAgent: string) {
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|musical_ly|BytedanceWebview|\bLine\/|;\s*wv\b|\bMicroMessenger\b|Snapchat/i.test(
    userAgent,
  );
}

export function canWaitForInstall(userAgent: string, maxTouchPoints = 0) {
  return (
    installPlatform(userAgent, maxTouchPoints) !== 'ios' &&
    !isInAppBrowser(userAgent) &&
    /Chrome\/|Chromium\/|Edg\//i.test(userAgent)
  );
}

/** Preserve path/query, but never allow a page fragment to inject intent fields. */
export function chromeInstallIntent(href: string) {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function canPromptAfterWait(
  activation: { isActive: boolean } | undefined,
) {
  return activation?.isActive === true;
}
