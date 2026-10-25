'use client';
import { useUi } from '@/app/ui-language';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import {
  Bookmark,
  Search,
  Building2,
  FilePlus2,
  Menu,
  X,
  Map,
  BriefcaseBusiness,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from './ui-language';
import { enterTab } from '@/lib/vacancy-navigation';
import {
  readSavedVacancies,
  subscribeSavedVacancies,
} from '@/lib/saved-vacancies';

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
  const { ui } = useUi();
  const [menuOpen, setMenuOpen] = useState(false);
  /* The header is on every public page, so this is where the tab's first
     history entry is recognised — before any page decides whether its own
     "back" control has a step behind it to take. */
  useEffect(enterTab, []);
  const [storedCount, setStoredCount] = useState(0);
  useEffect(() => {
    if (savedCount !== undefined) return;
    const read = () => {
      try {
        setStoredCount(readSavedVacancies(localStorage).length);
      } catch {
        setStoredCount(0);
      }
    };
    const timer = setTimeout(read, 0);
    const unsubscribe = subscribeSavedVacancies(read);
    return () => {
      clearTimeout(timer);
      unsubscribe();
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
          : pathname === '/blog' || pathname.startsWith('/blog/')
            ? 'blog'
            : pathname === '/business'
              ? 'business'
              : pathname === '/cv'
                ? 'cv'
                : null;
  const here = (place: string) =>
    current === place ? ('page' as const) : undefined;
  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <header className="topbar public-header">
        <div className="header-inner">
          <Brand priority />
          <nav aria-label={ui('მთავარი ნავიგაცია')} className="site-nav">
            <Link
              href="/map"
              prefetch={false}
              className="ds-btn ds-btn--ghost site-nav-link header-map-link"
              aria-current={here('map')}
            >
              {ui('რუკა')}
            </Link>
            <Link
              href="/companies"
              prefetch={false}
              className="ds-btn ds-btn--ghost site-nav-link header-companies-link"
              aria-current={here('companies')}
            >
              {ui('კომპანიები')}
            </Link>
            <Link
              href="/blog"
              prefetch={false}
              className="ds-btn ds-btn--ghost site-nav-link"
              aria-current={here('blog')}
            >
              {ui('ბლოგი')}
            </Link>
          </nav>
          <div className="header-actions">
            {showSearch && (
              <Link
                href="/#search-heading"
                prefetch={false}
                className="ds-btn ds-btn--secondary site-action site-search"
                aria-label={ui('ძიება')}
                title={ui('ძიება')}
                onClick={(event) => localAction(event, onSearch)}
              >
                <Search aria-hidden="true" />
                <span className="site-action-label">{ui('ძებნა')}</span>
              </Link>
            )}
            <Link
              href="/?saved=1"
              prefetch={false}
              className="ds-btn ds-btn--secondary site-action header-saved"
              aria-label={
                count > 0
                  ? ui('შენახული ვაკანსიები: {0}', [count])
                  : ui('შენახული ვაკანსიები')
              }
              title={ui('შენახული ვაკანსიები')}
              aria-current={here('saved')}
              onClick={(event) => localAction(event, onSaved)}
            >
              <Bookmark aria-hidden="true" />
              <span className="site-action-label">{ui('შენახული')}</span>
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
              className="ds-btn ds-btn--secondary site-action header-cv"
              aria-label={ui('რეზიუმეს შექმნა')}
              title={ui('რეზიუმეს შექმნა')}
              aria-current={here('cv')}
            >
              <FilePlus2 aria-hidden="true" />
              <span className="site-action-label">{ui('რეზიუმეს შექმნა')}</span>
            </Link>
            {/* The one primary action in the masthead. */}
            <Link
              href="/business"
              prefetch={false}
              className="ds-btn ds-btn--primary site-post"
              aria-label={ui('ბიზნესისთვის')}
              title={ui('ბიზნესისთვის')}
              aria-current={here('business')}
            >
              <Building2 aria-hidden="true" />
              <span className="site-action-label">{ui('ბიზნესისთვის')}</span>
            </Link>
            <ThemeToggle />
            <SheetTrigger
              className="ds-btn ds-btn--secondary ds-btn--icon site-menu-trigger"
              aria-label={ui('მენიუს გახსნა')}
            >
              <Menu aria-hidden="true" />
            </SheetTrigger>
          </div>
        </div>
      </header>
      <SheetContent className="public-menu" showCloseButton={false}>
        <div className="public-menu-heading">
          <Brand />
          <SheetTitle className="sr-only">{ui('მენიუ')}</SheetTitle>
          <SheetClose
            className="ds-btn ds-btn--ghost ds-btn--icon"
            aria-label={ui('დახურვა')}
          >
            <X aria-hidden="true" />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          {ui('მთავარი ნავიგაცია')}
        </SheetDescription>
        <nav aria-label={ui('მთავარი ნავიგაცია')}>
          {[
            {
              href: '/',
              label: 'ვაკანსიები',
              place: 'all',
              icon: BriefcaseBusiness,
              action: onVacancies,
            },
            { href: '/map', label: 'რუკა', place: 'map', icon: Map },
            {
              href: '/companies',
              label: 'კომპანიები',
              place: 'companies',
              icon: Building2,
            },
            { href: '/blog', label: 'ბლოგი', place: 'blog', icon: BookOpen },
            {
              href: '/?saved=1',
              label: 'შენახული ვაკანსიები',
              place: 'saved',
              icon: Bookmark,
              action: onSaved,
            },
            {
              href: '/cv',
              label: 'რეზიუმეს შექმნა',
              place: 'cv',
              icon: FilePlus2,
            },
          ].map(({ href, label, place, icon: Icon, action }) => (
            <Link
              key={place}
              href={href}
              prefetch={false}
              className={place === 'saved' ? 'public-menu-personal' : undefined}
              aria-current={here(place)}
              onClick={(event) => {
                localAction(event, action);
                setMenuOpen(false);
              }}
            >
              <span className="public-menu-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>{ui(label)}</span>
              {place === 'saved' && count > 0 ? (
                <span className="public-menu-count">{count}</span>
              ) : (
                <ChevronRight
                  size={16}
                  className="public-menu-arrow"
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </nav>
        <div className="public-menu-bottom">
          <Link
            href="/business"
            prefetch={false}
            className="ds-btn ds-btn--primary public-menu-business"
            onClick={() => setMenuOpen(false)}
          >
            <Building2 size={18} aria-hidden="true" />
            {ui('ბიზნესისთვის')}
          </Link>
          <div className="public-menu-preferences">
            <div className="public-menu-preference">
              <span>{ui('ენა')}</span>
              <LanguageToggle />
            </div>
            <div className="public-menu-preference">
              <span>{ui('თემა')}</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
