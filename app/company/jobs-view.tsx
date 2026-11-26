'use client';
import { rejectionText, rejectionGuidance } from '@/lib/job-rejection';
import './job-rejection.css';
import Link from 'next/link';
import { canPromoteJob } from './jobs/placement-eligibility';
import { StatusMark } from './status-mark';
import { candidateStages, stageLabels, type Candidate, type CandidateStage } from '@/lib/company-candidates';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { companyRequest, formatTime } from './company-api';
type Draft = { id: string; jobId: string | null; title: string; updatedBy: string; updatedAt: string };
import './billing.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  ExternalLink,
  MoreHorizontal,
  Copy,
  Archive,
  Pencil,
  RotateCcw,
  ArrowDownUp,
  ArrowUpRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  daysLeft,
  deadlineText,
  formatDate,
  formatUntilDate,
  inGroup,
  isClosed,
  isExpired,
  jobStatus,
  salaryText,
  type CompanyJob,
  type JobGroup,
} from './company-api';

type Sort = 'new' | 'deadline' | 'title';
const sorts: { value: Sort; label: string }[] = [
  { value: 'new', label: 'ბოლოს დამატებული' },
  { value: 'deadline', label: 'ვადის მიხედვით' },
  { value: 'title', label: 'დასახელებით' },
];
const groups: { id: JobGroup; label: string }[] = [
  { id: 'all', label: 'ყველა' },
  { id: 'active', label: 'აქტიური' },
  { id: 'review', label: 'განხილვაში' },
  { id: 'closed', label: 'დახურული' },
];
const soonDays = 7;
const expiringSoon = (j: CompanyJob) => {
  const left = daysLeft(j.form.deadline);
  return (
    j.status === 'published' && left !== null && left >= 0 && left <= soonDays
  );
};
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export function JobsView({
  canEdit,
  jobs,
  loaded,
  candidates, onCandidates, onNotice, onError,
  onCreate,
  onEdit,
  onCopy,
  onClose,
  intro,
  canManageBilling = false,
  approved = false,
}: {
  candidates: Candidate[];
  onCandidates: (id: string, stage?: CandidateStage) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  canEdit: boolean;
  canManageBilling?: boolean;
  approved?: boolean;
  onRefresh?: () => Promise<void>;
  intro?: React.ReactNode;
  jobs: CompanyJob[];
  loaded: boolean;
  onCreate: () => void;
  onEdit: (job: CompanyJob) => void;
  onCopy: (job: CompanyJob) => void;
  onClose: (job: CompanyJob) => void;
}) {
  const [group, setGroup] = useState<JobGroup | 'drafts'>('all');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [deleting, setDeleting] = useState<Draft | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [draftError, setDraftError] = useState('');
  useEffect(() => { let active = true; companyRequest('job-drafts').then(value => { if (active) setDrafts(value); }).catch(e => { if (active) setDraftError(e.message); }); return () => { active = false; }; }, []);
  const newDrafts = drafts.filter(d => !d.jobId);

  const [expiring, setExpiring] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        typing(event.target)
      )
        return;
      if (document.querySelector('[data-slot="sheet-content"],[role="dialog"]'))
        return;
      if (event.key === '/') {
        event.preventDefault();
        search.current?.focus();
      } else if (canEdit && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onCreate();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, onCreate]);
  const counts = useMemo(() => {
    const count = (g: JobGroup) => jobs.filter((j) => inGroup(j, g)).length;
    return {
      all: jobs.length,
      active: count('active'),
      review: count('review'),
      closed: count('closed'),
      expiring: jobs.filter(expiringSoon).length,
    };
  }, [jobs]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs
      .filter((j) => group !== 'drafts' && inGroup(j, group))
      .filter((j) => !expiring || expiringSoon(j))
      .filter(
        (j) =>
          !q ||
          j.title.toLowerCase().includes(q) ||
          j.form.city.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // Open vacancies first; closed ones sink to the end of every order.
        const closedLast = Number(isClosed(a)) - Number(isClosed(b));
        if (closedLast) return closedLast;
        if (sort === 'title') return a.title.localeCompare(b.title, 'ka');
        if (sort === 'deadline')
          return (
            (daysLeft(a.form.deadline) ?? 1e9) -
            (daysLeft(b.form.deadline) ?? 1e9)
          );
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [jobs, group, expiring, query, sort]);
  function pick(next: JobGroup | 'drafts', soon = false) {
    setGroup(next);
    setExpiring(soon);
  }
  const metrics = [
    {
      key: 'active',
      label: 'აქტიური',
      value: counts.active,
      note: 'ჩანს საიტზე',
      on: group === 'active' && !expiring,
      pick: () => pick('active'),
    },
    {
      key: 'review',
      label: 'განხილვაში',
      value: counts.review,
      note: 'ელოდება დადასტურებას',
      on: group === 'review',
      pick: () => pick('review'),
    },
    {
      key: 'expiring',
      label: 'ვადა იწურება',
      value: counts.expiring,
      note: `${soonDays} დღეში ან უფრო ადრე`,
      tone: counts.expiring ? 'warn' : undefined,
      on: expiring,
      pick: () => pick('active', true),
    },
    {
      key: 'closed',
      label: 'დახურული',
      value: counts.closed,
      note: 'არქივი',
      on: group === 'closed',
      pick: () => pick('closed'),
    },
  ];
  const sortLabel = sorts.find((s) => s.value === sort)?.label;
  return (
    <>
      <header className="cp-head">
        <div className="cp-head-title">
          <h1>ვაკანსიები</h1>
          {loaded && <span>{counts.all}</span>}
        </div>
        <div className="cp-head-actions">
          <label className="cp-search">
            <Search size={15} />
            <input
              ref={search}
              type="search"
              aria-label="ვაკანსიის ძიება"
              placeholder="ძიება"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                }
              }}
            />
            <kbd>/</kbd>
          </label>
          {canEdit && (
            <Link className="cp-btn cp-btn--primary" href="/company/jobs/new">
              <Plus size={16} />
               ახალი ვაკანსია <kbd>N</kbd>
            </Link>
          )}
        </div>
      </header>
      {intro}
      <div className="cp-metrics" role="group" aria-label="შეჯამება">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={m.on}
            data-tone={m.tone}
            onClick={() => (m.on ? pick('all') : m.pick())}
          >
            <span className="cp-metric-label">{m.label}</span>
            <strong>{loaded ? m.value : '–'}</strong>
            <span className="cp-metric-note">{m.note}</span>
          </button>
        ))}
      </div>
      <section className="cp-jobs-list">
      <div className="cp-tabs-row">
        <div className="cp-tabs" role="group" aria-label="სტატუსი">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={group === g.id && !expiring}
              onClick={() => pick(g.id)}
            >
              {g.label}
              <span>{counts[g.id]}</span>
            </button>
          ))}
          <button type="button" aria-pressed={group === 'drafts'} onClick={() => pick('drafts')}>მონახაზები<span>{newDrafts.length}</span></button>
          {expiring && (
            <button
              type="button"
              aria-pressed
              className="cp-tab-chip"
              onClick={() => pick('all')}
            >
               ვადა იწურება × </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="cp-btn cp-btn--ghost cp-btn--sm">
            <ArrowDownUp size={14} />
            {sortLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="cp-menu min-w-52">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => setSort(v as Sort)}
            >
              {sorts.map((s) => (
                <DropdownMenuRadioItem key={s.value} value={s.value}>
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {draftError && <p role="alert" className="cp-alert">{draftError}</p>}
      {group === 'drafts' ? <div className="cp-drafts">
        {newDrafts.filter(d => !query || d.title.toLowerCase().includes(query.toLowerCase())).map(d => <article className="cp-draft" key={d.id}>
          <div><strong>{d.title || 'უსათაურო მონახაზი'}</strong><p>ბოლო ცვლილება: {d.updatedBy} · {formatDate(d.updatedAt)}, {formatTime(d.updatedAt)}</p></div>
          {canEdit && <div className="cp-draft-actions"><Link className="cp-btn cp-btn--ghost" href={`/company/jobs/new?draft=${d.id}`}>გაგრძელება</Link><button className="cp-btn cp-btn--ghost" onClick={() => setDeleting(d)}>მონახაზის წაშლა</button></div>}
        </article>)}
        {!newDrafts.length && <div className="cp-empty"><p>მონახაზები არ არის</p>{canEdit && <Link className="cp-btn cp-btn--ghost" href="/company/jobs/new">ახალი ვაკანსია</Link>}</div>}
      </div> : !loaded ? (
        <div className="cp-table" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="cp-row cp-row--loading">
              <span className="ds-skeleton" />
            </div>
          ))}
        </div>
      ) : !jobs.length ? (
        <div className="cp-empty">
          <h2>ჯერ ვაკანსია არ გაქვთ</h2>
          <p>
             დაამატეთ პირველი განცხადება. თუ კომპანიის ვაკანსია საიტზე უკვე განთავსებულია, დაგვიკავშირდით და ანგარიშს მივაბამთ. </p>
          {canEdit && (
            <Link className="cp-btn cp-btn--ghost" href="/company/jobs/new">
              <Plus size={16} />
               ვაკანსიის დამატება </Link>
          )}
        </div>
      ) : !visible.length ? (
        <div className="cp-empty cp-empty--small">
          <p>ამ ფილტრით ვაკანსია ვერ მოიძებნა.</p>
          <button
            type="button"
            className="cp-btn cp-btn--ghost cp-btn--sm"
            onClick={() => {
              pick('all');
              setQuery('');
            }}
          >
             ფილტრების მოხსნა </button>
        </div>
      ) : (
        <div className="cp-table" role="table" aria-label="ვაკანსიები">
          <div className="cp-row cp-row--head" role="row">
            <span role="columnheader">ვაკანსია</span>
            <span role="columnheader">სტატუსი</span>
            <span role="columnheader">ანაზღაურება</span>
            <span role="columnheader">ვადა</span>
            <span role="columnheader">დამატებულია</span>
            <span role="columnheader" className="cp-sr">
               მოქმედებები </span>
          </div>
          {visible.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              candidates={candidates.filter(c => c.jobId === job.id)}
              hasDraft={drafts.some(d => d.jobId === job.id)}
              onCandidates={onCandidates}
              onNotice={onNotice}
              onError={onError}
              canEdit={canEdit}
              canManageBilling={canManageBilling}
              approved={approved}
              onEdit={onEdit}
              onCopy={onCopy}
              onClose={onClose}
            />
          ))}
        </div>
      )}
      </section>
      <Dialog open={!!deleting} onOpenChange={open => { if (!open && !deletingBusy) setDeleting(null); }}><DialogContent className="cp-dialog"><DialogTitle>მონახაზის წაშლა</DialogTitle><DialogDescription>მონახაზი წაიშლება. ამ მოქმედების გაუქმება შეუძლებელია.</DialogDescription><div className="cp-dialog-actions"><button className="cp-btn cp-btn--ghost" disabled={deletingBusy} onClick={() => setDeleting(null)}>გაუქმება</button><button className="cp-btn cp-btn--danger" disabled={deletingBusy} onClick={async () => { if (!deleting) return; setDeletingBusy(true); try { await companyRequest('job-drafts', { action: 'delete', id: deleting.id }); setDrafts(list => list.filter(d => d.id !== deleting.id)); setDeleting(null); } catch(e) { onError(e instanceof Error ? e.message : 'მონახაზის წაშლა ვერ მოხერხდა'); } finally { setDeletingBusy(false); } }}>მონახაზის წაშლა</button></div></DialogContent></Dialog>

    </>
  );
}

/** Share of the posting period that is still left, 0–1. */
function remaining(job: CompanyJob, left: number | null) {
  if (left === null) return 0;
  if (left <= 0) return 0;
  const start = job.publishedAt ?? job.createdAt;
  const total = daysLeft(job.form.deadline, new Date(start));
  if (!total || total <= 0) return 1;
  return Math.min(1, left / total);
}

function JobRow({
  candidates, hasDraft, onCandidates, onNotice, onError,
  canEdit,
  canManageBilling,
  approved,
  job,
  onEdit,
  onCopy,
  onClose,
}: {
  candidates: Candidate[];
  hasDraft: boolean;
  onCandidates: (id: string, stage?: CandidateStage) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  canEdit: boolean;
  canManageBilling?: boolean;
  approved: boolean;
  onRefresh?: () => Promise<void>;
  job: CompanyJob;
  onEdit: (job: CompanyJob) => void;
  onCopy: (job: CompanyJob) => void;
  onClose: (job: CompanyJob) => void;
}) {
  const canPromote = canPromoteJob(job, !!canManageBilling, approved, new Date());
  const rejection = job.rejection;
  const status = jobStatus(job);
  const closed = isClosed(job);
  const expired = isExpired(job);
  const left = daysLeft(job.form.deadline);
  const urgency = closed
    ? undefined
    : left !== null && left < 0
      ? 'over'
      : left !== null && left <= soonDays
        ? 'soon'
        : 'ok';
  const salary = salaryText(job);
  const reopen = ['archived', 'rejected'].includes(job.status);
  const place = [
    job.form.city,
    !job.imported && job.form.mode !== 'ადგილზე' ? job.form.mode : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      className="cp-row"
      role="row"
      data-closed={closed || undefined}
      data-read-only={!canEdit || undefined}
      onClick={(e) => {
        // Clicks inside the row's menu reach here through the React portal; only plain
        // clicks on the row itself open the editor.
        if (!e.currentTarget.contains(e.target as Node)) return;
        if ((e.target as HTMLElement).closest('button,a')) return;
        if (canEdit) onEdit(job);
      }}
    >
      <div role="cell" className="cp-cell-title">
        {canEdit ? (
          <button type="button" onClick={() => onEdit(job)}>
            {job.title}
          </button>
        ) : (
          <strong>{job.title}</strong>
        )}
        <span>{place}</span>
        {job.status === 'rejected' && <div className="cp-job-rejection">
          {rejection && <><StatusMark kind="rejected">{rejectionText(rejection.reason, rejection.note)}</StatusMark><p>{rejectionGuidance[rejection.reason]}</p></>}
          {canEdit && <Link href={`/company/jobs/${job.id}/edit`}>გასწორება და ხელახლა გაგზავნა</Link>}
        </div>}
        {candidates.length > 0 && <div className="cp-stage-bar" aria-hidden="true">
          {candidateStages.map(stage => {
            const count = candidates.filter(c => c.stage === stage).length;
            return count > 0 ? <i key={stage} data-stage={stage} style={{ flex: count }} /> : null;
          })}
        </div>}
        <div className="cp-stage-counts" aria-label="კანდიდატების ეტაპები">
          {candidates.length ? [...candidateStages, 'all' as const].map(stage => {
            const count = stage === 'all' ? candidates.length : candidates.filter(c => c.stage === stage).length;
            return count > 0 ? <button type="button" key={stage} data-stage={stage} onClick={() => onCandidates(job.id, stage === 'all' ? undefined : stage)}><StatusMark kind={stage}>{stage === 'all' ? 'სულ' : stageLabels[stage]}{' '}<b>{count}</b></StatusMark></button> : null;
          }) : <span>განაცხადები ჯერ არ არის</span>}
        </div>
        {canEdit && expired && <Link className="cp-btn cp-btn--primary cp-btn--sm" href={`/company/jobs/${job.id}/extend`}>ვადის გაგრძელება</Link>}
        {hasDraft && (canEdit ? <Link href={`/company/jobs/${job.id}/edit`}>შეუნახავი ცვლილებები</Link> : <span>შეუნახავი ცვლილებები</span>)}

        {job.placement &&
          job.placement !== 'standard' &&
          job.placementExpiresAt &&
          new Date(job.placementExpiresAt).getTime() > Date.now() && (
            <span>
              {job.placement === 'vip' ? 'VIP' : 'პრემიუმი'} აქტიურია{' '}
              {formatUntilDate(job.placementExpiresAt)}</span>
          )}
        {job.invoice?.status === 'pending' && (
          <div className="cp-payment-pending">
            <strong>{job.invoice.renewal_for_expires_at ? 'გასაგრძელებლად გადასახდელია' : 'გადასახდელია'} — {job.invoice.amount_gel} ₾</strong>
            <Link href={`/company/jobs/${job.id}/promote`}>გადახდის მონაცემები</Link>
          </div>
        )}
        {job.invoice?.status === 'paid' && job.placement === 'standard' && (
          <span>გადახდილია · ელოდება განთავსების დადასტურებას</span>
        )}
        {canPromote && (
            <Link className="cp-btn cp-btn--ghost cp-btn--sm" href={`/company/jobs/${job.id}/promote`}>წინ წამოწევა</Link>
          )}
      </div>
      <div role="cell" className="cp-cell-status">
        <StatusMark kind={expired ? 'expiring' : job.status} className="cp-status" data-tone={status.tone}>
          {status.label}
        </StatusMark>
        {job.needsReview && job.status === 'published' && job.invoice?.status !== 'pending' && (
          <StatusMark kind="update" className="cp-subtle">ცვლილება განხილვაშია</StatusMark>
        )}
      </div>
      <div role="cell" className="cp-cell-salary">
        {salary || <span className="cp-subtle">არ არის მითითებული</span>}
      </div>
      <div role="cell" className="cp-cell-deadline" data-urgency={urgency}>
        {closed ? (
          <span className="cp-subtle">—</span>
        ) : (
          <>
            <span>{deadlineText(left)}</span>
            <span className="cp-meter" aria-hidden>
              <span style={{ width: `${remaining(job, left) * 100}%` }} />
            </span>
          </>
        )}
      </div>
      <div role="cell" className="cp-cell-date">
        {formatDate(job.createdAt)}
      </div>

      <div role="cell" className="cp-cell-actions">
            {(canEdit || job.publicPath) && <DropdownMenu>
              <DropdownMenuTrigger
                className="cp-icon-btn"
                aria-label={`სხვა მოქმედებები: ${job.title}`}
                title={`სხვა მოქმედებები: ${job.title}`}
              >
                <MoreHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="cp-menu min-w-48">
                {canEdit && <DropdownMenuItem onClick={() => onEdit(job)}>
                  {reopen ? <RotateCcw /> : <Pencil />}
                  {reopen ? 'ხელახლა გაგზავნა' : 'რედაქტირება'}
                </DropdownMenuItem>}
                {canEdit && job.status === 'published' && <DropdownMenuItem render={<Link href={`/company/jobs/${job.id}/extend`} />}><RotateCcw />ვადის გაგრძელება</DropdownMenuItem>}
                {canEdit && <DropdownMenuItem onClick={() => onCopy(job)}>
                  <Copy />
                   ასლის შექმნა </DropdownMenuItem>}
                {job.publicPath && <><DropdownMenuItem onClick={() => window.open(job.publicPath!, '_blank', 'noopener,noreferrer')}><ExternalLink />საიტზე ნახვა</DropdownMenuItem><DropdownMenuItem onClick={async () => { try { await navigator.clipboard.writeText(new URL(job.publicPath!, window.location.origin).href); onNotice('ბმული დაკოპირდა'); } catch { onError('ბმულის კოპირება ვერ მოხერხდა'); } }}><Copy />ბმულის კოპირება</DropdownMenuItem></>}
                {canPromote && <DropdownMenuItem render={<Link href={`/company/jobs/${job.id}/promote`} />}><ArrowUpRight aria-hidden="true" size={16} />წინ წამოწევა</DropdownMenuItem>}
                {canEdit && !closed && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onClose(job)}
                  >
                    <Archive />
                     ვაკანსიის დახურვა </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>}
      </div>
    </div>
  );
}
