import type { Metadata, Viewport } from 'next';
import './globals.css';
import './board.css';
import './phone.css';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
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
    <html lang="ka">
      <body>{children}</body>
    </html>
  );
}
