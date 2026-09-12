import type { Metadata, Viewport } from 'next';
import './globals.css';
import './board.css';
import './phone.css';
/* Last, so its `:root[data-theme='dark']` rules restate the light ones above. */
import './theme-dark.css';
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
  title: 'ერთად — ვაკანსიები ერთ სივრცეში',
  description:
    'მოძებნე ვაკანსიები სხვადასხვა წყაროდან. შეადარე პირობები და გადადი პირველწყაროზე.',
  applicationName: 'ერთად',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ერთად', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ka" suppressHydrationWarning>
      <head>
        {/* Before the first paint: a themed page never flashes the other theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
