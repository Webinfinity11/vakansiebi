'use client';
import { VacancyStatus } from './vacancy-status';
import { vacancyCardTitle, vacancyCardSalary } from '@/lib/vacancy-card-labels';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CompanyLogo } from './company-logo';
import { useVacancyActivity } from './use-vacancy-activity';
import { markListHop, vacancyPath } from '@/lib/vacancy-navigation';
import type { SimilarVacancy } from '@/lib/similar-vacancies';
import { trackAction } from '@/lib/analytics-client';
export function SimilarVacancies({
  id,
  returnTo,
}: {
  id: string;
  returnTo: string;
}) {
  const [result, setResult] = useState<{
    key: string;
    jobs: SimilarVacancy[];
    error: boolean;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const activity = useVacancyActivity();
  const excluded = activity.hidden.map((item) => item.id).join(',');
  const key = id + ':' + excluded;
  useEffect(() => {
    if (!activity.ready) return;
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (excluded) query.set('exclude', excluded);
    void fetch(`/api/jobs/${id}/similar?${query}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error('unavailable');
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key, jobs: data.jobs, error: false });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResult({ key, jobs: [], error: true });
        trackAction('similar_error');
      });
    return () => controller.abort();
  }, [activity.ready, id, excluded, key, retry]);
  const current = result?.key === key ? result : null;
  return (
    <section
      className="similar-vacancies"
      aria-labelledby="similar-title"
      aria-busy={!current}
    >
      <h2 id="similar-title">მსგავსი ვაკანსიები</h2>
      {!current ? (
        <>
          <p className="filter-help">მსგავსი ვაკანსიები იტვირთება…</p>
          <div className="similar-grid" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div className="similar-placeholder" key={index}>
                <span />
                <i />
                <i />
              </div>
            ))}
          </div>
        </>
      ) : current.error ? (
        <button
          className="secondary-button"
          onClick={() => setRetry((v) => v + 1)}
        >
          მსგავსი ვაკანსიების ჩატვირთვა
        </button>
      ) : !current.jobs.length ? (
        <p className="filter-help">
          ამ ეტაპზე მსგავსი აქტიური ვაკანსია ვერ მოიძებნა.{' '}
          <Link href={returnTo} prefetch={false}>
            ძებნაზე დაბრუნება
          </Link>
        </p>
      ) : (
        <div className="similar-grid">
          {current.jobs.map(({ job, reasons }) => (
            <Link
              key={job.id}
              href={vacancyPath(job)}
              onNavigate={() => {
                markListHop(returnTo, false);
                trackAction('open_similar');
              }}
              prefetch={false}
              className="similar-card"
            >
              <div className="similar-company">
                <CompanyLogo company={job.company} url={job.logoUrl} />
                <span>{job.company}</span>
              </div>
              <h3 title={job.title}>
                {vacancyCardTitle(job.title, job.source)}
              </h3>
              <VacancyStatus seen={activity.seen.includes(job.id)} />
              {vacancyCardSalary(job.salary, job.salaryPeriod, job.source) && (
                <span className="similar-salary">
                  {vacancyCardSalary(job.salary, job.salaryPeriod, job.source)}
                </span>
              )}
              <p>{reasons.join(' · ')}</p>
              <span className="similar-open">
                ვაკანსიის ნახვა <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
