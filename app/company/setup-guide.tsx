'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';

export type SetupStep = {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  action?: { label: string; run: () => void; href?: string };
};

/* The first steps of a new workspace, until they are done or the company hides the list.
   Each step says what to do next and opens the place where it is done. */
export function SetupGuide({ steps, canEdit }: {
  steps: SetupStep[];
  canEdit: boolean;
}) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(localStorage.getItem('jobx-company-setup-hidden') === '1');
  }, []);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  const next = steps.find((s) => !s.done);
  return (
    <section className="cp-setup" aria-label="დაწყება">
      <details>
      <summary className="cp-setup-head">
        <div>
          <h2>დაიწყეთ აქედან <ChevronRight className="cp-setup-chevron" size={16} aria-hidden="true" /></h2>
          <p>
            {done} / {steps.length}  გაკეთებულია </p>
        </div>
        <span className="cp-setup-bar" aria-hidden>
          <i style={{ width: `${(done / steps.length) * 100}%` }} />
        </span>
        <button
          type="button"
          className="cp-icon-btn"
          aria-label="დამალვა"
          title="დამალვა"
          onClick={() => {
            localStorage.setItem('jobx-company-setup-hidden', '1');
            setHidden(true);
          }}
        >
          <X size={15} />
        </button>
      </summary>
      <ol>
        {steps.map((s, i) => (
          <li
            key={s.id}
            data-done={s.done || undefined}
            data-next={s === next || undefined}
          >
            <span className="cp-setup-mark" aria-hidden>
              {s.done ? <Check size={14} /> : i + 1}
            </span>
            <div>
              <strong>{s.title}</strong>
              <span>{s.hint}</span>
            </div>
            {canEdit && !s.done && s.action && (
              s.action.href ? <Link className="cp-btn cp-btn--ghost cp-btn--sm" href={s.action.href}>{s.action.label}<ChevronRight size={14} /></Link> : <button
                type="button"
                className="cp-btn cp-btn--ghost cp-btn--sm"
                onClick={s.action.run}
              >
                {s.action.label}
                <ChevronRight size={14} />
              </button>
            )}
          </li>
        ))}
      </ol>
      </details>
      {next && <div className="cp-setup-next">
        <div><strong>{next.title}</strong><p>{next.hint}</p></div>
        {canEdit && next.action && (next.action.href
          ? <Link className="cp-btn cp-btn--ghost cp-btn--sm" href={next.action.href}>{next.action.label}<ChevronRight size={14} /></Link>
          : <button className="cp-btn cp-btn--ghost cp-btn--sm" type="button" onClick={next.action.run}>{next.action.label}<ChevronRight size={14} /></button>)}
      </div>}
    </section>
  );
}
