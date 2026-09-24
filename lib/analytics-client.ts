import type { ActionCode } from './analytics-actions';

/* Sends an event without adding a tracking id or setting a cookie; the body is only the kind
   and the value. sendBeacon survives the page being left, which is exactly
   when an outbound click happens; fetch with keepalive is the fallback where it is missing.
   The fallback omits credentials. sendBeacon has no credentials option, so it may include
   existing same-origin cookies.

   Only production builds send, so a developer's local server — which may point at the real
   database — cannot pollute the counts. Failures are ignored: analytics must never break or
   slow down the page it measures. */
export type TrackedKind =
  | 'search'
  | 'search_empty'
  | 'view'
  | 'outbound'
  | 'filter'
  | 'save'
  | 'saved_search'
  | 'application'
  | 'call'
  | 'cv'
  | 'apply'
  | 'post'
  | 'resume'
  | 'action';

export function track(kind: TrackedKind, value: string) {
  if (process.env.NODE_ENV !== 'production') return;
  try {
    const body = JSON.stringify({ kind, value });
    const sent =
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(
        '/api/events',
        new Blob([body], { type: 'application/json' }),
      );
    if (!sent)
      void fetch('/api/events', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
  } catch {}
}

/* A control or an error on a public page, by its code name alone. */
export const trackAction = (code: ActionCode) => track('action', code);
