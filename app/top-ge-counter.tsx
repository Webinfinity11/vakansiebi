'use client';
import Script from 'next/script';
import { useTrackingSettings } from './use-tracking-settings';

// The official script runs once per document and keeps this image for SPA hits.
// Reattach that same badge when a page's footer remounts; do not run it twice.
let badge: { siteId: string; element: Element } | undefined;
function restoreBadge(siteId: string) {
  const container = document.getElementById('top-ge-counter-container');
  if (!container || container.dataset.siteId !== siteId) return;
  if (container.firstElementChild) {
    badge = { siteId, element: container.firstElementChild };
  } else if (badge?.siteId === siteId) {
    container.appendChild(badge.element);
  }
}

/* A small badge beside the copyright line; the script fills the container with top.ge's image. */
export function TopGeCounter() {
  const settings = useTrackingSettings();
  if (!settings?.topGeEnabled) return null;
  const siteId = settings.topGeId;
  return (
    <div className="top-ge-counter">
      <div id="top-ge-counter-container" data-site-id={siteId} />
      <Script
        src="//counter.top.ge/counter.js"
        async
        strategy="afterInteractive"
        onReady={() => restoreBadge(siteId)}
      />
    </div>
  );
}
