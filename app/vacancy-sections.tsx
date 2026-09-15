import type { ReactNode } from 'react';
import { Crown, Gem } from 'lucide-react';
import type { PublicJob } from '@/lib/types';

export function VacancySections({
  jobs,
  renderCard,
}: {
  jobs: PublicJob[];
  renderCard: (job: PublicJob, index: number) => ReactNode;
}) {
  const premium = jobs.filter(
    (j) => j.placement?.priority && j.placement.tier === 'premium',
  );
  const vip = jobs.filter(
    (j) => j.placement?.priority && j.placement.tier === 'vip',
  );
  if (!premium.length && !vip.length) return jobs.map(renderCard);
  const regular = jobs.filter((j) => !j.placement?.priority);
  let index = 0;
  const card = (job: PublicJob) => renderCard(job, index++);
  return (
    <>
      {!!premium.length && (
        <section
          className="featured-vacancies featured-premium"
          aria-label="პრემიუმ ვაკანსიები"
        >
          <header>
            <div className="featured-heading">
              <span className="featured-emblem">
                <Gem size={21} aria-hidden="true" />
              </span>
              <h3>პრემიუმ ვაკანსიები</h3>
            </div>
            <span className="featured-count">{premium.length} ვაკანსია</span>
          </header>
          <div>{premium.map(card)}</div>
        </section>
      )}
      {!!vip.length && (
        <section
          className="featured-vacancies featured-vip"
          aria-label="VIP ვაკანსიები"
        >
          <header>
            <div className="featured-heading">
              <span className="featured-emblem">
                <Crown size={21} aria-hidden="true" />
              </span>
              <h3>VIP ვაკანსიები</h3>
            </div>
            <span className="featured-count">{vip.length} ვაკანსია</span>
          </header>
          <div>{vip.map(card)}</div>
        </section>
      )}
      {!!regular.length && (
        <section className="regular-vacancies" aria-label="სხვა ვაკანსიები">
          <h3>სხვა ვაკანსიები</h3>
          {regular.map(card)}
        </section>
      )}
    </>
  );
}
