'use client';
import type {
  ScraperMetrics,
  ScraperMetricRow,
} from '@/lib/server/scraper-metrics';
import { listingSourceNames, type Source } from '@/lib/types';

export function ScraperMetricsPanel({
  metrics,
  sources,
  busy,
  onMode,
}: {
  metrics: ScraperMetrics | null;
  sources: Source[];
  busy: boolean;
  onMode: (mode: 'economical' | 'full') => void;
}) {
  const common =
    sources.length &&
    sources.every((s) => s.processing_mode === sources[0].processing_mode)
      ? sources[0].processing_mode
      : '';
  const table = (rows: ScraperMetricRow[], daily: boolean) => (
    <section
      className="scraper-table-scroll"
      aria-label={daily ? 'დღიური შემოტანა' : 'წყაროების დატვირთვა'}
    >
      <table className="scraper-economy-table">
        <thead>
          <tr>
            <th scope="col">{daily ? 'თარიღი' : 'წყარო'}</th>
            <th scope="col">ახალი ვაკანსია</th>
            <th scope="col">განახლებული</th>
            <th scope="col">ახლის წაკითხვის მცდელობა</th>
            <th scope="col">ძველის გადამოწმება</th>
            <th scope="col">უცვლელი</th>
            <th scope="col">დუბლიკატი მიება</th>
            <th scope="col">შეცდომა</th>
            <th scope="col">მუშაობა, წთ</th>
            <th scope="col">გაზომილი / ყველა გაშვება</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                {daily
                  ? row.label
                  : listingSourceNames[
                      row.label as keyof typeof listingSourceNames
                    ] || row.label}
              </th>
              <td>{row.imported}</td>
              <td>{row.changed}</td>
              <td>{row.new_attempts ?? '—'}</td>
              <td>{row.recheck_attempts ?? '—'}</td>
              <td>{row.unchanged ?? '—'}</td>
              <td>{row.linked ?? '—'}</td>
              <td>{row.failed}</td>
              <td>{row.minutes}</td>
              <td>
                {row.measured_runs} / {row.runs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
  return (
    <div className="scraper-economy">
      <label className="scraper-mode-label">
        დამუშავების რეჟიმი — ყველა წყარო
        <select
          className="choice"
          value={common || ''}
          disabled={busy || !sources.length}
          onChange={(event) =>
            onMode(event.target.value as 'economical' | 'full')
          }
        >
          <option value="" disabled>
            წყაროებს განსხვავებული რეჟიმი აქვს
          </option>
          <option value="economical">
            ეკონომიური — ახალი ვაკანსიები პირველ რიგში
          </option>
          <option value="full">
            სრული — დარჩენილი ბიუჯეტი ძველების შემოწმებას
          </option>
        </select>
      </label>
      <p className="admin-helper">
        ეკონომიური რეჟიმი ძველების შემოწმებას დაახლოებით სამ დღეზე ანაწილებს და
        დიდი ხნის შეუმოწმებელ ჩანაწერებს პრიორიტეტს აძლევს. ახალი ვაკანსიების
        ძებნის ინტერვალი არ იცვლება. ვადაგასული და წაშლილი განცხადებების
        კონტროლი რჩება.
      </p>
      <h3>დღეში რამდენი ახალი ვაკანსია ემატება</h3>
      <p className="admin-helper">
        ბოლო 7 დღე, თბილისის დროით; დღევანდელი დღე ჯერ არ დასრულებულა. „ახალი“
        ნიშნავს ჩვენს ბაზაში ახლად შექმნილ ვაკანსიას — წყაროზე შესაძლოა ადრე
        გამოქვეყნდა. უკვე არსებულთან მიბმული დუბლიკატი ახალში არ ითვლება.
      </p>
      {metrics ? table(metrics.daily, true) : <p>მეტრიკები იტვირთება…</p>}
      <details>
        <summary>წყაროების დატვირთვა — ბოლო 24 საათი</summary>
        {metrics && table(metrics.sources, false)}
      </details>
      <p className="admin-helper">
        ახლის/ძველის წაკითხვის, უცვლელი ჩანაწერებისა და დუბლიკატების დათვლა ამ
        განახლების შემდეგ იწყება. „—“ ნიშნავს, რომ გაზომვა არ არსებობს;
        გარდამავალ დღეებში ეს სვეტები მხოლოდ გაზომილ გაშვებებს მოიცავს. წუთები
        პროცესების მუშაობის ჯამია, არა Vercel-ის build CPU ან გადასახადი.
      </p>
    </div>
  );
}
