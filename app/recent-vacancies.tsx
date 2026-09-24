'use client';
import { vacancyCardTitle } from '@/lib/vacancy-card-labels';
import { History } from 'lucide-react';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { ListHopLink } from './list-hop-link';
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
    <details className="recent-strip">
      <summary className="recent-summary">
        <History size={15} aria-hidden="true" /> ბოლოს ნანახი ({items.length})
      </summary>
      <div className="recent-head">
        <button type="button" onClick={onClear}>
          გასუფთავება
        </button>
      </div>
      <div className="recent-track">
        {items.map((item) => (
          /* This strip is part of the list too: a vacancy opened from it
             should be stepped back over, not stacked on top of. */
          <ListHopLink
            className="recent-card"
            key={item.id}
            href={vacancyPath(item, { from: returnPath })}
            from={returnPath}
            event="open_recent"
          >
            <strong title={item.title}>{vacancyCardTitle(item.title)}</strong>
            <span>{item.company || 'კერძო განცხადება'}</span>
          </ListHopLink>
        ))}
      </div>
    </details>
  );
}
