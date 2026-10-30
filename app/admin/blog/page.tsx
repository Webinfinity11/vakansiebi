import type { Metadata } from 'next';
import { AdminWorkspace } from '../navigation';
import { isAdmin } from '@/lib/server/auth';
import Login from '../login';
import { BlogEditor } from '../blog-editor';
import '../admin.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'ბლოგის მართვა | ჯობიქსი',
  robots: { index: false, follow: false },
};
export default async function AdminBlog() {
  if (!(await isAdmin())) return <Login />;
  return (
    <AdminWorkspace
      active="blog"
      title="ბლოგი"
      description="ახალი სტატიის დამატება, არსებული სტატიების რედაქტირება და გამოქვეყნება."
    >
      <BlogEditor />
    </AdminWorkspace>
  );
}
