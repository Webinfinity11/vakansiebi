'use client';
import type { Source } from '@/lib/types';

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
              <select
                className="choice"
                aria-label={`${global ? 'ყველა წყარო' : sources[0]?.name}: ${f.label}`}
                value={common}
                onChange={(e) => onSave({ [f.key]: Number(e.target.value) })}
              >
                <option value="" disabled>
                  განსხვავებული ლიმიტები
                </option>
                {options.map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? '0 — გამორთული' : value}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {global && (
        <div className="scraper-limit-presets">
          <button
            type="button"
            className="secondary-button"
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
            დაბალი ლიმიტით ახალი ვაკანსიები შეიძლება დაგვიანებით შემოვიდეს; რიგი
            ინახება. მხოლოდ პირველი გვერდის შემოწმებამ სწრაფად მოძრავ წყაროზე
            ზოგი ახალი განცხადება შეიძლება გამოტოვოს.
          </p>
        </div>
      )}
      <p className="admin-helper">
        ცვლილება მოქმედებს შემდეგ გაშვებაზე. მუშავდება მხოლოდ ახალი ჩანაწერები;
        უკვე შენახული ვაკანსიები აღარ მოწმდება. დროის ამოწურვისას მიმდინარე
        მოთხოვნა სრულდება. პირველი სიის გვერდი ყოველთვის მოწმდება. გაშვების
        გარემოს უფრო დაბალი ლიმიტიც ძალაში რჩება.
      </p>
    </fieldset>
  );
}
