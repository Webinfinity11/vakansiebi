'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { analyticsPage, analyticsReferrer } from '@/lib/google-analytics';

type Metrika = {
  (...args: unknown[]): void;
  a?: IArguments[];
  l?: number;
};
type MetrikaWindow = Window & { ym?: Metrika };

/* Yandex Metrika, held to the same rule as the Google tag: it only ever sees
   the canonical production site and only its public pages, addressed without
   their query string, so search text, saved-vacancy lists and invoice tokens
   never leave the browser. An admin or invoice page loads no counter at all. */
export function YandexMetrika({ counterId }: { counterId: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const previousPage = useRef('');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !Number.isInteger(counterId))
      return;
    const page = analyticsPage(window.location.href);
    if (!page) {
      previousPage.current = '';
      return;
    }
    const metrikaWindow = window as MetrikaWindow;
    if (!started.current) {
      /* The counter's own queue, so the calls below are kept until the tag
         arrives; the tag replays them in order. */
      const queued: Metrika = function () {
        // eslint-disable-next-line prefer-rest-params
        (queued.a ||= []).push(arguments);
      };
      metrikaWindow.ym ||= queued;
      metrikaWindow.ym.l ||= Date.now();
      metrikaWindow.ym(counterId, 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        trackLinks: true,
        accurateTrackBounce: true,
        referrer: analyticsReferrer(document.referrer),
        url: page,
      });
      const tag = document.createElement('script');
      tag.async = true;
      tag.src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
      document.head.append(tag);
      started.current = true;
    } else if (previousPage.current !== page) {
      // Moving between vacancies never reloads the page, so each one is its own hit.
      metrikaWindow.ym?.(counterId, 'hit', page, {
        referer: previousPage.current,
        title: document.title,
      });
    }
    previousPage.current = page;
  }, [pathname, searchParams, counterId]);

  return null;
}
