import type { ActionCode } from './analytics-actions';
import { sendResumeContact } from './resume-client';
import { analyticsEvent, analyticsPage } from './google-analytics';

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
  | 'email'
  | 'apply'
  | 'post'
  | 'resume'
  | 'action';

/* A vacancy read, a save, and each way of reaching its employer, counts once per visit (one tab
   session): a reload, a return from the mail app or a second tap is the same person doing
   the same thing. Where session storage is unavailable every press still counts. */
const oncePerVisit = new Set<TrackedKind>([
  'view',
  'save',
  'outbound',
  'call',
  'cv',
  'email',
  'apply',
]);
function seenThisVisit(kind: TrackedKind, value: string) {
  if (!oncePerVisit.has(kind)) return false;
  try {
    const key = `jobx-counted:${kind}:${value}`;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
  } catch {}
  return false;
}

function record(kind: TrackedKind, value: string) {
  if (process.env.NODE_ENV !== 'production') return false;
  if (seenThisVisit(kind, value)) return false;
  const googleEvent = analyticsEvent(kind, value);
  if (
    googleEvent &&
    typeof window !== 'undefined' &&
    analyticsPage(window.location.href, { includeCv: true })
  )
    window.dispatchEvent(
      new CustomEvent('jobx:analytics', { detail: googleEvent }),
    );
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
  return true;
}

export function track(kind: TrackedKind, value: string) {
  record(kind, value);
}

/* A control or an error on a public page, by its code name alone. */
export const trackAction = (code: ActionCode) => track('action', code);

/* A press that reaches the employer. It is counted like any other; on a vacancy posted
   through JOBX it also names the CV this browser saved on JOBX, if there is one. */
export function trackContact(
  kind: 'call' | 'cv' | 'email' | 'apply',
  job: { id: string; source: string },
) {
  if (!record(kind, job.id)) return;
  if (
    kind !== 'email' &&
    job.source === 'JOBX' &&
    typeof window !== 'undefined'
  )
    try {
      sendResumeContact(window.localStorage, job.id, kind);
    } catch {}
}
