'use client';
import { useEffect, useRef } from 'react';
import { trackAction } from '@/lib/analytics-client';
import type { ActionCode } from '@/lib/analytics-actions';

/* Counts that a server-rendered page was shown, once per page load; the ref keeps a re-run
   of the effect from counting twice. It renders nothing. */
export function TrackOnce({ code }: { code: ActionCode }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackAction(code);
  }, [code]);
  return null;
}
