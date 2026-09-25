'use client';
import type { AdvancedFilters } from './advanced-filters';
import { advancedValues } from '@/lib/advanced-filter-values';
import { SelectField } from './select-field';
export function SalaryFilter({
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
      <SelectField
        id={`${prefix}-pay-period`}
        value={value.salaryPeriod}
        onChange={(next) =>
          change('salaryPeriod', next as AdvancedFilters['salaryPeriod'])
        }
        options={[
          { value: 'month', label: 'თვეში' },
          { value: 'day', label: 'დღეში' },
        ]}
      />
      <fieldset className="salary-presets" aria-label="მინიმალური ანაზღაურება">
        {[
          null,
          ...(value.salaryPeriod === 'day'
            ? [50, 100, 150, 200]
            : [500, 1000, 1500, 2000, 3000]),
        ].map((amount) => (
          <button
            type="button"
            className="ds-chip"
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
      {/* The buttons say what they do. A paragraph under every filter explaining
          it is a sign the control needs the explanation, and this one does not. */}
    </fieldset>
  );
}
