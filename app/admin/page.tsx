import { isAdmin } from '@/lib/server/auth';
import AdminPanel from './panel';
import Login from './login';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  return (await isAdmin()) ? <AdminPanel /> : <Login />;
}
