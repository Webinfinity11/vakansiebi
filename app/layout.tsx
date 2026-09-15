import { siteUrl } from '@/lib/seo';
import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { GoogleAnalytics } from './google-analytics';
import './globals.css';
import './board.css';
import './phone.css';
/* Here and not only in the board: the theme switch it styles is in every page's masthead. */
import './board-features.css';
import './refined-board.css';
import './public-header.css';
import './post-job.css';
import './theme-dark.css';
import './featured-vacancies.css';
import { themeScript } from '@/lib/theme';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1523' },
  ],
};
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  verification: {
    google: 'HEArO7D4Prjvkmq7ovhmlyOGpzZD9_SOZ_TETGDI6Fw',
  },
  openGraph: {
    siteName: 'JOBX',
    locale: 'ka_GE',
    type: 'website',
    images: [{ url: '/brand/jobx.png', alt: 'JOBX' }],
  },
  twitter: { card: 'summary', images: ['/brand/jobx.png'] },
  title: 'JOBX — ვაკანსიები ერთ სივრცეში',
  description:
    'მოძებნე ვაკანსიები სხვადასხვა წყაროდან. შეადარე პირობები და გადადი პირველწყაროზე.',
  applicationName: 'JOBX',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'JOBX', statusBarStyle: 'default' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ka" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/FiraGO-Regular-subset.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/FiraGO-SemiBold-subset.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Before the first paint: a themed page never flashes the other theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId="G-9S8J0W7QXM" />
        </Suspense>
      </body>
    </html>
  );
}
