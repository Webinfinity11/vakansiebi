/* Sends one anonymous event. Nothing identifying goes with it: no id, no cookie is set, and the
   body is only the kind and the value. sendBeacon survives the page being left, which is exactly
   when an outbound click happens; fetch with keepalive is the fallback where it is missing.

   Only production builds send, so a developer's local server — which may point at the real
   database — cannot pollute the counts. Failures are ignored: analytics must never break or
   slow down the page it measures. */
export type TrackedKind = 'search' | 'search_empty' | 'view' | 'outbound';

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
      }).catch(() => {});
  } catch {}
}
