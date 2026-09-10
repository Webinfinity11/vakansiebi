'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CompanyLogo } from './company-logo';
import { useVacancyActivity } from './use-vacancy-activity';
import { vacancyPath } from '@/lib/vacancy-navigation';
import type { SimilarVacancy } from '@/lib/similar-vacancies';
export function SimilarVacancies({
  id,
  returnTo,
}: {
  id: string;
  returnTo: string;
}) {
  const target = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    if (target.current) observer.observe(target.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !activity.ready) return;
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
        if (!controller.signal.aborted)
          setResult({ key, jobs: [], error: true });
      });
    return () => controller.abort();
  }, [visible, activity.ready, id, excluded, key, retry]);
  const current = result?.key === key ? result : null;
  return (
    <section
      className="similar-vacancies"
      ref={target}
      aria-labelledby="similar-title"
      aria-busy={!current}
    >
      <h2 id="similar-title">მსგავსი ვაკანსიები</h2>
      {!current ? (
        <p className="filter-help">მსგავს ვაკანსიებს ვეძებთ…</p>
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
              href={vacancyPath(job.id, { from: returnTo })}
              prefetch={false}
              className="similar-card"
            >
              <div className="similar-company">
                <CompanyLogo company={job.company} url={job.logoUrl} />
                <span>{job.company}</span>
              </div>
              <h3>{job.title}</h3>
              <span
                className={`similar-salary ${job.salary ? '' : 'salary-missing'}`}
              >
                {job.salary || 'ანაზღაურება არ არის მითითებული'}
              </span>
              <p>{reasons.join(' · ')}</p>
              <span className="similar-open">
                {activity.seen.includes(job.id)
                  ? 'ნანახია · ნახვა'
                  : 'ვაკანსიის ნახვა'}{' '}
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
