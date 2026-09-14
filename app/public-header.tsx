'use client';
import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

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
  onVacancies,
  onSaved,
  onSearch,
}: {
  savedCount?: number;
  savedOnly?: boolean;
  onVacancies?: () => void;
  onSaved?: () => void;
  onSearch?: () => void;
}) {
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
  return (
    <header className="topbar public-header">
      <div className="header-inner">
        <Brand />
        <nav aria-label="მთავარი ნავიგაცია">
          <Link
            href="/"
            prefetch={false}
            className="all-vacancies-link"
            aria-label="ყველა ვაკანსია"
            onClick={(event) => localAction(event, onVacancies)}
          >
            <span className="header-label-full">ყველა ვაკანსია</span>
            <span className="header-label-short">ყველა</span>
          </Link>
        </nav>
        <div className="header-actions">
          <Link
            href="/#search-heading"
            prefetch={false}
            className="header-search"
            aria-label="ძიება"
            onClick={(event) => localAction(event, onSearch)}
          >
            <Search size={18} />
            <span>ძებნა</span>
          </Link>
          <Link
            href="/?saved=1"
            prefetch={false}
            className={`saved-nav${savedOnly ? ' is-active' : ''}`}
            aria-label="შენახული ვაკანსიები"
            aria-current={savedOnly ? 'page' : undefined}
            onClick={(event) => localAction(event, onSaved)}
          >
            <Bookmark size={18} />
            <span>შენახული</span>
            <b>{savedCount ?? storedCount}</b>
          </Link>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
