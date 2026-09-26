'use client';
import { SkeletonRows } from '../skeleton';
import { adminClock, adminDay } from '@/lib/admin-format';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, RefreshCw } from 'lucide-react';
import './admin-records.css';
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
  'source.city_normalized': 'ქალაქი გასწორდა',
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

/* Several entries on one vacancy within the same minute are one piece of work (publish, then
   the edit saved with it): the net change reads from the oldest before to the newest after. */
function merged(unit: AuditEntry[]): AuditEntry {
  if (unit.length === 1) return unit[0];
  const newest = unit[0];
  const oldest = unit.at(-1)!;
  return {
    ...newest,
    beforeStatus: oldest.beforeStatus,
    afterStatus:
      unit.find((e) => e.afterStatus && e.afterStatus !== e.beforeStatus)
        ?.afterStatus ?? newest.afterStatus,
    reason: unit.find((e) => e.reason)?.reason ?? null,
    tier: unit.find((e) => e.tier)?.tier ?? null,
    days: unit.find((e) => e.tier)?.days ?? null,
    amount: unit.find((e) => e.amount)?.amount ?? null,
    fields: unit.flatMap((e) => e.fields),
  };
}

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
  const status = e.afterStatus && e.afterStatus !== e.beforeStatus;
  if (!fields.length && !tier && !e.reason && !status) return null;
  return (
    <span className="history-diff">
      {status && (
        <span className="history-move">
          {e.beforeStatus && (
            <>
              <s>{statuses[e.beforeStatus] ?? e.beforeStatus}</s>
              <ChevronRight size={14} aria-label="შემდეგ" />
            </>
          )}
          <ins>{statuses[e.afterStatus!] ?? e.afterStatus}</ins>
        </span>
      )}
      {e.reason && <span>{reasons[e.reason] ?? e.reason}</span>}
      {tier && <ins>{tier}</ins>}
      {!!fields.length && (
        <span className="history-fields" title={fields.join(', ')}>
          შეიცვალა: {fields.slice(0, 6).join(', ')}
          {fields.length > 6 && ` +${fields.length - 6}`}
        </span>
      )}
    </span>
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

/* One unit is one line: a single entry, or a same-minute burst on one vacancy by one actor. */
type Unit = AuditEntry[];
type Row = { kind: 'one'; unit: Unit } | { kind: 'many'; units: Unit[] };

function units(entries: AuditEntry[]): Unit[] {
  const out: Unit[] = [];
  for (const entry of entries) {
    const last = out.at(-1)?.[0];
    if (
      last &&
      entry.jobId &&
      last.jobId === entry.jobId &&
      last.actor === entry.actor &&
      adminDay(last.createdAt) === adminDay(entry.createdAt) &&
      adminClock(last.createdAt) === adminClock(entry.createdAt)
    )
      out.at(-1)!.push(entry);
    else out.push([entry]);
  }
  return out;
}

/* Machines repeat themselves: three or more automatic entries of one kind in a row become a
   single line that opens on request, so a person's own decisions are not buried. */
function rows(entries: AuditEntry[], fold: boolean): Row[] {
  const out: Row[] = [];
  for (const unit of units(entries)) {
    const entry = unit[0];
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
      if (last?.kind === 'many' && same(last.units[0][0])) {
        last.units.push(unit);
        continue;
      }
      if (last?.kind === 'one' && same(last.unit[0])) {
        out[out.length - 1] = { kind: 'many', units: [last.unit, unit] };
        continue;
      }
    }
    out.push({ kind: 'one', unit });
  }
  // A pair is clearer shown than folded.
  return out.flatMap((row) =>
    row.kind === 'many' && row.units.length < 3
      ? row.units.map((unit) => ({ kind: 'one' as const, unit }))
      : [row],
  );
}

/* In the mixed "all" scope the actor is named; elsewhere the scope already says who, so a
   coloured initial is enough to tell a person from an employer. */
function Who({ value, full }: { value: string; full: boolean }) {
  const who = actor(value);
  if (full)
    return (
      <span className="history-who" data-tone={who.tone}>
        {who.name}
      </span>
    );
  return (
    <abbr className="history-initial" data-tone={who.tone} title={who.name}>
      {who.name.slice(0, 1).toUpperCase()}
    </abbr>
  );
}

function Entry({
  unit,
  showJob,
  showActor,
  onOpenJob,
}: {
  unit: Unit;
  showJob: boolean;
  showActor: boolean;
  onOpenJob?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const e = merged(unit);
  const label = [...new Set(unit.map((x) => actions[x.action] ?? x.action))]
    .reverse()
    .join(' · ');
  return (
    <li className="history-row" data-burst={unit.length > 1 || undefined}>
      <time dateTime={e.createdAt}>{adminClock(e.createdAt)}</time>
      <Who value={e.actor} full={showActor} />
      <p className="history-line">
        <strong>{label}</strong>
        {showJob && e.jobId && (
          <span className="history-target">
            {onOpenJob ? (
              <button
                type="button"
                className="history-link"
                title={e.title || undefined}
                onClick={() => onOpenJob(e.jobId!)}
              >
                {e.title || 'ვაკანსია'}
              </button>
            ) : (
              e.title
            )}
            {e.company && <span className="history-company">{e.company}</span>}
          </span>
        )}
        <Change e={e} />
      </p>
      {unit.length > 1 && (
        <button
          type="button"
          className="history-count ds-btn ds-btn--ghost ds-btn--sm"
          aria-expanded={open}
          aria-label={`${unit.length} ჩანაწერი ერთ წუთში — ${open ? 'დაკეცვა' : 'გაშლა'}`}
          onClick={() => setOpen((v) => !v)}
        >
          {unit.length}
          {open ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          )}
        </button>
      )}
      {open && (
        <ul className="history-inner">
          {unit.map((x) => (
            <Entry
              key={x.id}
              unit={[x]}
              showJob={false}
              showActor={showActor}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Folded({
  units: list,
  showJob,
  showActor,
  onOpenJob,
}: {
  units: Unit[];
  showJob: boolean;
  showActor: boolean;
  onOpenJob?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const first = list[0][0];
  return (
    <li className="history-row history-folded">
      <time dateTime={first.createdAt}>{adminClock(first.createdAt)}</time>
      <Who value={first.actor} full={showActor} />
      <p className="history-line">
        <strong>{actions[first.action] ?? first.action}</strong>
        <span className="history-company">{list.length} ვაკანსია</span>
      </p>
      <button
        type="button"
        className="history-count ds-btn ds-btn--ghost ds-btn--sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'დაკეცვა' : 'გაშლა'}
        {open ? (
          <ChevronUp size={14} aria-hidden="true" />
        ) : (
          <ChevronDown size={14} aria-hidden="true" />
        )}
      </button>
      {open && (
        <ul className="history-inner">
          {list.map((unit) => (
            <Entry
              key={unit[0].id}
              unit={unit}
              showJob={showJob}
              showActor={showActor}
              onOpenJob={onOpenJob}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Entries({
  entries,
  showJob,
  showActor,
  onOpenJob,
  fold = true,
}: {
  entries: AuditEntry[];
  showJob: boolean;
  showActor: boolean;
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
          <ul className="ds-appear-list">
            {rows(list, fold).map((row) =>
              row.kind === 'one' ? (
                <Entry
                  key={row.unit[0].id}
                  unit={row.unit}
                  showJob={showJob}
                  showActor={showActor}
                  onOpenJob={onOpenJob}
                />
              ) : (
                <Folded
                  key={row.units[0][0].id}
                  units={row.units}
                  showJob={showJob}
                  showActor={showActor}
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
  if (h.error)
    return (
      <p role="alert" className="overview-empty">
        {h.error}
      </p>
    );
  if (h.loading && !h.entries.length)
    return (
      <div className="overview-empty">
        <SkeletonRows rows={4} />
      </div>
    );
  if (!h.entries.length)
    return <p className="overview-empty">ჯერ არაფერი შეცვლილა.</p>;
  return (
    <Entries
      entries={h.entries.slice(0, 7)}
      showJob
      showActor={false}
      onOpenJob={onOpenJob}
    />
  );
}

export function HistoryPanel({
  onOpenJob,
}: {
  onOpenJob: (id: string) => void;
}) {
  const [scope, setScope] = useState<string>('people');
  return (
    <section
      className="reports-section history-panel"
      aria-label="ცვლილებების ისტორია"
    >
      <fieldset
        className="admin-chips admin-chips--scroll"
        aria-label="ვინ შეცვალა"
      >
        {scopes.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="ds-chip"
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
      <summary>
        <ChevronDown className="admin-summary-mark" aria-hidden="true" />
        ცვლილებების ისტორია
      </summary>
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
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={h.loading}
          onClick={h.reload}
        >
          <RefreshCw size={16} aria-hidden="true" />
          განახლება
        </button>
      </div>
      {h.error && (
        <p role="alert" className="notice">
          {h.error}
        </p>
      )}
      {!h.loading && !h.entries.length && !h.error && (
        <p className="history-empty">ამ სიაში ჩანაწერი ჯერ არ არის.</p>
      )}
      <Entries
        entries={h.entries}
        showJob={!job}
        showActor={scope === 'all'}
        onOpenJob={onOpenJob}
      />
      {h.loading && <SkeletonRows rows={4} label="ისტორია იტვირთება" />}
      {h.more && !h.loading && (
        <button
          type="button"
          className="ds-btn ds-btn--secondary history-more"
          onClick={h.next}
        >
          მეტის ჩვენება
        </button>
      )}
    </>
  );
}
