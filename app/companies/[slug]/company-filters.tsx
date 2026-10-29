'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { SelectField } from '@/app/select-field';
import { useUi } from '@/app/ui-language';
import { categories } from '@/lib/types';
import type { companyFilters } from '@/lib/company-filters';

export function CompanyFilters({
  path,
  filters,
  cities,
  filtered,
}: {
  path: string;
  filters: ReturnType<typeof companyFilters>;
  cities: string[];
  filtered: boolean;
}) {
  const { ui } = useUi();
  const [city, setCity] = useState(filters.city);
  const [category, setCategory] = useState(filters.category);
  const [sort, setSort] = useState(filters.sort);
  const cityNames = [
    ...new Set([...(filters.city ? [filters.city] : []), ...cities]),
  ];
  return (
    <search aria-label={ui('კომპანიის ვაკანსიების ძიება')}>
      <form
        action={path + '#company-jobs'}
        method="get"
        className="company-filters"
      >
        <div className="company-filter-field company-filter-query">
          <label htmlFor="company-query">{ui('ვაკანსიის ძიება')}</label>
          <input
            id="company-query"
            type="search"
            name="q"
            defaultValue={filters.query}
            maxLength={200}
            placeholder={ui('მაგ. მოლარე, მენეჯერი')}
          />
        </div>
        <div className="company-filter-field">
          <label htmlFor="company-city">{ui('ქალაქი')}</label>
          <SelectField
            id="company-city"
            name="city"
            value={city}
            onChange={setCity}
            options={[
              { value: '', label: 'ყველა ქალაქი' },
              ...cityNames.map((value) => ({ value, label: value })),
            ]}
          />
        </div>
        <div className="company-filter-field">
          <label htmlFor="company-category">{ui('მიმართულება')}</label>
          <SelectField
            id="company-category"
            name="category"
            value={category}
            onChange={setCategory}
            options={[
              { value: '', label: 'ყველა მიმართულება' },
              ...categories.map((value) => ({ value, label: value })),
            ]}
          />
        </div>
        <div className="company-filter-field">
          <label htmlFor="company-sort">{ui('დალაგება')}</label>
          <SelectField
            id="company-sort"
            name="sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'new', label: 'უახლესი' },
              { value: 'salary', label: 'მაღალი ხელფასი' },
              { value: 'deadline', label: 'ვადა იწურება' },
              { value: 'relevance', label: 'შესაბამისობა' },
            ]}
          />
        </div>
        <button
          type="submit"
          className="ds-btn ds-btn--primary company-filter-submit"
        >
          <Search size={18} aria-hidden="true" />
          {ui('ძებნა')}
        </button>
        <div className="company-filter-actions">
          <label className="company-filter-paid">
            <input
              type="checkbox"
              name="paid"
              value="true"
              defaultChecked={filters.paid}
            />
            {ui('ხელფასი მითითებულია')}
          </label>
          {filtered && (
            <Link href={path} prefetch={false} className="ds-btn ds-btn--ghost">
              {ui('გასუფთავება')}
            </Link>
          )}
        </div>
      </form>
    </search>
  );
}
