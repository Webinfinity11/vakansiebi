import type { Metadata } from 'next';
import { isAdmin } from '@/lib/server/auth';
import Login from '../login';
import { AdminWorkspace } from '../navigation';
import { CompanyAccounts } from './accounts';
import '../admin.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'კომპანიის ანგარიშები | ჯობიქსი',
  robots: { index: false, follow: false },
};
export default async function AccountsPage() {
  if (!(await isAdmin())) return <Login />;
  return (
    <AdminWorkspace
      active="company-accounts"
      title="კომპანიის ანგარიშები"
      description="შესვლის მონაცემები, ვაკანსიებზე წვდომა და ანგარიშის სტატუსი."
    >
      {process.env.COMPANY_PORTAL_ENABLED === 'true' ? (
        <CompanyAccounts />
      ) : (
        <p className="notice">
          კომპანიის სივრცე ჯერ არ არის გააქტიურებული. ანგარიშების შექმნა
          ხელმისაწვდომი გახდება კონფიგურაციის დასრულების შემდეგ.
        </p>
      )}
    </AdminWorkspace>
  );
}
