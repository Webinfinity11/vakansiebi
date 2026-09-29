'use client';
import Script from 'next/script';
import { useTrackingSettings } from './use-tracking-settings';

/* A small badge beside the copyright line; the script fills the container with top.ge's image. */
export function TopGeCounter() {
  const settings = useTrackingSettings();
  if (!settings?.topGeEnabled) return null;
  const siteId = settings.topGeId;
  return (
    <span className="top-ge-counter">
      <span id="top-ge-counter-container" data-site-id={siteId} />
      <Script
        src="https://counter.top.ge/counter.js"
        strategy="afterInteractive"
      />
    </span>
  );
}
