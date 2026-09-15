'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { analyticsPage, analyticsReferrer } from '@/lib/google-analytics';

type AnalyticsWindow = Window & {
  dataLayer?: IArguments[];
  gtag?: (...args: unknown[]) => void;
};

const subscribeToHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const previousPage = useRef('');
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    serverSnapshot,
  );
  const enabled =
    hydrated &&
    process.env.NODE_ENV === 'production' &&
    /^G-[A-Z0-9]+$/.test(measurementId) &&
    Boolean(analyticsPage(window.location.href));

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !/^G-[A-Z0-9]+$/.test(measurementId)
    )
      return;
    const page = analyticsPage(window.location.href);
    const analyticsWindow = window as AnalyticsWindow;
    // Also stop an already loaded tag after navigation to an admin or invoice page.
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${measurementId}`
    ] = !page;
    if (!page) {
      previousPage.current = '';
      return;
    }

    analyticsWindow.dataLayer ||= [];
    analyticsWindow.gtag ||= function () {
      // The Google tag's documented queue format uses an Arguments object.
      // eslint-disable-next-line prefer-rest-params
      analyticsWindow.dataLayer!.push(arguments);
    };
    const gtag = analyticsWindow.gtag;
    const pageDetails = {
      page_location: page,
      page_referrer:
        previousPage.current || analyticsReferrer(document.referrer),
      page_title: document.title,
    };
    // Set these globally so engagement events use the same sanitized URL.
    gtag('set', pageDetails);
    if (!initialized.current) {
      gtag('js', new Date());
      gtag('config', measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      initialized.current = true;
    }
    if (previousPage.current !== page) {
      gtag('event', 'page_view', { ...pageDetails, send_to: measurementId });
      previousPage.current = page;
    }
  }, [pathname, searchParams, measurementId]);

  if (!enabled) return null;
  return (
    <Script
      id="jobx-google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  );
}
