'use client';
import Link from 'next/link';
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { CompanyLogo } from '../company-logo';
import type { DirectoryEmployer } from '@/lib/server/employers';

/* Quotes and legal forms are how names differ on paper, not what a reader types. */
const plain = (text: string) =>
  text
    .toLocaleLowerCase('ka')
    .replace(/["'«»„“”()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Every company with a logo, and a name filter that runs in the browser: the whole list is
    already on the page, so narrowing it needs no request. */
export function CompaniesDirectory({
  companies,
  children,
}: {
  companies: readonly DirectoryEmployer[];
  /** The page heading, placed above the count line this list keeps true. */
  children: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const names = useMemo(() => companies.map((c) => plain(c.name)), [companies]);
  /* The list holds only companies with a logo, and a logo that does not load would put the
     stand-in mark back on the page, so its card leaves the list instead. An image can fail
     before the page is interactive, so the ones already broken are found on arrival too. */
  const list = useRef<HTMLUListElement>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const drop = (img: EventTarget | null) => {
      const slug =
        img instanceof HTMLImageElement &&
        img.closest<HTMLElement>('[data-slug]')?.dataset.slug;
      if (slug) setBroken((prev) => new Set(prev).add(slug));
    };
    node
      .querySelectorAll('img')
      .forEach((img) => img.complete && !img.naturalWidth && drop(img));
    const onError = (event: Event) => drop(event.target);
    node.addEventListener('error', onError, true);
    return () => node.removeEventListener('error', onError, true);
  }, []);
  const needle = plain(deferred);
  const shown = companies.filter(
    (c, i) => !broken.has(c.slug) && (!needle || names[i].includes(needle)),
  );
  /* Counted from the cards actually shown, so a dropped card does not leave the line wrong. */
  const listed = companies.filter((c) => !broken.has(c.slug));
  const vacancies = listed.reduce((sum, c) => sum + c.jobs, 0);
  return (
    <>
      <header className="companies-head">
        {children}
        <p>
          {listed.length} კომპანია · {vacancies} აქტიური ვაკანსია
        </p>
      </header>
      <div className="companies-tools">
        <label className="companies-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">კომპანიის ძებნა სახელით</span>
          <input
            className="ds-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="მოძებნე კომპანია"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm companies-search-clear"
              aria-label="ძებნის გასუფთავება"
              onClick={() => setQuery('')}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
        <p className="companies-found" aria-live="polite">
          {needle ? `ნაპოვნია ${shown.length}` : ''}
        </p>
      </div>
      {/* Always mounted, so the logo watch above keeps its list while a filter empties it. */}
      <ul
        className="companies-grid ds-appear-list"
        ref={list}
        hidden={!shown.length}
      >
        {shown.map((company) => (
          <li key={company.slug} data-slug={company.slug}>
            <Link
              className="companies-card"
              href={`/companies/${encodeURIComponent(company.slug)}`}
              prefetch={false}
            >
              <CompanyLogo large company={company.name} url={company.logoUrl} />
              <span className="companies-card-body">
                <span className="companies-card-name" title={company.name}>
                  {company.name}
                </span>
                <span className="companies-card-jobs">
                  {company.jobs} აქტიური ვაკანსია
                </span>
                {company.cities.length > 0 && (
                  <span className="companies-card-cities">
                    <MapPin size={14} aria-hidden="true" />
                    <span>{company.cities.join(' · ')}</span>
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!shown.length && needle && (
        <div className="companies-empty companies-empty--filter ds-appear">
          <h2>„{query.trim()}“ ვერ მოიძებნა</h2>
          <p>
            სიაში მხოლოდ ის კომპანიებია, რომლებსაც ახლა აქტიური ვაკანსია აქვთ.
          </p>
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            onClick={() => setQuery('')}
          >
            ყველა კომპანიის ჩვენება
          </button>
        </div>
      )}
    </>
  );
}
