'use client';
import { SkeletonRows } from '../skeleton';
import { useEffect, useState } from 'react';
import { placementLabels } from '@/lib/placement';
import { postExtraLabels, postFieldLabels } from '@/lib/analytics-funnel';
import type {
  PostingAnalytics,
  PostingWindow,
} from '@/lib/server/posting-analytics';

const windows: [PostingWindow, string][] = [
  [7, '7 დღე'],
  [30, '30 დღე'],
  [90, '3 თვე'],
];
const whole = new Intl.NumberFormat('ka-GE');
const percent = (part: number, of: number) =>
  of ? `${Math.round((part / of) * 100)}%` : '—';
const statusNames = {
  pending: 'ელოდება',
  published: 'გამოქვეყნდა',
  rejected: 'უარყოფილი',
  archived: 'არქივი',
} as const;
const filledNames = {
  logo: 'ლოგო',
  salary: 'ხელფასი',
  deadline: 'ბოლო ვადა',
  email: 'ელფოსტა',
  phone: 'ტელეფონი',
  link: 'განაცხადის ბმული',
} as const;

function hoursText(h: number | null) {
  if (h === null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} წთ`;
  if (h < 48) return `${Math.round(h)} სთ`;
  return `${Math.round(h / 24)} დღე`;
}

/* How employers get through the posting form, and what really arrived from it. The form half
   counts steps, not people; the arrivals half is the submissions table, tests left out. */
export function PostingInsights() {
  const [days, setDays] = useState<PostingWindow>(30);
  const [data, setData] = useState<PostingAnalytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/analytics/posting?days=${days}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'ანალიტიკა ვერ ჩაიტვირთა');
        setData(body);
        setError('');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [days]);
  const shown = data?.days === days ? data : null;
  const steps = shown?.form.steps ?? [];
  const opened = steps[0]?.count ?? 0;
  const sent = steps.at(-1)?.count ?? 0;
  const received = shown?.received;
  return (
    <section className="posting" aria-label="ფორმის ანალიტიკა">
      <header className="posting-head">
        <div>
          <h2>როგორ ავსებენ ფორმას</h2>
          <p>
            ფორმის ეტაპები მოვლენების რაოდენობაა და არა ადამიანების; „მიღებული“
            ნამდვილი განცხადებებია, ტესტების გარეშე.
          </p>
        </div>
        <fieldset className="admin-chips" aria-label="პერიოდი">
          {windows.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="ds-chip"
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </header>
      {error && <p role="alert">{error}</p>}
      {!shown && !error && (
        <SkeletonRows rows={2} block label="ანალიტიკა იტვირთება" />
      )}
      {shown && received && (
        <>
          <dl className="vacancy-performance-kpis posting-kpis">
            <div>
              <dt>ფორმა გაიხსნა</dt>
              <dd>{whole.format(opened)}</dd>
            </div>
            <div>
              <dt>ბოლომდე შეავსეს</dt>
              <dd>{whole.format(sent)}</dd>
              <small>გახსნილთა {percent(sent, opened)}</small>
            </div>
            <div>
              <dt>მიღებული განცხადება</dt>
              <dd>{whole.format(received.total)}</dd>
              <small>
                გამოქვეყნდა: {whole.format(received.byStatus.published)}
              </small>
            </div>
            <div>
              <dt>დადასტურებამდე</dt>
              <dd>{hoursText(received.reviewHours)}</dd>
              <small>მედიანა, შემოსვლიდან გამოქვეყნებამდე</small>
            </div>
          </dl>

          <div className="posting-grid">
            <div className="posting-block">
              <h3>ფორმის ეტაპები</h3>
              {!opened ? (
                <p className="posting-muted">ამ პერიოდში ფორმა არ გახსნილა.</p>
              ) : (
                <ol className="posting-funnel">
                  {steps.map((step, i) => (
                    <li key={step.name}>
                      <span>{step.label}</span>
                      <span className="posting-track">
                        <i
                          style={{
                            width: `${Math.max(step.share, step.count ? 1 : 0)}%`,
                          }}
                        />
                      </span>
                      <b>{whole.format(step.count)}</b>
                      <small>
                        {i === 0
                          ? '100%'
                          : `${Math.round(step.share)}%${step.drop > 0 ? ` · −${Math.round(step.drop)}%` : ''}`}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="posting-block">
              <h3>სად ტოვებენ</h3>
              <Ranked
                rows={(shown.form.left ?? []).map((r) => [r.label, r.count])}
                empty="ფორმას შუაში არავინ მიატოვა."
              />
              <h3>რომელ ველზე ჩერდებიან</h3>
              <Ranked
                rows={shown.form.invalid.map((r) => [
                  postFieldLabels[r.name] ?? r.name,
                  r.count,
                ])}
                empty="შეცდომით გაგზავნის მცდელობა არ ყოფილა."
              />
            </div>
          </div>

          <div className="posting-grid">
            <div className="posting-block">
              <h3>რა მოვიდა</h3>
              {!received.total ? (
                <p className="posting-muted">
                  ამ პერიოდში ნამდვილი განცხადება არ მოსულა.
                </p>
              ) : (
                <>
                  <p className="posting-statuses">
                    {(
                      Object.keys(statusNames) as (keyof typeof statusNames)[]
                    ).map((key) => (
                      <span key={key}>
                        {statusNames[key]}:{' '}
                        <b>{whole.format(received.byStatus[key])}</b>
                      </span>
                    ))}
                  </p>
                  <table className="posting-table">
                    <thead>
                      <tr>
                        <th scope="col">მოთხოვნილი განთავსება</th>
                        <th scope="col">სულ</th>
                        <th scope="col">გამოქვეყნდა</th>
                        <th scope="col">ელოდება</th>
                        <th scope="col">უარყოფილი</th>
                      </tr>
                    </thead>
                    <tbody>
                      {received.byPlacement.map((row) => (
                        <tr key={row.tier}>
                          <th scope="row">{placementLabels[row.tier]}</th>
                          <td>{whole.format(row.total)}</td>
                          <td>{whole.format(row.published)}</td>
                          <td>{whole.format(row.pending)}</td>
                          <td>{whole.format(row.rejected)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="posting-block">
              <h3>რას ავსებენ</h3>
              {!received.total ? (
                <p className="posting-muted">—</p>
              ) : (
                <ul className="posting-filled">
                  {(
                    Object.keys(filledNames) as (keyof typeof filledNames)[]
                  ).map((key) => {
                    const count = received.filled[key];
                    const share = (count / received.total) * 100;
                    return (
                      <li key={key}>
                        <span>{filledNames[key]}</span>
                        <span className="posting-track">
                          <i
                            style={{
                              width: `${Math.max(share, count ? 1 : 0)}%`,
                            }}
                          />
                        </span>
                        <small>
                          {whole.format(count)} / {whole.format(received.total)}
                        </small>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {(!!received.categories.length || !!received.cities.length) && (
            <p className="posting-muted posting-tops">
              {!!received.categories.length && (
                <span>
                  მიმართულებები:{' '}
                  {received.categories
                    .map((r) => `${r.value} (${r.count})`)
                    .join(', ')}
                </span>
              )}
              {!!received.cities.length && (
                <span>
                  ქალაქები:{' '}
                  {received.cities
                    .map((r) => `${r.value} (${r.count})`)
                    .join(', ')}
                </span>
              )}
            </p>
          )}
          {!!shown.form.other.length && (
            <p className="posting-muted">
              სხვა:{' '}
              {shown.form.other
                .map(
                  (r) => `${postExtraLabels[r.value] ?? r.value} — ${r.count}`,
                )
                .join(' · ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Ranked({ rows, empty }: { rows: [string, number][]; empty: string }) {
  if (!rows.length) return <p className="posting-muted">{empty}</p>;
  const top = Math.max(...rows.map(([, n]) => n));
  return (
    <ul className="posting-filled">
      {rows.slice(0, 6).map(([label, count]) => (
        <li key={label}>
          <span>{label}</span>
          <span className="posting-track">
            <i style={{ width: `${(count / top) * 100}%` }} />
          </span>
          <small>{whole.format(count)}</small>
        </li>
      ))}
    </ul>
  );
}
