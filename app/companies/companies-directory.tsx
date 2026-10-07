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
import { companyVacancyTitle } from '@/lib/company-vacancy-title';
import { companyDisplayName } from '@/lib/company-display-name';
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
  const names = useMemo(
    () => companies.map((c) => plain(companyDisplayName(c.name))),
    [companies],
  );
  const needle = plain(deferred);
  const shown = companies.filter(
    (_c, i) => !needle || names[i].includes(needle),
  );
  const vacancies = companies.reduce((sum, c) => sum + c.jobs, 0);
  const grid = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (
      !grid.current ||
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add('company-card-entered');
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    for (const card of grid.current.children) observer.observe(card);
    return () => observer.disconnect();
  }, [needle, companies]);
  return (
    <>
      <header className="companies-head">
        {children}
        <p>
          {companies.length} კომპანია · {vacancies} აქტიური ვაკანსია
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
      <ul ref={grid} className="companies-grid" hidden={!shown.length}>
        {shown.map((company, index) => (
          <li key={company.slug} data-slug={company.slug}>
            <Link
              className="companies-card"
              href={`/companies/${encodeURIComponent(company.slug)}`}
              prefetch={false}
            >
              <CompanyLogo
                large
                company={company.name}
                url={company.logoUrl}
                defer={index >= 18}
              />
              <span className="companies-card-body">
                <span
                  className="companies-card-name"
                  title={companyVacancyTitle(company.name)}
                >
                  {companyVacancyTitle(company.name)}
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
