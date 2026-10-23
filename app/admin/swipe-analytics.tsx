import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import { adminTime } from '@/lib/admin-format';
import { vacancyPath } from '@/lib/vacancy-navigation';
import type { SwipeSummary } from '@/lib/server/analytics';
import { ApplicationCvLinks } from './application-cv-links';

const whole = new Intl.NumberFormat('ka-GE');

export function SwipeAnalytics({ summary }: { summary: SwipeSummary }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? summary.latest : summary.latest.slice(0, 5);
  return (
    <section className="aa-card aa-swipe-card" aria-label="CV-ის გაგზავნები">
      <header>
        <h3>
          <Send size={18} aria-hidden="true" /> CV-ის გაგზავნები · Swipe
        </h3>
        <span className="application-status" data-status="sent">
          <CheckCircle2 size={14} aria-hidden="true" /> რეალური გაგზავნები
        </span>
      </header>
      <p className="aa-hint">
        წარმატებული გაგზავნა ნიშნავს, რომ წერილი ელფოსტის სერვისმა მიიღო;
        მიმღებთან ჩაბარებას ან წაკითხვას არ ადასტურებს.
      </p>
      <dl className="swipe-delivery-totals">
        {[
          ['გაგზავნილი CV', summary.sends, 'sent'],
          ['კანდიდატი', summary.candidates, ''],
          ['ვერ გაიგზავნა', summary.failed, 'failed'],
          ['ატვირთული PDF', summary.upload, ''],
          ['JOBX CV', summary.jobx, ''],
        ].map(([label, count, status]) => (
          <div key={label} data-status={status || undefined}>
            <dt>{label}</dt>
            <dd>{whole.format(Number(count))}</dd>
          </div>
        ))}
      </dl>
      <p className="aa-hint">
        Swipe-ის გახსნა: {whole.format(summary.opens)} · გამოტოვება:{' '}
        {whole.format(summary.skips)}. კანდიდატები ითვლება განსხვავებული
        ელფოსტებით შერჩეულ პერიოდში.
      </p>
      <h4 className="aa-subhead">ბოლო გაგზავნები</h4>
      {summary.latest.length ? (
        <ul className="swipe-delivery-list">
          {shown.map((row) => (
            <li key={row.id}>
              <div className="swipe-delivery-details">
                <strong className="swipe-delivery-name">
                  {row.name || row.email}
                </strong>
                <span className="swipe-delivery-contact">
                  <a href={`mailto:${row.email}`}>{row.email}</a>
                  {row.phone && <span> · {row.phone}</span>}
                </span>
                <a
                  className="swipe-delivery-vacancy"
                  href={vacancyPath({ id: row.jobId, title: row.title })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {row.title}
                </a>
                <span className="swipe-delivery-recipient">
                  მიმღები: {row.recipient}
                </span>
                <div className="swipe-delivery-meta">
                  <span className="application-status" data-status="sent">
                    <CheckCircle2 size={14} aria-hidden="true" /> გაიგზავნა
                  </span>
                  <time dateTime={row.sentAt}>{adminTime(row.sentAt)}</time>
                  <span>
                    {row.cvKind === 'upload' ? 'ატვირთული PDF' : 'JOBX CV'}
                  </span>
                </div>
              </div>
              <ApplicationCvLinks application={row} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="aa-hint">ამ პერიოდში გაგზავნები არ ყოფილა.</p>
      )}
      {summary.latest.length > 5 && (
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? 'ნაკლების ჩვენება'
            : `ბოლო ${summary.latest.length} გაგზავნის ნახვა`}
        </button>
      )}
      {summary.sends > shown.length && shown.length > 0 && (
        <p className="aa-hint">
          ნაჩვენებია ბოლო {shown.length} გაგზავნა შერჩეული პერიოდის{' '}
          {whole.format(summary.sends)} გაგზავნიდან. სრული ისტორია
          ხელმისაწვდომია „CV-ები“ განყოფილებაში, „Swipe განაცხადებში“.
        </p>
      )}
    </section>
  );
}
