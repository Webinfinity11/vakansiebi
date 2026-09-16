'use client';
import { SalaryFilter } from './salary-filter';
import type { SearchFilters } from '../lib/personal-space';
import { advancedValues } from '@/lib/advanced-filter-values';
export type AdvancedFilters = Pick<
  SearchFilters,
  | 'salaryPeriod'
  | 'salaryFrom'
  | 'salaryTo'
  | 'employment'
  | 'entryLevel'
  | 'postedWithin'
  | 'deep'
>;
export const advancedDefaults: AdvancedFilters = {
  salaryPeriod: 'month',
  salaryFrom: null,
  salaryTo: null,
  employment: 'all',
  entryLevel: false,
  postedWithin: 0,
  deep: false,
};
export const employmentLabels = {
  all: 'ყველა განაკვეთი',
  'part-time': 'ნახევარი განაკვეთი',
  internship: 'სტაჟირება',
  daily: 'დღიური / ერთჯერადი სამუშაო',
};
export default function AdvancedFilterControls({
  value,
  onChange,
  prefix,
  showEmployment = true,
  showSalary = true,
}: {
  value: AdvancedFilters;
  onChange: (value: AdvancedFilters) => void;
  prefix: string;
  showEmployment?: boolean;
  showSalary?: boolean;
}) {
  const change = <K extends keyof AdvancedFilters>(
    key: K,
    next: AdvancedFilters[K],
  ) => onChange({ ...advancedValues(value), [key]: next });
  return (
    <div className="advanced-filters">
      {showEmployment && (
        <>
          <label htmlFor={`${prefix}-employment`}>განაკვეთი</label>
          <select
            id={`${prefix}-employment`}
            value={value.employment}
            onChange={(e) =>
              change(
                'employment',
                e.target.value as AdvancedFilters['employment'],
              )
            }
          >
            {Object.entries(employmentLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </>
      )}
      <label className="check-row" htmlFor={`${prefix}-entry-level`}>
        <input
          type="checkbox"
          id={`${prefix}-entry-level`}
          checked={value.entryLevel}
          onChange={(e) => change('entryLevel', e.target.checked)}
        />
        გამოცდილების გარეშე
      </label>
      <label htmlFor={`${prefix}-posted`}>გამოქვეყნებულია</label>
      <select
        id={`${prefix}-posted`}
        value={value.postedWithin}
        onChange={(e) =>
          change(
            'postedWithin',
            Number(e.target.value) as AdvancedFilters['postedWithin'],
          )
        }
      >
        <option value={0}>ნებისმიერ დროს</option>
        <option value={1}>დღეს</option>
        <option value={3}>ბოლო 3 დღეში</option>
        <option value={7}>ბოლო 7 დღეში</option>
        <option value={30}>ბოლო 30 დღეში</option>
      </select>
      {showSalary && (
        <SalaryFilter value={value} onChange={onChange} prefix={prefix} />
      )}
      <p className="filter-help">
        პირობები იფილტრება მხოლოდ განცხადებაში მითითებული ინფორმაციით.
      </p>
    </div>
  );
}
