'use client';
import { useEffect, useState } from 'react';
import {
  vacancyEventKinds,
  type VacancyAnalytics,
} from '@/lib/vacancy-analytics';

export function useVacancyAnalytics(ids: string[], refresh: unknown) {
  const key = [...new Set(ids)].sort().join(',');
  const [state, setState] = useState<{
    key: string;
    refresh: unknown;
    data?: Record<string, VacancyAnalytics>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void fetch(
      `/api/admin/analytics/vacancies?ids=${encodeURIComponent(key)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'სტატისტიკა ვერ ჩაიტვირთა');
        return body as Record<string, VacancyAnalytics>;
      })
      .then((data) => setState({ key, refresh, data }))
      .catch((error) => {
        if (error.name !== 'AbortError')
          setState({ key, refresh, error: error.message });
      });
    return () => controller.abort();
  }, [key, refresh]);
  return state?.key === key && state.refresh === refresh ? state : null;
}

const labels = {
  view: 'ნახვები',
  outbound: 'პირველწყაროზე გადასვლები',
  call: 'ტელეფონის ღილაკი',
  cv: 'CV-ის ღილაკი',
  apply: 'განაცხადის ღილაკი',
  save: 'შენახვები',
};

export function VacancyAnalyticsBlock({
  data,
  error,
}: {
  data?: VacancyAnalytics;
  error?: string;
}) {
  return (
    <section className="submission-summary" aria-label="ვაკანსიის სტატისტიკა">
      <h3>ვაკანსიის სტატისტიკა</h3>
      <p className="admin-analytics-note">
        მოვლენების რაოდენობაა და არა უნიკალური ადამიანების; CV-ის, ტელეფონის ან
        განაცხადის ღილაკზე დაჭერა გაგზავნას ან დაკავშირებას არ ადასტურებს.
      </p>
      <p className="admin-analytics-hint">
        სულ — შეგროვებული ისტორია, ძველი დღიური ჩანაწერების ჩათვლით.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <output>სტატისტიკა იტვირთება…</output>
      ) : (
        <dl>
          {vacancyEventKinds.map((kind) => (
            <div key={kind}>
              <dt>{labels[kind]}</dt>
              <dd>
                სულ: {data.total[kind]} · ბოლო 7 დღე: {data.last7[kind]}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
