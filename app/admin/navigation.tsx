'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  Ban,
  Building2,
  ChartColumn,
  ChevronDown,
  ExternalLink,
  FileText,
  Flag,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ReceiptText,
  ScrollText,
  Search,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from '../brand';
import { adminHref, adminSections } from '@/lib/admin-navigation';
import './workspace.css';
const icons: Record<string, LucideIcon> = {
  control: LayoutDashboard,
  analytics: ChartColumn,
  submissions: Inbox,
  vacancies: ListChecks,
  reports: Flag,
  employers: Building2,
  resumes: FileText,
  blog: FileText,
  customers: Users,
  'company-accounts': Users,
  billing: ReceiptText,
  removals: Ban,
  sources: Activity,
  runs: History,
  tracking: SlidersHorizontal,
  history: ScrollText,
};
export function AdminNavigation({
  active,
  counts = {},
  onNavigate,
}: {
  active: string;
  counts?: Record<string, number>;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = ['performance', 'posting'].includes(active)
    ? 'analytics'
    : active;
  const current = adminSections.find((item) => item.id === selected);
  const items = adminSections.filter((item) =>
    `${item.label} ${item.description}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return (
    <>
      <div className="admin-mobilebar">
        <Brand />
        <button
          type="button"
          className="admin-menu-button ds-btn ds-btn--secondary"
          aria-expanded={open}
          aria-controls="admin-nav"
          onClick={() => setOpen(!open)}
        >
          {current?.label || 'მენიუ'}
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <button
          type="button"
          className="admin-scrim"
          aria-label="მენიუს დახურვა"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className="admin-side" id="admin-nav" data-open={open}>
        <div className="admin-side-brand">
          <Brand />
          <span>ადმინი</span>
        </div>
        <label className="admin-menu-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="განყოფილების მოძებნა"
            placeholder="განყოფილების მოძებნა"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <nav aria-label="ადმინის განყოფილებები">
          {[...new Set(items.map((item) => item.group))].map((group) => (
            <div className="admin-nav-group" key={group}>
              <h2>{group}</h2>
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = icons[item.id];
                  const count = counts[item.id];
                  return (
                    <Link
                      prefetch={false}
                      key={item.id}
                      href={'href' in item ? item.href : adminHref(item.id)}
                      aria-current={selected === item.id ? 'page' : undefined}
                      title={item.description}
                      onClick={() => {
                        setOpen(false);
                        onNavigate?.();
                      }}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                      {!!count && <b>{count}</b>}
                    </Link>
                  );
                })}
            </div>
          ))}
          {!items.length && (
            <p className="admin-menu-empty">განყოფილება ვერ მოიძებნა</p>
          )}
        </nav>
        <div className="admin-side-foot">
          <Link href="/?preview=1" target="_blank">
            <ExternalLink size={16} />
            საიტის ნახვა
          </Link>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/admin/session', { method: 'DELETE' });
              window.location.assign('/admin');
            }}
          >
            <LogOut size={16} />
            გასვლა
          </button>
        </div>
      </aside>
    </>
  );
}
export function AdminWorkspace({
  active,
  title,
  description,
  children,
}: {
  active: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-page admin-shell">
      <AdminNavigation active={active} />
      <main className="admin-main">
        <section className="admin-panel">
          <header className="admin-page-head">
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </section>
      </main>
    </div>
  );
}
