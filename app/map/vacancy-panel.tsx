'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import type { MapVacancy } from '@/lib/server/job-map';
import type { PublicJob } from '@/lib/types';
import { vacancySegment } from '@/lib/vacancy-navigation';
import { SkeletonRows } from '../skeleton';

const VacancyPage = dynamic(() => import('../vacancy-page'), {
  loading: () => <SkeletonRows rows={4} block label="ვაკანსია იტვირთება" />,
});

export function VacancyPanel({
  vacancy,
  onClose,
}: {
  vacancy: MapVacancy;
  onClose: () => void;
}) {
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current();
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/jobs?ids=${encodeURIComponent(vacancy.id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error('ვაკანსია ვერ ჩაიტვირთა. სცადე თავიდან.');
        const body: { jobs: PublicJob[] } = await response.json();
        const found = body.jobs.find((v) => v.id === vacancy.id);
        if (!found) throw Error('ვაკანსია აღარ არის ხელმისაწვდომი.');
        if (!controller.signal.aborted) setJob(found);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [vacancy.id, attempt]);

  return (
    <section className="job-map-detail" aria-label={vacancy.title}>
      <header className="job-map-detail-header">
        <button
          ref={close}
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm"
          onClick={onClose}
        >
          <ArrowLeft size={16} aria-hidden="true" /> რუკაზე დაბრუნება
        </button>
        <a
          href={`/vacancies/${encodeURIComponent(vacancySegment(vacancy))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm"
          aria-label="ვაკანსიის ახალ ჩანართში გახსნა"
        >
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm"
          aria-label="ვაკანსიის დახურვა"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="job-map-detail-scroll">
        {error ? (
          <div className="job-map-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="ds-btn ds-btn--secondary"
              onClick={() => {
                setError('');
                setAttempt((n) => n + 1);
              }}
            >
              თავიდან ცდა
            </button>
          </div>
        ) : job ? (
          <VacancyPage
            job={job}
            preview={false}
            returnTo="/map"
            companyPath={job.companyPath}
            embedded
          />
        ) : (
          <>
            <h2 className="job-map-detail-loading-title">{vacancy.title}</h2>
            <SkeletonRows rows={4} block label="ვაკანსია იტვირთება" />
          </>
        )}
      </div>
    </section>
  );
}
