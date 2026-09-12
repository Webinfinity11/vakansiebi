'use client';
import Link from 'next/link';
import { History } from 'lucide-react';
import { vacancyPath } from '@/lib/vacancy-navigation';
import type { RecentVacancy } from '@/lib/vacancy-activity';
export function RecentVacancies({
  items,
  returnPath,
  onClear,
}: {
  items: RecentVacancy[];
  returnPath: string;
  onClear: () => void;
}) {
  return (
    <section className="recent-strip" aria-label="ბოლოს ნანახი">
      <div className="recent-head">
        <h2>
          <History size={15} aria-hidden="true" /> ბოლოს ნანახი
        </h2>
        <button type="button" onClick={onClear}>
          გასუფთავება
        </button>
      </div>
      <div className="recent-track">
        {items.map((item) => (
          <Link
            className="recent-card"
            key={item.id}
            href={vacancyPath(item.id, { from: returnPath })}
            prefetch={false}
          >
            <strong>{item.title}</strong>
            <span>{item.company || 'კერძო განცხადება'}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
