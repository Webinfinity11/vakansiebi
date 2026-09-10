'use client';
import type { SearchFilters } from '../lib/personal-space';
export type AdvancedFilters = Pick<
  SearchFilters,
  | 'salaryPeriod'
  | 'salaryFrom'
  | 'salaryTo'
  | 'employment'
  | 'entryLevel'
  | 'postedWithin'
>;
export const advancedDefaults: AdvancedFilters = {
  salaryPeriod: 'month',
  salaryFrom: null,
  salaryTo: null,
  employment: 'all',
  entryLevel: false,
  postedWithin: 0,
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
}: {
  value: AdvancedFilters;
  onChange: (value: AdvancedFilters) => void;
  prefix: string;
}) {
  const change = <K extends keyof AdvancedFilters>(
    key: K,
    next: AdvancedFilters[K],
  ) => onChange({ ...value, [key]: next });
  const invalid =
    value.salaryFrom !== null &&
    value.salaryTo !== null &&
    value.salaryFrom > value.salaryTo;
  return (
    <div className="advanced-filters">
      <label htmlFor={`${prefix}-employment`}>განაკვეთი</label>
      <select
        id={`${prefix}-employment`}
        value={value.employment}
        onChange={(e) =>
          change('employment', e.target.value as AdvancedFilters['employment'])
        }
      >
        {Object.entries(employmentLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
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
      <fieldset>
        <legend>საწყისი ანაზღაურება (₾)</legend>
        <label htmlFor={`${prefix}-pay-period`}>ანაზღაურების პერიოდი</label>
        <select
          id={`${prefix}-pay-period`}
          value={value.salaryPeriod}
          onChange={(e) =>
            change(
              'salaryPeriod',
              e.target.value as AdvancedFilters['salaryPeriod'],
            )
          }
        >
          <option value="month">თვეში</option>
          <option value="day">დღეში — დღიური ანაზღაურება</option>
        </select>
        <div className="salary-range">
          {(['salaryFrom', 'salaryTo'] as const).map((key, index) => (
            <label key={key} htmlFor={`${prefix}-${key}`}>
              {index ? 'მაქსიმუმ' : 'მინიმუმ'}
              <input
                id={`${prefix}-${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100000000}
                step={1}
                placeholder={index ? '∞' : '0'}
                value={value[key] ?? ''}
                aria-invalid={invalid}
                aria-describedby={`${prefix}-salary-help`}
                onChange={(e) => {
                  const amount =
                    e.target.value === '' ? null : Number(e.target.value);
                  if (
                    amount === null ||
                    (Number.isInteger(amount) &&
                      amount >= 0 &&
                      amount <= 100000000)
                  )
                    change(key, amount);
                }}
              />
            </label>
          ))}
        </div>
        <p
          id={`${prefix}-salary-help`}
          className={invalid ? 'filter-error' : 'filter-help'}
        >
          {invalid
            ? 'მინიმუმი მაქსიმუმზე მეტი არ უნდა იყოს.'
            : `შედარება ხდება მითითებული საწყისი თანხით, მხოლოდ ლარში და ${value.salaryPeriod === 'day' ? 'დღეზე' : 'თვეზე'}. ბონუსი არ ემატება.`}
        </p>
      </fieldset>
      <p className="filter-help">
        პირობები იფილტრება მხოლოდ განცხადებაში მითითებული ინფორმაციით.
      </p>
    </div>
  );
}
