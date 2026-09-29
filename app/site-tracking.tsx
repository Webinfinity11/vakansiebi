'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { GoogleAnalytics } from './google-analytics';
import { YandexMetrika } from './yandex-metrika';
import { analyticsPage } from '@/lib/google-analytics';
import { mountCustomCode } from '@/lib/custom-code';
import { useTrackingSettings } from './use-tracking-settings';

export function SiteTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settings = useTrackingSettings();
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !settings?.customEnabled ||
      !analyticsPage(window.location.href)
    )
      return;
    void mountCustomCode(settings.customHtml, () =>
      Boolean(analyticsPage(window.location.href)),
    );
  }, [settings, pathname, searchParams]);
  if (!settings) return null;
  return (
    <>
      {settings.googleEnabled && (
        <GoogleAnalytics measurementId={settings.googleId} />
      )}
      {settings.yandexEnabled && (
        <YandexMetrika counterId={Number(settings.yandexId)} />
      )}
    </>
  );
}
