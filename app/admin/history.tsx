'use client';
import { useEffect, useState } from 'react';
import { placementLabels, type PlacementTier } from '@/lib/placement';
import type { AuditEntry } from '@/lib/server/audit-history';

const actions: Record<string, string> = {
  publish: 'გამოქვეყნება',
  save: 'რედაქციის შენახვა',
  archive: 'არქივში გადატანა',
  reject: 'უარყოფა',
  restore: 'აღდგენა',
  'dismiss-update': 'წყაროს ცვლილების გამოტოვება',
  'apply-source': 'წყაროს ვერსიის ჩასმა',
  'merge.received': 'გაერთიანება',
  'confirm-payment': 'გადახდის დადასტურება',
  'confirm-refund': 'თანხის დაბრუნების დადასტურება',
  'placement.approved': 'განთავსების დადასტურება',
  'billing.settings.updated': 'ბილინგის პარამეტრები',
  'company.save': 'კომპანიის გვერდი',
  'employer.decide': 'კომპანიის სახელები',
  'scraper.dispatch': 'სკრეიპერის გაშვება',
  'submission.received': 'დამსაქმებლის განცხადება',
  'automation.published': 'ავტომატურად გამოქვეყნდა',
  'automation.archived': 'ავტომატურად დაარქივდა',
  'automation.pending': 'ავტომატურად შეჩერდა',
  'automation.resumed': 'ავტომატიზაცია განახლდა',
  'source.imported': 'შემოვიდა წყაროდან',
  'source.changed': 'წყაროზე შეიცვალა',
  'source.quality_held': 'შემოწმებაზე გაჩერდა',
  'source.hints_applied': 'წყაროს მინიშნებები',
  'source.category_reclassified': 'კატეგორია გადაკეთდა',
  'source.salary_amount_read': 'ხელფასი წაიკითხა',
  'source.enriched': 'დეტალები შეივსო',
  'source.city_enriched': 'ქალაქი შეივსო',
  'source.logo_enriched': 'ლოგო შეივსო',
};
const statuses: Record<string, string> = {
  pending: 'შემოტანილი',
  published: 'გამოქვეყნებული',
  archived: 'არქივი',
  rejected: 'უარყოფილი',
  merged: 'გაერთიანებული',
};
const reasons: Record<string, string> = {
  expired: 'ვადა გავიდა',
  removed: 'წყაროზე აღარ არის',
  unverified: 'ვერ მოწმდება',
  invalid_source_data: 'წყაროს მონაცემები არასრულია',
  employer_submission: 'დამსაქმებლის განცხადება',
};
const scopes = [
  ['people', 'ადმინი და დამსაქმებლები'],
  ['automation', 'ავტომატიზაცია'],
  ['sources', 'წყაროები'],
  ['all', 'ყველა'],
] as const;

function actor(value: string) {
  if (value === 'admin') return 'ადმინი';
  if (value === 'employer') return 'დამსაქმებელი';
  if (value === 'automation' || value.startsWith('requested:'))
    return 'ავტომატიზაცია';
  return value.replace(/^(crawler|parser):/, '');
}

/* One line saying what changed, from the few fields the server pulls out of each entry. */
function change(e: AuditEntry) {
  const parts: string[] = [];
  if (e.afterStatus && e.afterStatus !== e.beforeStatus)
    parts.push(
      `${e.beforeStatus ? (statuses[e.beforeStatus] ?? e.beforeStatus) + ' → ' : ''}${statuses[e.afterStatus] ?? e.afterStatus}`,
    );
  if (e.reason) parts.push(reasons[e.reason] ?? e.reason);
  if (e.tier)
    parts.push(
      `${placementLabels[e.tier as PlacementTier] ?? e.tier}${e.days ? `, ${e.days} დღე` : ''}`,
    );
  if (e.amount) parts.push(`${e.amount} ₾`);
  if (e.fields.length)
    parts.push(
      `შეიცვალა: ${e.fields.slice(0, 5).join(', ')}${e.fields.length > 5 ? ` +${e.fields.length - 5}` : ''}`,
    );
  return parts.join(' · ');
}

function useHistory(scope: string, job?: string) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [more, setMore] = useState(false);
  const [before, setBefore] = useState('');
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ scope });
    if (job) params.set('job', job);
    if (before) params.set('before', before);
    void fetch(`/api/admin/history?${params}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'ისტორია ვერ ჩაიტვირთა');
        setEntries((old) =>
          before ? [...old, ...data.entries] : data.entries,
        );
        setMore(data.more);
        setError('');
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [scope, job, before, version]);
  return {
    entries,
    more,
    error,
    loading,
    next: () => {
      setLoading(true);
      setBefore(entries.at(-1)?.id ?? '');
    },
    reload: () => {
      setLoading(true);
      setBefore('');
      setVersion((n) => n + 1);
    },
  };
}

function Entries({
  entries,
  showJob,
  onOpenJob,
}: {
  entries: AuditEntry[];
  showJob: boolean;
  onOpenJob?: (id: string) => void;
}) {
  return (
    <ul className="reports-list">
      {entries.map((e) => (
        <li key={e.id} className="reports-item history-item">
          <div className="reports-details">
            <div className="reports-meta">
              <strong>{actions[e.action] ?? e.action}</strong>
              <span>{actor(e.actor)}</span>
              <time dateTime={e.createdAt}>
                {new Date(e.createdAt).toLocaleString('ka-GE', {
                  timeZone: 'Asia/Tbilisi',
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </time>
            </div>
            {showJob && e.jobId && (
              <p className="history-job">
                {onOpenJob ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onOpenJob(e.jobId!)}
                  >
                    {e.title || 'ვაკანსია'}
                  </button>
                ) : (
                  e.title
                )}
                {e.company && <span> · {e.company}</span>}
              </p>
            )}
            {change(e) && <p className="history-change">{change(e)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HistoryPanel({
  onOpenJob,
}: {
  onOpenJob: (id: string) => void;
}) {
  const [scope, setScope] = useState<string>('people');
  return (
    <section className="reports-section" aria-label="ცვლილებების ისტორია">
      <fieldset className="submission-views" aria-label="ვინ შეცვალა">
        {scopes.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={scope === key}
            onClick={() => setScope(key)}
          >
            {label}
          </button>
        ))}
      </fieldset>
      {/* Keyed, so a new scope starts from the newest entry instead of the old cursor. */}
      <HistoryList key={scope} scope={scope} onOpenJob={onOpenJob} />
    </section>
  );
}

/* Folded by default and loaded only when opened: most reviews never need it. */
export function JobHistory({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="raw-details job-history"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>ცვლილებების ისტორია</summary>
      {open && <HistoryList key={jobId} scope="all" job={jobId} />}
    </details>
  );
}

function HistoryList({
  scope,
  job,
  onOpenJob,
}: {
  scope: string;
  job?: string;
  onOpenJob?: (id: string) => void;
}) {
  const h = useHistory(scope, job);
  return (
    <>
      <div className="reports-heading">
        <button
          type="button"
          className="secondary-button"
          disabled={h.loading}
          onClick={h.reload}
        >
          განახლება
        </button>
      </div>
      {h.error && <p role="alert">{h.error}</p>}
      {!h.loading && !h.entries.length && !h.error && (
        <p>ჩანაწერები არ არის.</p>
      )}
      <Entries entries={h.entries} showJob={!job} onOpenJob={onOpenJob} />
      {h.loading && <p>ისტორია იტვირთება…</p>}
      {h.more && !h.loading && (
        <button type="button" className="secondary-button" onClick={h.next}>
          მეტის ჩვენება
        </button>
      )}
    </>
  );
}
