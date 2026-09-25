'use client';
import { SalaryFilter } from './salary-filter';
import { SelectField } from './select-field';
import { Checkbox } from '@/components/ui/checkbox';
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
const postedOptions = [
  { value: '0', label: 'ნებისმიერ დროს' },
  { value: '1', label: 'დღეს' },
  { value: '3', label: 'ბოლო 3 დღეში' },
  { value: '7', label: 'ბოლო 7 დღეში' },
  { value: '30', label: 'ბოლო 30 დღეში' },
];
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
          <SelectField
            id={`${prefix}-employment`}
            value={value.employment}
            onChange={(next) =>
              change('employment', next as AdvancedFilters['employment'])
            }
            options={Object.entries(employmentLabels).map(([key, label]) => ({
              value: key,
              label,
            }))}
          />
        </>
      )}
      <label className="check-row" htmlFor={`${prefix}-entry-level`}>
        <Checkbox
          id={`${prefix}-entry-level`}
          checked={value.entryLevel}
          onCheckedChange={(checked) => change('entryLevel', checked)}
        />
        გამოცდილების გარეშე
      </label>
      <label htmlFor={`${prefix}-posted`}>გამოქვეყნებულია</label>
      <SelectField
        id={`${prefix}-posted`}
        value={String(value.postedWithin)}
        onChange={(next) =>
          change(
            'postedWithin',
            Number(next) as AdvancedFilters['postedWithin'],
          )
        }
        options={postedOptions}
      />
      {showSalary && (
        <SalaryFilter value={value} onChange={onChange} prefix={prefix} />
      )}
      <p className="filter-help">
        პირობები იფილტრება მხოლოდ განცხადებაში მითითებული ინფორმაციით.
      </p>
    </div>
  );
}
