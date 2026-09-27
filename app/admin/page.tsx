import './admin.css';
import { isAdmin } from '@/lib/server/auth';
import AdminPanel from './panel';
import Login from './login';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
// robots.txt already keeps crawlers out; the tag also covers a link that leaks elsewhere.
export const metadata: Metadata = {
  title: 'ადმინი — JOBX',
  robots: { index: false, follow: false },
};
export default async function Admin() {
  return (await isAdmin()) ? <AdminPanel /> : <Login />;
}
