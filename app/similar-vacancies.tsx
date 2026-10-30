'use client';
import { useUi } from '@/app/ui-language';
import { VacancyStatus } from './vacancy-status';
import { vacancyCardTitle, vacancyCardSalary } from '@/lib/vacancy-card-labels';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CompanyLogo } from './company-logo';
import { companyDisplayName } from '@/lib/company-display-name';
import { useVacancyActivity } from './use-vacancy-activity';
import { markListHop, vacancyPath } from '@/lib/vacancy-navigation';
import type { SimilarVacancy } from '@/lib/similar-vacancies';
import { trackAction } from '@/lib/analytics-client';
import {
  fetchPublicJson,
  isSimilarJobs,
  loadFailureAction,
  loadFailureMessage,
} from '@/lib/public-load';
export function SimilarVacancies({
  id,
  returnTo,
}: {
  id: string;
  returnTo: string;
}) {
  const { ui, locale } = useUi();
  const [result, setResult] = useState<{
    key: string;
    attempt: number;
    jobs: SimilarVacancy[];
    error: string;
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
    void fetchPublicJson(`/api/jobs/${id}/similar?${query}`, {
      signal: controller.signal,
      valid: isSimilarJobs,
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key, attempt: retry, jobs: data.jobs, error: '' });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setResult({
          key,
          attempt: retry,
          jobs: [],
          error: loadFailureMessage(error),
        });
        trackAction(loadFailureAction('similar', error));
      });
    return () => controller.abort();
  }, [activity.ready, id, excluded, key, retry]);
  const current =
    result?.key === key && result.attempt === retry ? result : null;
  return (
    <section
      className="similar-vacancies"
      aria-labelledby="similar-title"
      aria-busy={!current}
    >
      <h2 id="similar-title">{ui('მსგავსი ვაკანსიები')}</h2>
      {!current ? (
        <>
          <p className="sr-only">{ui('მსგავსი ვაკანსიები იტვირთება')}</p>
          <div className="similar-grid" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div className="similar-placeholder" key={index}>
                {/* Divs, not spans: an older rule paints the placeholder's spans. */}
                <div className="ds-skeleton similar-skeleton-logo" />
                <div className="ds-skeleton ds-skeleton--title" />
                <div className="ds-skeleton similar-skeleton-line" />
                <div className="ds-skeleton similar-skeleton-short" />
              </div>
            ))}
          </div>
        </>
      ) : current.error ? (
        <>
          <output className="filter-help">{ui(current.error)}</output>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            {ui('ხელახლა ცდა')}
          </button>
        </>
      ) : !current.jobs.length ? (
        <p className="filter-help">
          {ui('ამ ეტაპზე მსგავსი აქტიური ვაკანსია ვერ მოიძებნა.')}{' '}
          <Link href={returnTo} prefetch={false}>
            {ui('ძებნაზე დაბრუნება')}
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
                <span>{companyDisplayName(job.company)}</span>
              </div>
              <h3 title={job.title}>
                {vacancyCardTitle(job.title, job.source)}
              </h3>
              <VacancyStatus seen={activity.seen.includes(job.id)} />
              {vacancyCardSalary(
                job.salary,
                job.salaryPeriod,
                job.source,
                locale,
              ) && (
                <span className="similar-salary">
                  {vacancyCardSalary(
                    job.salary,
                    job.salaryPeriod,
                    job.source,
                    locale,
                  )}
                </span>
              )}
              <p>
                {reasons
                  .map((reason) => {
                    const named = /^(მიმართულება|ქალაქი): (.+)$/.exec(reason);
                    return named
                      ? ui(`${named[1]}: {0}`, [ui(named[2])])
                      : ui(reason);
                  })
                  .join(' · ')}
              </p>
              <span className="similar-open">{ui('ვაკანსიის ნახვა')}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
