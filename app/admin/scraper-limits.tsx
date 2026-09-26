'use client';
import type { Source } from '@/lib/types';
import { SelectField } from '../select-field';

const fields = [
  {
    field: 'batch_limit',
    key: 'batchLimit',
    label: 'ჩანაწერი ერთ გაშვებაზე',
    values: [10, 25, 50, 100, 200],
    fallback: 200,
  },
  {
    field: 'budget_minutes',
    key: 'budgetMinutes',
    label: 'ძებნის დრო, წუთი',
    values: [1, 2, 4, 5, 8],
    fallback: 8,
  },
  {
    field: 'discovery_page_limit',
    key: 'discoveryPageLimit',
    label: 'დამატებითი სიის გვერდი',
    values: [0, 1, 2, 3],
    fallback: 3,
  },
] as const;

export function ScraperLimits({
  sources,
  busy,
  onSave,
  global = false,
}: {
  sources: Source[];
  busy: boolean;
  global?: boolean;
  onSave: (values: Record<string, unknown>) => void;
}) {
  return (
    <fieldset
      className="scraper-limit-controls"
      disabled={busy || !sources.length}
    >
      <legend>
        {global ? 'ლიმიტები — ყველა წყარო' : 'ამ წყაროს ლიმიტები'}
      </legend>
      <div className="scraper-limit-grid">
        {fields.map((f) => {
          const first = sources[0]?.[f.field] ?? f.fallback;
          const common = sources.every(
            (s) => (s[f.field] ?? f.fallback) === first,
          )
            ? first
            : '';
          const options = [...new Set<number>([...f.values, first])].sort(
            (a, b) => a - b,
          );
          return (
            <label key={f.key}>
              {f.label}
              <SelectField
                label={`${global ? 'ყველა წყარო' : sources[0]?.name}: ${f.label}`}
                value={common === '' ? '' : String(common)}
                disabled={busy || !sources.length}
                placeholder="განსხვავებული ლიმიტები"
                options={options.map((value) => ({
                  value: String(value),
                  label: value === 0 ? '0 — გამორთული' : String(value),
                }))}
                onChange={(v) => onSave({ [f.key]: Number(v) })}
              />
            </label>
          );
        })}
      </div>
      {global && (
        <div className="scraper-limit-presets">
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            onClick={() =>
              onSave({
                batchLimit: 100,
                budgetMinutes: 4,
                discoveryPageLimit: 1,
                repairLimit: 0,
                processingMode: 'economical',
              })
            }
          >
            დამზოგავი: 100 ჩანაწერი · 4 წუთი · 1 გვერდი
          </button>
          <p className="admin-helper">
            დაბალი ლიმიტით ახალი ვაკანსია შეიძლება დაგვიანდეს; რიგი ინახება.
          </p>
        </div>
      )}
      <p className="admin-helper">
        მოქმედებს შემდეგ გაშვებაზე; პირველი სიის გვერდი ყოველთვის მოწმდება.
      </p>
    </fieldset>
  );
}
