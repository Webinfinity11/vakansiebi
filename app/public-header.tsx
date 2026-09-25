'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { Bookmark, Search, Plus, FilePlus2 } from 'lucide-react';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';
import { enterTab } from '@/lib/vacancy-navigation';

function localAction(
  event: MouseEvent<HTMLAnchorElement>,
  action?: () => void,
) {
  if (
    !action ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
    return;
  event.preventDefault();
  action();
}

/** The same masthead on the catalogue, saved list, vacancy and company pages. */
export function PublicHeader({
  savedCount,
  savedOnly = false,
  showSearch = true,
  onVacancies,
  onSaved,
  onSearch,
}: {
  savedCount?: number;
  savedOnly?: boolean;
  /* The board carries the search field itself, so the masthead does not repeat it. */
  showSearch?: boolean;
  onVacancies?: () => void;
  onSaved?: () => void;
  onSearch?: () => void;
}) {
  /* The header is on every public page, so this is where the tab's first
     history entry is recognised — before any page decides whether its own
     "back" control has a step behind it to take. */
  useEffect(enterTab, []);
  const [storedCount, setStoredCount] = useState(0);
  useEffect(() => {
    if (savedCount !== undefined) return;
    const read = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('ertad-saved') || '[]');
        setStoredCount(
          Array.isArray(saved)
            ? saved.filter((id) => typeof id === 'string').length
            : 0,
        );
      } catch {
        setStoredCount(0);
      }
    };
    const timer = setTimeout(read, 0);
    window.addEventListener('storage', read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', read);
    };
  }, [savedCount]);
  const pathname = usePathname();
  const count = savedCount ?? storedCount;
  /* One current place at a time: the saved list lives on "/" too, so it takes the mark from
     "all vacancies" while it is open. */
  const current = savedOnly
    ? 'saved'
    : pathname === '/'
      ? 'all'
      : pathname === '/map'
        ? 'map'
        : pathname === '/companies'
          ? 'companies'
          : pathname === '/cv'
            ? 'cv'
            : pathname === '/post-job'
              ? 'post'
              : null;
  const here = (place: string) =>
    current === place ? ('page' as const) : undefined;
  return (
    <header className="topbar public-header">
      <div className="header-inner">
        <Brand priority />
        <nav aria-label="მთავარი ნავიგაცია" className="site-nav">
          <Link
            href="/"
            prefetch={false}
            className="ds-btn ds-btn--ghost site-nav-link"
            aria-label="ყველა ვაკანსია"
            aria-current={here('all')}
            onClick={(event) => localAction(event, onVacancies)}
          >
            <span className="header-label-full">ყველა ვაკანსია</span>
            <span className="header-label-short">ყველა</span>
          </Link>
          <Link
            href="/map"
            prefetch={false}
            className="ds-btn ds-btn--ghost site-nav-link header-map-link"
            aria-current={here('map')}
          >
            რუკა
          </Link>
          <Link
            href="/companies"
            prefetch={false}
            className="ds-btn ds-btn--ghost site-nav-link header-companies-link"
            aria-current={here('companies')}
          >
            კომპანიები
          </Link>
        </nav>
        <div className="header-actions">
          {showSearch && (
            <Link
              href="/#search-heading"
              prefetch={false}
              className="ds-btn ds-btn--secondary site-action site-search"
              aria-label="ძიება"
              title="ძიება"
              onClick={(event) => localAction(event, onSearch)}
            >
              <Search aria-hidden="true" />
              <span className="site-action-label">ძებნა</span>
            </Link>
          )}
          <Link
            href="/?saved=1"
            prefetch={false}
            className="ds-btn ds-btn--secondary site-action header-saved"
            aria-label={
              count > 0
                ? `შენახული ვაკანსიები: ${count}`
                : 'შენახული ვაკანსიები'
            }
            title="შენახული ვაკანსიები"
            aria-current={here('saved')}
            onClick={(event) => localAction(event, onSaved)}
          >
            <Bookmark aria-hidden="true" />
            <span className="site-action-label">შენახული</span>
            {/* A zero says nothing; the count appears once there is something to count. */}
            {count > 0 && (
              <span className="site-count" aria-hidden="true">
                {count}
              </span>
            )}
          </Link>
          <Link
            href="/cv"
            prefetch={false}
            className="ds-btn ds-btn--secondary site-action"
            aria-label="რეზიუმეს შექმნა"
            title="რეზიუმეს შექმნა"
            aria-current={here('cv')}
          >
            <FilePlus2 aria-hidden="true" />
            <span className="site-action-label">CV შექმნა</span>
          </Link>
          {/* The one primary action in the masthead. */}
          <Link
            href="/post-job"
            prefetch={false}
            className="ds-btn ds-btn--primary site-post"
            aria-label="განცხადების დამატება"
            title="განცხადების დამატება"
            aria-current={here('post')}
          >
            <Plus aria-hidden="true" />
            <span className="site-action-label">განცხადების დამატება</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
