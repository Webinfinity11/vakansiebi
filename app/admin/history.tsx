'use client';
import { adminClock, adminDay } from '@/lib/admin-format';
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
  'submission.test': 'ტესტის ნიშანი შეიცვალა',
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

/* Who made a change decides its colour: people first, then the machines. */
function actor(value: string) {
  if (value === 'admin') return { name: 'ადმინი', tone: 'admin' };
  if (value === 'employer') return { name: 'დამსაქმებელი', tone: 'employer' };
  if (value === 'automation' || value.startsWith('requested:'))
    return { name: 'ავტომატიზაცია', tone: 'auto' };
  return { name: value.replace(/^(crawler|parser):/, ''), tone: 'source' };
}
const fieldNames: Record<string, string> = {
  title: 'სათაური',
  company: 'კომპანია',
  category: 'კატეგორია',
  city: 'ქალაქი',
  salary: 'ხელფასი',
  salaryMin: 'ხელფასი',
  salaryPeriod: 'ხელფასი',
  currency: 'ხელფასი',
  deadline: 'ბოლო ვადა',
  datePosted: 'გამოქვეყნების თარიღი',
  description: 'აღწერა',
  mode: 'სამუშაო რეჟიმი',
  employmentType: 'განაკვეთი',
  facts: 'კონტაქტები',
  applicationLinks: 'განაცხადის ბმულები',
  logoUrl: 'ლოგო',
  source: 'წყარო',
  url: 'ბმული',
  warnings: 'გაფრთხილებები',
  name: 'სახელი',
  website: 'ვებგვერდი',
  payee_name: 'მიმღები',
  bank_name: 'ბანკი',
  iban: 'IBAN',
};
/* Internal bookkeeping fields say nothing to a person reading the history. */
const quietFields = new Set(['version', 'warnings', 'source', 'url']);

function Change({ e }: { e: AuditEntry }) {
  const fields = [
    ...new Set(
      e.fields
        .filter((f) => !quietFields.has(f))
        .map((f) => fieldNames[f] ?? f),
    ),
  ];
  const tier = e.tier
    ? `${placementLabels[e.tier as PlacementTier] ?? e.tier}${e.days ? ` · ${e.days} დღე` : ''}${e.amount ? ` · ${e.amount} ₾` : ''}`
    : e.amount
      ? `${e.amount} ₾`
      : '';
  if (!fields.length && !tier && !e.reason && e.afterStatus === e.beforeStatus)
    return null;
  return (
    <div className="history-diff">
      {e.afterStatus && e.afterStatus !== e.beforeStatus && (
        <>
          {e.beforeStatus && (
            <>
              <s>{statuses[e.beforeStatus] ?? e.beforeStatus}</s>→
            </>
          )}
          <ins>{statuses[e.afterStatus] ?? e.afterStatus}</ins>
        </>
      )}
      {e.reason && <span>{reasons[e.reason] ?? e.reason}</span>}
      {tier && <ins>{tier}</ins>}
      {!!fields.length && (
        <span>
          შეიცვალა: {fields.slice(0, 6).join(', ')}
          {fields.length > 6 && ` +${fields.length - 6}`}
        </span>
      )}
    </div>
  );
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

type Row =
  | { kind: 'one'; entry: AuditEntry }
  | { kind: 'many'; entries: AuditEntry[] };

/* Machines repeat themselves: three or more automatic entries of one kind in a row become a
   single line that opens on request, so a person's own decisions are not buried. */
function rows(entries: AuditEntry[], fold: boolean): Row[] {
  const out: Row[] = [];
  for (const entry of entries) {
    const last = out.at(-1);
    const same = (other: AuditEntry) =>
      other.action === entry.action &&
      actor(other.actor).tone === actor(entry.actor).tone &&
      adminDay(other.createdAt) === adminDay(entry.createdAt);
    if (
      fold &&
      actor(entry.actor).tone !== 'admin' &&
      actor(entry.actor).tone !== 'employer'
    ) {
      if (last?.kind === 'many' && same(last.entries[0])) {
        last.entries.push(entry);
        continue;
      }
      if (last?.kind === 'one' && same(last.entry)) {
        out[out.length - 1] = { kind: 'many', entries: [last.entry, entry] };
        continue;
      }
    }
    out.push({ kind: 'one', entry });
  }
  // A pair is clearer shown than folded.
  return out.flatMap((row) =>
    row.kind === 'many' && row.entries.length < 3
      ? row.entries.map((entry) => ({ kind: 'one' as const, entry }))
      : [row],
  );
}

function Entry({
  e,
  showJob,
  onOpenJob,
}: {
  e: AuditEntry;
  showJob: boolean;
  onOpenJob?: (id: string) => void;
}) {
  const who = actor(e.actor);
  return (
    <li className="history-row">
      <time dateTime={e.createdAt}>{adminClock(e.createdAt)}</time>
      <span className="history-who" data-tone={who.tone}>
        {who.name}
      </span>
      <div className="history-body">
        <p>
          <strong>{actions[e.action] ?? e.action}</strong>
          {showJob && e.jobId && (
            <>
              {' · '}
              {onOpenJob ? (
                <button
                  type="button"
                  className="history-link"
                  onClick={() => onOpenJob(e.jobId!)}
                >
                  {e.title || 'ვაკანსია'}
                </button>
              ) : (
                e.title
              )}
              {e.company && (
                <span className="history-company"> · {e.company}</span>
              )}
            </>
          )}
        </p>
        <Change e={e} />
      </div>
    </li>
  );
}

function Folded({
  entries,
  showJob,
  onOpenJob,
}: {
  entries: AuditEntry[];
  showJob: boolean;
  onOpenJob?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const first = entries[0];
  const who = actor(first.actor);
  return (
    <li className="history-row history-folded">
      <time dateTime={first.createdAt}>{adminClock(first.createdAt)}</time>
      <span className="history-who" data-tone={who.tone}>
        {who.name}
      </span>
      <div className="history-body">
        <p>
          <strong>
            {actions[first.action] ?? first.action} — {entries.length} ვაკანსია
          </strong>
        </p>
        <button
          type="button"
          className="history-link"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'დაკეცვა ▴' : 'ჩამონათვალის გაშლა ▾'}
        </button>
        {open && (
          <ul className="history-inner">
            {entries.map((e) => (
              <Entry key={e.id} e={e} showJob={showJob} onOpenJob={onOpenJob} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Entries({
  entries,
  showJob,
  onOpenJob,
  fold = true,
}: {
  entries: AuditEntry[];
  showJob: boolean;
  onOpenJob?: (id: string) => void;
  fold?: boolean;
}) {
  const days: { day: string; entries: AuditEntry[] }[] = [];
  for (const e of entries) {
    const day = adminDay(e.createdAt);
    if (days.at(-1)?.day === day) days.at(-1)!.entries.push(e);
    else days.push({ day, entries: [e] });
  }
  return (
    <div className="history-days">
      {days.map(({ day, entries: list }) => (
        // A day can recur when entries were written out of order, so its first entry keys it.
        <section key={list[0].id}>
          <h3>{day}</h3>
          <ul>
            {rows(list, fold).map((row) =>
              row.kind === 'one' ? (
                <Entry
                  key={row.entry.id}
                  e={row.entry}
                  showJob={showJob}
                  onOpenJob={onOpenJob}
                />
              ) : (
                <Folded
                  key={row.entries[0].id}
                  entries={row.entries}
                  showJob={showJob}
                  onOpenJob={onOpenJob}
                />
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* The overview's short feed: the latest things people did, nothing from the machines. */
export function RecentChanges({
  onOpenJob,
}: {
  onOpenJob: (id: string) => void;
}) {
  const h = useHistory('people');
  if (h.error) return <p role="alert">{h.error}</p>;
  if (h.loading && !h.entries.length)
    return <p className="overview-empty">იტვირთება…</p>;
  if (!h.entries.length)
    return <p className="overview-empty">ჯერ არაფერი შეცვლილა.</p>;
  return (
    <Entries entries={h.entries.slice(0, 7)} showJob onOpenJob={onOpenJob} />
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
