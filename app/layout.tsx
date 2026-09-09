import type { Metadata } from 'next';
import './globals.css';
import './board.css';
export const metadata: Metadata = {
  title: 'ერთად — ვაკანსიები ერთ სივრცეში',
  description:
    'მოძებნე ვაკანსიები სხვადასხვა წყაროდან. შეადარე პირობები და გადადი პირველწყაროზე.',
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
