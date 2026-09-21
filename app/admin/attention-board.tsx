'use client';

import {
  CircleCheck,
  CircleAlert,
  OctagonAlert,
  Pause,
  Info,
  RefreshCw,
} from 'lucide-react';
import { attentionList, type Attention } from '@/lib/admin-attention';
import type { Source } from '@/lib/types';

const marks = {
  stopped: { icon: OctagonAlert, word: 'გაჩერდა' },
  stuck: { icon: CircleAlert, word: 'ჩაიჭედა' },
  tired: { icon: Pause, word: 'დასვენება სჭირდება' },
  note: { icon: Info, word: 'შესამოწმებელია' },
} as const;

/* The panel's first answer to "what is the state of things". Everything here is
   already in the tables below it; what those never did was draw the conclusion
   or say what to do, so a government source going three days uncollected and a
   scraper red for a week both sat in plain sight unnoticed. */
export function AttentionBoard({
  sources,
  busy,
  now,
  onAct,
  onReview,
}: {
  sources: Source[];
  busy: boolean;
  now: number;
  onAct: (source: string, body: Record<string, unknown>) => void;
  onReview: (source: string) => void;
}) {
  // `now` is the moment the panel's data was read; without it nothing is judged.
  const items = now ? attentionList(sources, now) : [];
  const act = (item: Attention) => {
    if (!item.action) return;
    const { source, kind } = item.action;
    if (kind === 'review') {
      onReview(source);
      return;
    }
    if (kind === 'rest') {
      const current =
        sources.find((s) => s.id === source)?.interval_minutes || 180;
      onAct(source, {
        action: 'configure',
        intervalMinutes: Math.min(1440, current * 2),
      });
      return;
    }
    onAct(source, { action: kind === 'retry' ? 'retry' : 'run' });
  };
  if (!sources.length || !now)
    return <p className="attention-empty">წყაროების მდგომარეობა იტვირთება…</p>;
  if (!items.length)
    return (
      <div className="attention-clear">
        <CircleCheck size={20} aria-hidden="true" />
        <div>
          <strong>ყველაფერი რიგზეა</strong>
          <p>
            {sources.filter((s) => s.enabled).length} წყარო მუშაობს, არცერთი არ
            გაჩერებულა და არაფერი ელოდება ჩარევას.
          </p>
        </div>
      </div>
    );
  return (
    <ul className="attention-list">
      {items.map((item) => {
        const Mark = marks[item.severity].icon;
        return (
          <li key={item.id} data-severity={item.severity}>
            <Mark size={18} aria-hidden="true" />
            <div className="attention-body">
              <h3>
                {item.title}
                <span className="attention-word">
                  {marks[item.severity].word}
                </span>
              </h3>
              <p className="attention-detail">{item.detail}</p>
              <p className="attention-advice">{item.advice}</p>
            </div>
            {item.action && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => act(item)}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {item.action.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
