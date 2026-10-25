import type { ReactNode } from 'react';
import { PublicHeader } from '../public-header';
import { SiteFooter } from '../site-footer';
import './blog.css';

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="board-shell blog-shell">
      <PublicHeader />
      {children}
      <SiteFooter showDirectory={false} />
    </div>
  );
}
