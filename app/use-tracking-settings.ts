'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsPage } from '@/lib/google-analytics';
import { trackingSchema, type TrackingSettings } from '@/lib/tracking';

// All counters share one settings request per document. A reload reads fresh settings.
let pending: Promise<TrackingSettings> | undefined;
export function useTrackingSettings() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<TrackingSettings | null>(null);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !analyticsPage(window.location.href)
    )
      return;
    let active = true;
    pending ||= fetch('/api/tracking', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Tracking unavailable');
        return trackingSchema.parse(await response.json());
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
    void pending
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);
  return settings;
}
