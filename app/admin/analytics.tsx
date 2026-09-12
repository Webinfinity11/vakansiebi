'use client';
import { useEffect, useState } from 'react';
import type { AnalyticsSummary, Ranked } from '@/lib/server/analytics';

const windows = [7, 30, 90, 365] as const;

/* Loads only when the tab is opened, so the vacancy list never waits on these counts. */
export function AnalyticsPanel() {
  const [days, setDays] = useState<(typeof windows)[number]>(30);
  const [state, setState] = useState<{
    days: number;
    data?: AnalyticsSummary;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/analytics?days=${days}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'ანალიტიკა ვერ ჩაიტვირთა');
        return body as AnalyticsSummary;
      })
      .then((data) => setState({ days, data }))
      .catch((error) => {
        if (error.name !== 'AbortError')
          setState({ days, error: String(error.message || error) });
      });
    return () => controller.abort();
  }, [days]);
  const current = state?.days === days ? state : null;
  return (
    <section className="admin-analytics">
      <p className="admin-analytics-note">
        ანონიმური რაოდენობები: ინახება მხოლოდ მოვლენის ტიპი, მნიშვნელობა და დრო
        — IP მისამართი, cookie და სესია არა.
      </p>
      <fieldset className="admin-analytics-windows">
        <legend className="sr-only">პერიოდი</legend>
        {windows.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={days === w}
            onClick={() => setDays(w)}
          >
            {w} დღე
          </button>
        ))}
      </fieldset>
      {!current ? (
        <p>იტვირთება…</p>
      ) : current.error ? (
        <p role="alert" className="admin-error">
          {current.error}
        </p>
      ) : (
        <>
          <dl className="admin-analytics-totals">
            <div>
              <dt>ძებნა</dt>
              <dd>{current.data!.totals.search}</dd>
            </div>
            <div>
              <dt>ძებნა შედეგის გარეშე</dt>
              <dd>{current.data!.totals.search_empty}</dd>
            </div>
            <div>
              <dt>ვაკანსიის ნახვა</dt>
              <dd>{current.data!.totals.view}</dd>
            </div>
            <div>
              <dt>გადასვლა დამსაქმებელთან</dt>
              <dd>{current.data!.totals.outbound}</dd>
            </div>
          </dl>
          <div className="admin-analytics-lists">
            <RankedList
              title="ყველაზე ხშირი ძებნა"
              rows={current.data!.searches}
            />
            <RankedList
              title="ძებნა, რომელიც არაფერს პოულობს"
              hint="ეს აჩვენებს, რა ეძებენ და რა არ გვაქვს."
              rows={current.data!.emptySearches}
            />
            <RankedList
              title="ყველაზე ნანახი ვაკანსიები"
              rows={current.data!.views}
              vacancy
            />
            <RankedList
              title="ყველაზე ხშირი გადასვლა დამსაქმებელთან"
              rows={current.data!.outbound}
              vacancy
            />
          </div>
        </>
      )}
    </section>
  );
}

function RankedList({
  title,
  hint,
  rows,
  vacancy = false,
}: {
  title: string;
  hint?: string;
  rows: Ranked[];
  vacancy?: boolean;
}) {
  return (
    <section className="admin-analytics-list">
      <h3>{title}</h3>
      {hint && <p className="admin-analytics-hint">{hint}</p>}
      {!rows.length ? (
        <p className="admin-analytics-empty">ამ პერიოდში მონაცემი არ არის.</p>
      ) : (
        <ol>
          {rows.map((row) => (
            <li key={row.value}>
              <span>
                {vacancy ? (
                  row.title ? (
                    <a
                      href={`/vacancies/${row.value}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.title}
                      {row.company ? ` — ${row.company}` : ''}
                    </a>
                  ) : (
                    <span className="admin-analytics-gone">
                      წაშლილი ვაკანსია
                    </span>
                  )
                ) : (
                  row.value
                )}
              </span>
              <b>{row.count}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
