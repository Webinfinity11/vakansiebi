'use client';
import type { AdvancedFilters } from './advanced-filters';
import { advancedValues } from '@/lib/advanced-filter-values';
export function SalaryFilter({
  value,
  onChange,
  prefix,
}: {
  value: AdvancedFilters;
  onChange: (value: AdvancedFilters) => void;
  prefix: string;
}) {
  const invalid =
    value.salaryFrom !== null &&
    value.salaryTo !== null &&
    value.salaryFrom > value.salaryTo;
  const change = <K extends keyof AdvancedFilters>(
    key: K,
    next: AdvancedFilters[K],
  ) =>
    onChange({
      ...advancedValues(value),
      [key]: next,
      ...(key === 'salaryPeriod' ? { salaryFrom: null, salaryTo: null } : {}),
    });
  return (
    <fieldset className="salary-filter">
      <legend>ანაზღაურება (₾)</legend>
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
      <fieldset className="salary-presets" aria-label="მინიმალური ანაზღაურება">
        {[
          null,
          ...(value.salaryPeriod === 'day'
            ? [50, 100, 150, 200]
            : [500, 1000, 1500, 2000]),
        ].map((amount) => (
          <button
            type="button"
            key={amount ?? 'any'}
            aria-pressed={
              value.salaryFrom === amount && value.salaryTo === null
            }
            onClick={() =>
              onChange({
                ...advancedValues(value),
                salaryFrom: amount,
                salaryTo: null,
              })
            }
          >
            {amount === null
              ? 'ნებისმიერი'
              : `${amount.toLocaleString('en-US').replace(',', ' ')} ₾-დან`}
          </button>
        ))}
      </fieldset>
      <details
        className="salary-custom"
        open={value.salaryTo !== null || undefined}
      >
        <summary>სხვა თანხა / დიაპაზონი</summary>
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
      </details>
      <p
        id={`${prefix}-salary-help`}
        className={invalid ? 'filter-error' : 'filter-help'}
      >
        {invalid
          ? 'მინიმუმი მაქსიმუმზე მეტი არ უნდა იყოს.'
          : 'მითითებული საწყისი თანხა, ბონუსის გარეშე.'}
      </p>
    </fieldset>
  );
}
