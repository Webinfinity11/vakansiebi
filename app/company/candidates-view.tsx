'use client';
import { validCandidateEmail, validCandidatePhone } from '@/lib/company-candidate-contact';
import { StatusMark } from './status-mark';
import { SelectField } from '../select-field';
import { defaultTemplates, render, templateKinds, templateLabels, validTemplate, type MessageTemplates, type TemplateKey } from '@/lib/company-message-templates';
import { TemplateFields, TemplatePreview } from './message-templates';
import { parseNotice } from '@/lib/company-talent-filters';
import { companyHref, plainClick } from '@/lib/company-portal-navigation';
import { CandidateAnswers, CandidateSignals } from './candidate-answers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Mail,
  Phone,
  Download,
  ExternalLink,
  Star,
  ArrowLeft,
  ArrowRight,
  List,
  Columns3,
  Table2,
  Copy,
  Check,
  FileX,
  Send,
  Undo2,
  X,
  RotateCcw,
  GripVertical,
  MessageSquare,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Pencil,
  Plus,
  Briefcase,
  Database,
  Upload,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  candidateStages,
  candidatePhone,
  educationLabels,
  educationLevels,
  languageLevels,
  type CandidateProfile,
  type CandidateProfileEdit,
  type EducationLevel,
  personKey,
  stageLabels,
  type Candidate,
  type CandidateNote,
  type CandidateStage,
} from '@/lib/company-candidates';
import {
  companyRequest as request,
  timeAgo,
  formatDate,
  type CompanyJob,
} from './company-api';
import { Avatar } from './avatar';
import { CvViewer } from './cv-viewer';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import './candidates.css';

const pipeline: CandidateStage[] = candidateStages.filter(
  (s) => s !== 'rejected',
);
const nextStage = (s: CandidateStage) =>
  s === 'rejected' ? null : (pipeline[pipeline.indexOf(s) + 1] ?? null);
const prevStage = (s: CandidateStage) =>
  s === 'rejected' ? 'review' : (pipeline[pipeline.indexOf(s) - 1] ?? null);
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
const dragType = 'application/x-jobx-candidates';

type Undo = {
  label: string;
  before: { entry: string; stage: CandidateStage }[];
  rejection?: string[];
};

export function CandidatesView({
  canEdit,
  companyName,
  candidates,
  jobs,
  loaded,
  selected,
  onSelect,
  onRemoved,
  onPatch,
  onReveal,
  onError,
  initialFilter,
  sheetOnly = false,
  onAdd,
  onGo,
}: {
  /** Opens the CV upload: a CV from elsewhere becomes a candidate at once. */
  onAdd?: () => void;
  /** The other ways candidates arrive: a vacancy, or the JOBX CV base. */
  onGo?: (place: 'job' | 'talent') => void;
  initialFilter?: { jobId?: string; stage?: CandidateStage };
  /** Only the selected person's details, in a side sheet over another view (the CV base). */
  sheetOnly?: boolean;
  canEdit: boolean;
  companyName: string;
  candidates: Candidate[];
  jobs: CompanyJob[];
  loaded: boolean;
  selected: string | null;
  onSelect: (entry: string | null) => void;
  onRemoved: (entry: string) => void;
  onPatch: (entries: string[], patch: Partial<Candidate>) => void;
  onReveal: (entry: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [savedView, setViewState] = useState<'list' | 'board' | 'table'>('list');
  const [wide, setWide] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const view = savedView === 'table' && !wide ? 'list' : savedView;
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState<{ key: 'date' | 'stage'; ascending: boolean }>({ key: 'date', ascending: false });
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const split = window.matchMedia('(min-width: 901px)');
    const update = () => { setWide(media.matches); setDesktop(split.matches); };
    update(); media.addEventListener('change', update); split.addEventListener('change', update);
    return () => { media.removeEventListener('change', update); split.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    if (!initialFilter) return;
    setJob(initialFilter.jobId ?? 'all');
    setStage(initialFilter.stage ?? 'all');
    setSource('all'); setQuery(''); setOnlyMatching(false); setPicked([]);
    onSelect(null);
  }, [initialFilter]);
  const [stage, setStage] = useState<CandidateStage | 'all'>('all');
  const [job, setJob] = useState('all');
  const [onlyMatching, setOnlyMatching] = useState(false);
  const [query, setQuery] = useState('');
  const clearFilters = () => {
    setQuery(''); setJob('all'); setSource('all'); setOnlyMatching(false); setStage('all');
  };
  const clearFiltersButton = <button type="button" className="cp-btn cp-btn--ghost" onClick={clearFilters}>ფილტრების გასუფთავება</button>;
  const [picked, setPicked] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string[] | null>(null);
  const moving = useRef(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const [composer, setComposer] = useState<{
    entries: string[];
    template: TemplateKey;
    channel: Channel;
  } | null>(null);
  // The chosen view is remembered on this device.
  useEffect(() => {
    const saved = localStorage.getItem('jobx-company-candidates-view');
    if (saved === 'board' || saved === 'list' || saved === 'table') setViewState(saved);
  }, []);
  const setView = (v: 'list' | 'board' | 'table') => {
    setViewState(v);
    localStorage.setItem('jobx-company-candidates-view', v);
  };
  const byJob = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        (job === 'all' ||
          c.jobId === job ||
          (job === 'cv_box' && c.source === 'cv_box')) &&
        (source === 'all' || (source === 'applied' ? ['swipe', 'resume'].includes(c.source) : c.source === source)) &&
        (!onlyMatching || c.requirementsMatch === true) &&
        (!q ||
          [c.name, c.title, c.email, c.jobTitle].some((v) =>
            v.toLowerCase().includes(q),
          )),
    );
  }, [candidates, job, query, onlyMatching, source]);
  const counts = useMemo(() => {
    const out: Record<string, number> = { all: byJob.length };
    for (const s of candidateStages)
      out[s] = byJob.filter((c) => c.stage === s).length;
    return out;
  }, [byJob]);
  const visible = useMemo(
    () => byJob.filter((c) => stage === 'all' || c.stage === stage).sort((a, b) => {
      const difference = sort.key === 'date' ? Date.parse(a.appliedAt) - Date.parse(b.appliedAt)
        : candidateStages.indexOf(a.stage) - candidateStages.indexOf(b.stage);
      return (sort.ascending ? difference : -difference) || a.entry.localeCompare(b.entry);
    }),
    [byJob, stage, sort],
  );
  useEffect(() => {
    if (!sheetOnly && desktop && view === 'list' && visible.length > 0 && !visible.some((c) => c.entry === selected))
      onSelect(visible[0]?.entry ?? null);
  }, [sheetOnly, desktop, view, visible, selected, onSelect]);
  useEffect(() => { setPicked([]); }, [job, stage, source, query, onlyMatching, canEdit]);
  const sourceLabel = (c: Candidate) => c.source === 'upload' ? 'თქვენ მიერ ატვირთული' : c.source === 'cv_box' ? 'CV ყუთი' : c.source === 'base' ? 'JOBX-ის CV ბაზიდან' : 'ვაკანსიაზე გამოგზავნილი';
  const togglePick = (entry: string) => setPicked((all) => all.includes(entry) ? all.filter((id) => id !== entry) : [...all, entry]);
  const toggleSort = (key: 'date' | 'stage') => setSort((previous) => ({ key, ascending: previous.key === key ? !previous.ascending : true }));
  const photos = useMemo(() => {
    const out = new Map<string, string>();
    for (const c of candidates)
      if (c.photo && !out.has(personKey(c))) out.set(personKey(c), c.entry);
    return out;
  }, [candidates]);
  const face = (c: Candidate) => {
    const entry = photos.get(personKey(c));
    return { name: c.name, entry: entry ?? c.entry, photo: !!entry };
  };
  const current = candidates.find((c) => c.entry === selected) ?? null;
  const peeked = candidates.find((c) => c.entry === peek) ?? null;
  const jobOptions = useMemo(() => {
    const ids = new Set(candidates.map((c) => c.jobId).filter(Boolean));
    return jobs.filter((j) => ids.has(j.id));
  }, [candidates, jobs]);

  const move = useCallback(
    async (entries: string[], next: CandidateStage, remember = true) => {
      if (!canEdit || moving.current) return;
      if (entries.length > 200) { onError('ერთდროულად მაქსიმუმ 200 კანდიდატი მონიშნეთ.'); return; }
      const before = candidates
        .filter((c) => entries.includes(c.entry) && c.stage !== next)
        .map((c) => ({ entry: c.entry, stage: c.stage, hiredAt: c.hiredAt, seen: c.seen, name: c.name }));
      if (!before.length) return;
      moving.current = true;
      onPatch(
        before.map((b) => b.entry),
        { stage: next, seen: true },
      );
      if (remember)
        setUndo({
          label:
            before.length === 1
              ? `${before[0].name} → ${stageLabels[next]}`
              : `${before.length} კანდიდატი → ${stageLabels[next]}`,
          before,
          rejection:
            next === 'rejected' ? before.map((b) => b.entry) : undefined,
        });
      try {
        const result = await request('candidates', {
          action: 'stage',
          entries: before.map((b) => b.entry),
          stage: next,
        });
        for (const candidate of result.candidates) onPatch([candidate.entry], { hiredAt: candidate.hiredAt });
      } catch (e) {
        for (const b of before) onPatch([b.entry], { stage: b.stage, hiredAt: b.hiredAt, seen: b.seen });
        setUndo(null);
        onError(e instanceof Error ? e.message : 'ვერ შეინახა');
      } finally { moving.current = false; }
    },
    [canEdit, candidates, onPatch, onError],
  );
  async function revert() {
    if (!undo || moving.current) return;
    const groups = new Map<CandidateStage, string[]>();
    for (const b of undo.before)
      groups.set(b.stage, [...(groups.get(b.stage) ?? []), b.entry]);
    setUndo(null);
    for (const [s, entries] of groups) await move(entries, s, false);
  }
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      undo.rejection ? 20000 : 7000,
    );
    return () => clearTimeout(timer);
  }, [undo]);

  // Opening a candidate marks it seen.
  const open = current ?? peeked;
  useEffect(() => {
    if (!canEdit || !open || open.seen) return;
    onPatch([open.entry], { seen: true });
    void request('candidates', { action: 'seen', entry: open.entry }).catch(
      () => {},
    );
  }, [canEdit, open, onPatch]);

  // Keyboard: J/K walk the list, → and ← move a stage, X rejects, Z undoes.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (sheetOnly || composer || document.querySelector('[data-slot="dialog-content"]'))
        return;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        typing(event.target)
      )
        return;
      const target = view === 'list' ? current : peeked;
      if (event.key === 'z' && undo) {
        event.preventDefault();
        void revert();
        return;
      }
      if (canEdit && target) {
        const to =
          event.key === 'ArrowRight'
            ? nextStage(target.stage)
            : event.key === 'ArrowLeft'
              ? prevStage(target.stage)
              : event.key === 'x'
                ? 'rejected'
                : null;
        if (to) {
          event.preventDefault();
          void move([target.entry], to);
          return;
        }
      }
      if (view !== 'list' || !visible.length) return;
      const step =
        event.key === 'j' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'k' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (!step) return;
      event.preventDefault();
      const at = visible.findIndex((c) => c.entry === selected);
      const next =
        visible[Math.max(0, Math.min(visible.length - 1, at + step))];
      onSelect(next.entry);
      document
        .querySelector(`[data-entry="${CSS.escape(next.entry)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function startDrag(e: React.DragEvent, entry: string) {
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    const entries = picked.includes(entry) ? picked : [entry];
    e.dataTransfer.setData(dragType, JSON.stringify(entries));
    e.dataTransfer.setData('text/plain', entries.join('\n'));
    e.dataTransfer.effectAllowed = 'move';
    setDragging(entries);
  }
  function dropOn(e: React.DragEvent, s: CandidateStage) {
    if (!canEdit) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData(dragType);
    setDragging(null);
    if (!raw) return;
    const entries: string[] = JSON.parse(raw);
    void move(entries, s);
    setPicked((p) => p.filter((x) => !entries.includes(x)));
  }

  const fresh = candidates.filter((c) => !c.seen).length;
  const detailProps = (c: Candidate) => ({
    candidate: c,
    canEdit,
    face: face(c),
    others: candidates.filter(
      (o) => o.entry !== c.entry && personKey(o) === personKey(c),
    ),
    onMove: (next: CandidateStage) => void move([c.entry], next),
    onRemoved: (entry: string) => {
      setPicked((entries) => entries.filter((value) => value !== entry));
      setPeek((value) => (value === entry ? null : value));
      setUndo(null);
      onRemoved(entry);
    },
    onPatch,
    onReveal,
    onError,
    onCompose: (channel: Channel, template: TemplateKey = 'received') =>
      setComposer({ entries: [c.entry], template, channel }),
  });
  const overlays = (
    <>
      {composer && (
        <MessageComposer
          candidates={candidates.filter((c) =>
            composer.entries.includes(c.entry),
          )}
          companyName={companyName}
          initialTemplate={composer.template}
          initialChannel={composer.channel}
          onClose={() => setComposer(null)}
        />
      )}
      {undo && !composer && (
        <div className="cc-undo" role="status">
          <span>{undo.label}</span>
          {undo.rejection && (
            <button
              type="button"
              onClick={() =>
                setComposer({
                  entries: undo.rejection!,
                  template: 'rejected',
                  channel: 'email',
                })
              }
            >
               გავუგზავნოთ უარის წერილი? </button>
          )}
          <button type="button" onClick={() => void revert()}>
            <Undo2 size={14} />
             დაბრუნება </button>
          <button
            type="button"
            className="cc-undo-close"
            aria-label="დახურვა"
            onClick={() => setUndo(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
  if (sheetOnly)
    return (
      <div className="cc cc--sheet-only">
        <Sheet
          open={!!current}
          onOpenChange={(o) => {
            if (!o) onSelect(null);
          }}
        >
          <SheetContent side="right" className="cc-sheet" closeLabel="დახურვა">
            <SheetTitle className="sr-only">{current?.name ?? ''}</SheetTitle>
            <SheetDescription className="sr-only">
              კანდიდატის დეტალები
            </SheetDescription>
            {current && (
              <Detail key={current.entry} {...detailProps(current)} onOpen={onSelect} />
            )}
          </SheetContent>
        </Sheet>
        {overlays}
      </div>
    );
  return (
    <div
      className="cc"
      data-picked={canEdit && picked.length > 0 ? "" : undefined}
      data-detail={current && view === 'list' ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      onDragEnd={() => setDragging(null)}
    >
      <header className="cp-head cc-head">
        <div className="cp-head-title">
          <h1>კანდიდატები</h1>
          {loaded && <span>{candidates.length}</span>}
          {fresh > 0 && <em className="cc-fresh">{fresh}  ახალი</em>}
        </div>
        <div className="cp-head-actions">
          {canEdit && onAdd && (
            <button type="button" className="cp-btn cp-btn--primary" onClick={onAdd}>
              <Plus size={15} />
              კანდიდატის დამატება
            </button>
          )}
          {candidates.length > 0 && (<>
          <button
            type="button"
            className={`cp-btn ${onAdd ? 'cp-btn--ghost' : !peek && !composer && !picked.length && (view !== 'list' || !current || !nextStage(current.stage)) ? 'cp-btn--primary' : 'cp-btn--ghost'}`}
            disabled={!visible.length}
            onClick={() => exportCandidates(visible)}
          >
            <Download size={15} />
            CSV
          </button>
          <label className="cp-search cc-search">
            <Search size={15} />
            <input
              type="search"
              aria-label="კანდიდატის ძიება"
              placeholder="სახელი, პოზიცია, ელფოსტა"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="cc-filter-controls">
          <DropdownMenu>
            <DropdownMenuTrigger className="cp-btn cp-btn--ghost cc-job-filter">
              {job === 'cv_box'
                ? 'CV ყუთი'
                : job === 'all'
                  ? 'ყველა ვაკანსია'
                  : (jobs.find((j) => j.id === job)?.title ?? 'ვაკანსია')}
              <ChevronDown size={14} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-64">
              <DropdownMenuItem onClick={() => setJob('all')}>
                 ყველა ვაკანსია </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setJob('cv_box')}>
                 CV ყუთი </DropdownMenuItem>
              {jobOptions.map((j) => (
                <DropdownMenuItem key={j.id} onClick={() => setJob(j.id)}>
                  {j.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="cp-btn cp-btn--ghost cc-matching-filter"
            aria-pressed={onlyMatching}
            onClick={() => setOnlyMatching((value) => !value)}
          >
             ემთხვევა მოთხოვნებს </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="cp-btn cp-btn--ghost" aria-label="წყარო">
              {source === 'all' ? 'წყარო' : source === 'applied' ? 'ვაკანსიაზე გამოგზავნილი' : source === 'upload' ? 'თქვენ მიერ ატვირთული' : 'CV ყუთი'}
              <ChevronDown size={14} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries({ all: 'ყველა წყარო', applied: 'ვაკანსიაზე გამოგზავნილი', upload: 'თქვენ მიერ ატვირთული', cv_box: 'CV ყუთი' }).map(([key, label]) => <DropdownMenuItem key={key} onClick={() => setSource(key)}>{label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="cc-switch" role="group" aria-label="ხედი">
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={15} />
               სია </button>
            <button
              type="button"
              aria-pressed={view === 'board'}
              onClick={() => setView('board')}
            >
              <Columns3 size={15} />
               დაფა </button>
            {wide && <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={15} />ცხრილი</button>}
          </div>
          </div>
          </>)}
        </div>
      </header>

      {!loaded ? (
        <div className="cc-empty">იტვირთება…</div>
      ) : !candidates.length ? (
        <div className="cp-empty cc-start">
          <h2>ჯერ კანდიდატი არ გყავთ</h2>
          <p>კანდიდატი აქ სამი გზით ჩნდება:</p>
          <ol className="cc-start-ways">
            <li>
              <Briefcase size={20} />
              <strong>ვაკანსიაზე განაცხადი</strong>
              <span>ვაკანსიაზე გამოგზავნილი CV აქ თავისით შემოვა.</span>
              {canEdit && onGo && (
                <button type="button" className="cp-btn cp-btn--secondary" onClick={() => onGo('job')}>
                  {jobs.length ? 'ვაკანსიების ნახვა' : 'ვაკანსიის დამატება'}
                </button>
              )}
            </li>
            <li>
              <Database size={20} />
              <strong>JOBX-ის CV ბაზა</strong>
              <span>მოძებნეთ ადამიანი და დაამატეთ ეტაპზე.</span>
              {onGo && (
                <button type="button" className="cp-btn cp-btn--secondary" onClick={() => onGo('talent')}>
                  CV ბაზის გახსნა
                </button>
              )}
            </li>
            <li>
              <Upload size={20} />
              <strong>საკუთარი CV</strong>
              <span>ფოსტით ან სხვაგან მიღებული CV ატვირთეთ.</span>
              {canEdit && onAdd && (
                <button type="button" className="cp-btn cp-btn--primary" onClick={onAdd}>
                  CV-ის ატვირთვა
                </button>
              )}
            </li>
          </ol>
        </div>
      ) : view === 'board' ? (
        <>
        {!visible.length && <div className="cc-empty">ამ ფილტრით კანდიდატი არ არის.{clearFiltersButton}</div>}
        <Board
          canEdit={canEdit}
          candidates={visible}
          dragging={dragging}
          face={face}
          onDragStart={startDrag}
          onDrop={dropOn}
          onOpen={setPeek}
          onMove={(entry, next) => void move([entry], next)}
        />
        </>
      ) : (
        <>
          <StageFlow
            counts={counts}
            stage={stage}
            dragging={dragging}
            onPick={setStage}
            onDrop={dropOn}
          />
          {view === 'table' ? (
            <div className="cc-table-wrap">
              <table className="cc-table">
                <thead><tr>
                  {canEdit && <th className="cc-table-check" aria-label="მონიშვნა" />}
                  <th>სახელი</th><th>ვაკანსია</th>
                  <th aria-sort={sort.key === 'stage' ? (sort.ascending ? 'ascending' : 'descending') : 'none'}><button onClick={() => toggleSort('stage')}>ეტაპი {sort.key === 'stage' ? sort.ascending ? '↑' : '↓' : ''}</button></th>
                  <th>შეფასება</th><th>წყარო</th>
                  <th aria-sort={sort.key === 'date' ? (sort.ascending ? 'ascending' : 'descending') : 'none'}><button onClick={() => toggleSort('date')}>თარიღი {sort.key === 'date' ? sort.ascending ? '↑' : '↓' : ''}</button></th>
                  <th>შენიშვნები</th>
                </tr></thead>
                <tbody>{visible.map((c) => <tr key={c.entry} onClick={() => { onSelect(c.entry); setView('list'); }}>
                  {canEdit && <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={picked.includes(c.entry)} aria-label={`მონიშვნა: ${c.name}`} onChange={() => togglePick(c.entry)} /></td>}
                  <td><button className="cc-table-name" onClick={(event) => { event.stopPropagation(); onSelect(c.entry); setView('list'); }}>{c.name}</button>
                    <span className="cc-table-contact">
                      {c.email && <a href={`mailto:${c.email}`} aria-label={`ელფოსტა: ${c.name}`} onClick={(event) => event.stopPropagation()}><Mail size={14} /><span>ელფოსტა</span></a>}
                      {c.phone && <a href={`tel:${candidatePhone(c.phone)}`} aria-label={`დარეკვა: ${c.name}`} onClick={(event) => event.stopPropagation()}><Phone size={14} /><span>დარეკვა</span></a>}
                    </span>
                  </td>
                  <td>{c.jobTitle || '—'}</td><td><StatusMark kind={c.stage} data-stage={c.stage}>{stageLabels[c.stage]}</StatusMark></td>
                  <td>{c.rating ?? '—'}</td><td>{sourceLabel(c)}</td><td><time dateTime={c.appliedAt}>{formatDate(c.appliedAt)}</time></td><td>{c.notes}</td>
                </tr>)}</tbody>
              </table>
              {!visible.length && <div className="cc-empty">ამ ფილტრით კანდიდატი არ არის.{clearFiltersButton}</div>}
            </div>
          ) : <div className="cc-split">
            <div className="cc-list-wrap">
              {!visible.length ? (
                <div className="cc-empty">
                  {stage === 'all'
                    ? 'ამ ფილტრით კანდიდატი არ არის.'
                    : `„${stageLabels[stage]}“ ეტაპზე ჯერ არავინაა.${canEdit ? ' გადმოათრიეთ კანდიდატი ზედა ზოლზე.' : ''}`}
                  {clearFiltersButton}
                </div>
              ) : (
                <ul className="cc-list" aria-label="კანდიდატების სია">
                  {visible.map((c) => (
                    <li
                      key={c.entry}
                      data-entry={c.entry}
                      data-stage={c.stage}
                      aria-current={c.entry === selected || undefined}
                      data-unseen={!c.seen || undefined}
                      data-dragged={dragging?.includes(c.entry) || undefined}
                      draggable={canEdit}
                      onDragStart={(e) => startDrag(e, c.entry)}
                    >
                      {canEdit && (
                        <input
                          type="checkbox"
                          aria-label={`მონიშვნა: ${c.name}`}
                          checked={picked.includes(c.entry)}
                          onChange={(e) =>
                            setPicked((p) =>
                              e.target.checked
                                ? [...p, c.entry]
                                : p.filter((x) => x !== c.entry),
                            )
                          }
                        />
                      )}
                      <a
                        href={companyHref({ tab: 'candidates', entry: c.entry })}
                        onClick={(event) => {
                          if (!plainClick(event)) return;
                          event.preventDefault();
                          onSelect(c.entry);
                        }}
                      >
                        <Avatar {...face(c)} />
                        <span className="cc-item">
                          <span className="cc-item-top">
                            <strong>{c.name}</strong>
                            <time dateTime={c.appliedAt}>
                              {timeAgo(c.appliedAt)}
                            </time>
                          </span>
                          <span className="cc-item-sub">
                            {c.jobTitle || c.title}
                          </span>
                          <span className="cc-item-meta">
                            <StatusMark kind={c.stage} data-stage={c.stage}>
                              {stageLabels[c.stage]}
                            </StatusMark>
                            <InterviewBadge candidate={c} />
                            <CandidateSignals candidate={c} />
                            {c.rating && (
                              <span className="cc-mini-rating">
                                <Star size={11} /> {c.rating}
                              </span>
                            )}
                            {c.notes > 0 && (
                              <span className="cc-mini-notes">
                                <MessageSquare size={11} /> {c.notes}
                              </span>
                            )}
                          </span>
                        </span>
                      </a>
                      {canEdit && <GripVertical size={14} className="cc-grip" aria-hidden />}
                    </li>
                  ))}
                </ul>
              )}
              <p className="cc-keys">
                <kbd>J</kbd>
                <kbd>K</kbd>  კანდიდატები {canEdit && <> · <kbd>→</kbd>  შემდეგი ეტაპი · <kbd>X</kbd>  უარი</>}
              </p>
            </div>
            {current ? (
              <Detail
                key={current.entry}
                {...detailProps(current)}
                onBack={() => onSelect(null)}
                onOpen={onSelect}
              />
            ) : (
              <div className="cc-detail cc-detail--empty">
                <p>
                   აირჩიეთ კანდიდატი სიიდან. {canEdit && " ეტაპის შესაცვლელად კანდიდატი ზედა ზოლზე გადაათრიეთ."}
                </p>
              </div>
            )}
          </div>}
        </>
      )}

              {canEdit && picked.length > 0 && !composer && (
                <div className="cc-bulk">
                  <span aria-label={`არჩეულია ${picked.length}`}><span className="cc-bulk-label">არჩეულია </span>{picked.length}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="cp-btn cp-btn--primary cp-btn--sm" aria-label="ეტაპის შეცვლა">
                      <ArrowRight size={16} /><span className="cc-bulk-label">ეტაპის შეცვლა</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {pipeline.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => {
                            void move(picked, s);
                            setPicked([]);
                          }}
                        >
                          <StatusMark kind={s} data-stage={s}>{stageLabels[s]}</StatusMark>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    className="cp-btn cp-btn--sm cc-reject"
                    aria-label="უარი"
                    onClick={() => {
                      void move(picked, 'rejected');
                      setPicked([]);
                    }}
                  >
                    <X size={16} /><span className="cc-bulk-label">უარი</span>
                  </button>
                  <button type="button" className="cp-btn cp-btn--ghost cp-btn--sm" aria-label="წერილი" onClick={() => { if (picked.length > 200) { onError('ერთდროულად მაქსიმუმ 200 კანდიდატი მონიშნეთ.'); return; } setComposer({ entries: picked, template: 'received', channel: 'email' }); }}><Mail size={16} /><span className="cc-bulk-label">წერილი</span></button>
                  <button type="button" className="cp-btn cp-btn--ghost cp-btn--sm" aria-label="ექსპორტი" onClick={() => exportCandidates(candidates.filter((c) => picked.includes(c.entry)))}><Download size={16} /><span className="cc-bulk-label">ექსპორტი</span></button>
                  <button
                    type="button"
                    className="cp-icon-btn"
                    aria-label="მონიშვნის მოხსნა"
                    onClick={() => setPicked([])}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
      <Sheet
        open={!!peeked && view === 'board'}
        onOpenChange={(o) => {
          if (!o) setPeek(null);
        }}
      >
        <SheetContent side="right" className="cc-sheet" closeLabel="დახურვა">
          <SheetTitle className="sr-only">{peeked?.name ?? ''}</SheetTitle>
          <SheetDescription className="sr-only">
             კანდიდატის დეტალები </SheetDescription>
          {peeked && (
            <Detail
              key={peeked.entry}
              {...detailProps(peeked)}
              onOpen={setPeek}
            />
          )}
        </SheetContent>
      </Sheet>

      {overlays}
    </div>
  );
}

/* The stages as one coloured strip: a filter when clicked, a target when a candidate is
   dragged onto it. */
function StageFlow({
  counts,
  stage,
  dragging,
  onPick,
  onDrop,
}: {
  counts: Record<string, number>;
  stage: CandidateStage | 'all';
  dragging: string[] | null;
  onPick: (s: CandidateStage | 'all') => void;
  onDrop: (e: React.DragEvent, s: CandidateStage) => void;
}) {
  const [over, setOver] = useState<CandidateStage | null>(null);
  return (
    <div className="cc-flow" role="group" aria-label="ეტაპები">
      <button
        type="button"
        className="cc-flow-all"
        aria-pressed={stage === 'all'}
        onClick={() => onPick('all')}
      >
        <StatusMark kind="all">ყველა</StatusMark>
        <strong>{counts.all}</strong>
      </button>
      {candidateStages.map((s) => (
        <button
          key={s}
          type="button"
          className="cc-flow-step"
          data-stage={s}
          aria-pressed={stage === s}
          data-over={over === s || undefined}
          onClick={() => onPick(s)}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setOver(s);
          }}
          onDragLeave={() => setOver((o) => (o === s ? null : o))}
          onDrop={(e) => {
            setOver(null);
            onDrop(e, s);
          }}
        >
          <StatusMark kind={s}>{stageLabels[s]}</StatusMark>
          <strong>{counts[s]}</strong>
          {dragging && <em>ჩააგდეთ აქ</em>}
        </button>
      ))}
    </div>
  );
}

function Detail({
  canEdit,
  onCompose,
  onRemoved,
  candidate: c,
  face,
  others,
  onBack,
  onOpen,
  onMove,
  onPatch,
  onReveal,
  onError,
}: {
  canEdit: boolean;
  onCompose: (channel: Channel, template?: TemplateKey) => void;
  onRemoved: (entry: string) => void;
  candidate: Candidate;
  face: { name: string; entry: string; photo: boolean };
  others: Candidate[];
  onBack?: () => void;
  onOpen: (entry: string) => void;
  onMove: (stage: CandidateStage) => void;
  onPatch: (entries: string[], patch: Partial<Candidate>) => void;
  onReveal: (entry: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<'cv' | 'notes'>('cv');
  // Opening a CV base person shows their CV, contacts included: it is one logged view.
  const hidden = !!c.contactHidden;
  useEffect(() => {
    if (hidden) void onReveal(c.entry);
  }, [c.entry, hidden, onReveal]);
  const [notes, setNotes] = useState<CandidateNote[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editing, setEditing] = useState(false);
  const cvUrl = `/api/company/candidates/cv?entry=${encodeURIComponent(c.entry)}`;
  useEffect(() => {
    let live = true;
    void request('candidates?entry=' + encodeURIComponent(c.entry))
      .then((n) => live && setNotes(n))
      .catch(() => live && setNotes([]));
    return () => {
      live = false;
    };
  }, [c.entry]);
  async function rate(value: number) {
    if (!canEdit) return;
    const next = c.rating === value ? null : value;
    onPatch([c.entry], { rating: next });
    try {
      await request('candidates', {
        action: 'rate',
        entry: c.entry,
        rating: next,
      });
    } catch (e) {
      onPatch([c.entry], { rating: c.rating });
      onError(e instanceof Error ? e.message : 'ვერ შეინახა');
    }
  }
  async function addNote() {
    if (!canEdit || !draft.trim()) return;
    setSending(true);
    try {
      const list = await request('candidates', {
        action: 'note',
        entry: c.entry,
        body: draft,
      });
      setNotes(list);
      setDraft('');
      onPatch([c.entry], { notes: list.length });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'ვერ შეინახა');
    } finally {
      setSending(false);
    }
  }
  function copy(value: string) {
    void navigator.clipboard?.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(''), 1500);
  }
  const at = pipeline.indexOf(c.stage);
  const next = nextStage(c.stage);
  const rejected = c.stage === 'rejected';
  const years = c.profile?.years;
  const moreItems = (
    <>
      {c.hasCv && (
        <>
          <DropdownMenuItem
            render={<a href={cvUrl} target="_blank" rel="noopener" />}
          >
            <ExternalLink size={15} />
             CV ახალ ფანჯარაში </DropdownMenuItem>
          <DropdownMenuItem render={<a href={cvUrl + '&download=1'} />}>
            <Download size={15} />
             CV-ის ჩამოტვირთვა </DropdownMenuItem>
        </>
      )}
      {c.email && (
        <DropdownMenuItem onClick={() => copy(c.email)}>
          <Copy size={15} />
           ელფოსტის კოპირება </DropdownMenuItem>
      )}
      {c.phone && (
        <DropdownMenuItem onClick={() => copy(c.phone)}>
          <Copy size={15} />
           ტელეფონის კოპირება </DropdownMenuItem>
      )}
      {canEdit && ['upload', 'cv_box'].includes(c.source) && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={15} />
             ატვირთული CV-ის წაშლა </DropdownMenuItem>
        </>
      )}
    </>
  );
  return (
    <section className="cc-detail" aria-label={c.name} data-stage={c.stage}>
      {onBack && (
        <button type="button" className="cc-back" onClick={onBack}>
          <ArrowLeft size={16} />
           სია </button>
      )}
      <header className="cc-person">
        <Avatar {...face} size="lg" />
        <div>
          <h2>{c.name}</h2>
          <p>
            {[
              c.profile?.roles[0]?.split(' — ')[0] || c.title,
              c.profile?.city || c.city,
              years != null
                ? `${years < 1 ? '<1' : years} წლის გამოცდილება`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="cp-subtle">
            {c.jobTitle || 'ვაკანსიის გარეშე'} · {timeAgo(c.appliedAt)}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
            {c.email && (
              <a
                className="cp-icon-btn"
                href={`mailto:${c.email}`}
                title={c.email}
                aria-label="ელფოსტის გაგზავნა"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Mail size={16} /><span>ელფოსტა</span>
              </a>
            )}
            {c.phone && (
              <a
                className="cp-icon-btn"
                href={`tel:${candidatePhone(c.phone)}`}
                title={c.phone}
                aria-label="დარეკვა"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Phone size={16} /><span>დარეკვა</span>
              </a>
            )}
            {canEdit && (
              <button
                type="button"
                className="cc-edit-link"
                onClick={() => setEditing(true)}
              >
                <Pencil size={13} />
                 მონაცემების შესწორება </button>
            )}
          </div>
        </div>
        {canEdit ? (
          <div className="cc-rating" role="group" aria-label="შეფასება">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} ვარსკვლავი`}
                aria-pressed={(c.rating ?? 0) >= n}
                onClick={() => void rate(n)}
              >
                <Star size={16} />
              </button>
            ))}
          </div>
        ) : (
          <span className="cc-mini-rating" aria-label={`შეფასება: ${c.rating ?? 0} / 5`}>
            <Star size={16} /> {c.rating ?? "—"}
          </span>
        )}
      </header>

      <div className="cc-toolbar" role="toolbar" aria-label="მოქმედებები">
        {!canEdit ? (
          <StatusMark kind={c.stage} data-stage={c.stage}>{stageLabels[c.stage]}</StatusMark>
        ) : rejected ? (
          <>
            <StatusMark kind="rejected" data-stage="rejected">
               უარი ეთქვა </StatusMark>
            <button
              type="button"
              className="cp-btn"
              onClick={() => onMove('review')}
            >
              <RotateCcw size={15} />
               აღდგენა </button>
          </>
        ) : (
          <span className="cc-stagebtn" data-stage={next ?? 'hired'}>
            {next ? (
              <button
                type="button"
                className="cp-btn cp-btn--primary cc-advance"
                data-stage={next}
                onClick={() => onMove(next)}
              >
                 შემდეგი: {stageLabels[next]}
                <ArrowRight size={15} />
              </button>
            ) : (
              <StatusMark kind="hired" data-stage="hired">
                 აყვანილია </StatusMark>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="cp-btn cp-btn--ghost cc-stagebtn-more"
                aria-label="სხვა ეტაპზე გადაყვანა"
              >
                <ChevronDown size={15} /><span>ეტაპი</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-52">
                {pipeline.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    disabled={s === c.stage}
                    onClick={() => onMove(s)}
                  >
                    <StatusMark kind={s} data-stage={s}>{stageLabels[s]}</StatusMark>
                    {s === c.stage && (
                      <span className="cc-menu-note">ახლა</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
        {canEdit && !rejected && (
          <button
            type="button"
            className="cp-btn cp-btn--ghost cc-reject"
            onClick={() => onMove('rejected')}
          >
            <X size={15} />
             უარი </button>
        )}
        <span className="cc-toolbar-gap" />
        <DropdownMenu>
          <DropdownMenuTrigger className="cp-btn cp-btn--ghost">
            <MessageSquare size={15} />
             მიწერა <ChevronDown size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {rejected && (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    onCompose(
                      c.email
                        ? 'email'
                        : candidatePhone(c.phone)
                          ? 'whatsapp'
                          : 'copy',
                      'rejected',
                    )
                  }
                >
                  <Send size={15} />
                   უარის წერილი </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {c.email && (
              <DropdownMenuItem onClick={() => onCompose('email')}>
                <Mail size={15} />
                 ელფოსტა </DropdownMenuItem>
            )}
            {candidatePhone(c.phone) && (
              <>
                <DropdownMenuItem onClick={() => onCompose('whatsapp')}>
                  <MessageSquare size={15} />
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCompose('viber')}>
                  <MessageSquare size={15} />
                  Viber
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => onCompose('copy')}>
              <Copy size={15} />
               ტექსტის მომზადება და კოპირება </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="cp-icon-btn"
            aria-label="მეტი მოქმედება"
          >
            <MoreHorizontal size={17} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {moreItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {copied && (
        <p className="cc-copied" role="status">
          <Check size={14} />  დაკოპირდა: {copied}
        </p>
      )}
      <div className="cc-progress" aria-hidden>
        {pipeline.map((s, i) => (
          <i
            key={s}
            data-stage={s}
            data-done={!rejected && i <= at ? '' : undefined}
          />
        ))}
      </div>

      <ProfileEditor
        open={canEdit && editing}
        candidate={c}
        onClose={() => setEditing(false)}
        onSaved={(profile, contact) => {
          setEditing(false);
          onPatch([c.entry], { profile, ...contact });
        }}
        onError={onError}
      />

      <Dialog
        open={canEdit && deleting}
        onOpenChange={(o) => {
          if (!deleteBusy) setDeleting(o);
        }}
      >
        <DialogContent className="cp-dialog cc-compose">
          <DialogTitle>წავშალოთ ატვირთული CV?</DialogTitle>
          <DialogDescription>
            {c.name}  — ფაილი, შენიშვნები და ამ ჩანაწერის შეფასება წაიშლება. აღდგენა შეუძლებელია. </DialogDescription>
          <p role="alert">{deleteError}</p>
          <div className="cc-message-actions">
            <button
              type="button"
              className="cp-btn cp-btn--ghost"
              disabled={deleteBusy}
              onClick={() => setDeleting(false)}
            >
               გაუქმება </button>
            <button
              type="button"
              className="cp-btn cp-btn--primary"
              disabled={deleteBusy}
              onClick={async () => {
                if (!canEdit) return;
                setDeleteBusy(true);
                setDeleteError('');
                try {
                  await request('candidates', {
                    action: 'deleteUpload',
                    entry: c.entry,
                  });
                  onRemoved(c.entry);
                } catch (e) {
                  setDeleteError(
                    e instanceof Error ? e.message : 'CV ვერ წაიშალა.',
                  );
                  setDeleteBusy(false);
                }
              }}
            >
              {deleteBusy ? 'იშლება…' : 'წაშლა'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {others.length > 0 && (
        <p className="cc-others">
           ასევე მიმართა:{' '}
          {others.map((o, i) => (
            <span key={o.entry}>
              {i > 0 && ', '}
              <button type="button" onClick={() => onOpen(o.entry)}>
                {o.jobTitle || 'ვაკანსიის გარეშე'}
              </button>
            </span>
          ))}
        </p>
      )}
      <div className="cp-tabs cc-detail-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cv'}
          onClick={() => setTab('cv')}
        >
          CV
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          onClick={() => setTab('notes')}
        >
           შენიშვნები <span>{notes?.length ?? c.notes}</span>
        </button>
      </div>
      <CandidateAnswers candidate={c} />
      {tab === 'cv' && parseNotice(c.profile) && (
        <p className="cp-subtle">{parseNotice(c.profile)}</p>
      )}
      {tab === 'cv' ? (
        c.hasCv ? (
          <CvViewer url={cvUrl} name={c.name} />
        ) : (
          <div className="cc-nocv">
            <FileX size={22} />
            <p>
               CV ფაილი პანელში არ შენახულა. ის კანდიდატმა ელფოსტით გამოგიგზავნათ. </p>
          </div>
        )
      ) : (
        <div className="cc-notes">
          {notes === null ? (
            <p className="cp-subtle">იტვირთება…</p>
          ) : !notes.length ? (
            <p className="cp-subtle">
               შენიშვნები ჩანს მხოლოდ თქვენს გუნდს. ჩაინიშნეთ შთაბეჭდილება ან შემდეგი ნაბიჯი. </p>
          ) : (
            <ol>
              {notes.map((n) => (
                <li key={n.id}>
                  <p>{n.body}</p>
                  <span className="cp-subtle">
                    {n.author} · {timeAgo(n.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {canEdit && (
            <form
              className="cc-note-form"
              onSubmit={(e) => {
                e.preventDefault();
                void addNote();
              }}
            >
              <textarea
                className="cp-input"
                rows={3}
                maxLength={4000}
                placeholder="დაწერეთ შენიშვნა… (⌘ Enter)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void addNote();
                  }
                }}
              />
              <button
                className="cp-btn cp-btn--ghost"
                disabled={sending || !draft.trim()}
              >
                <Send size={15} />
                 დამატება </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

const levelText = (level: string | null) =>
  !level ? '' : level === 'native' ? 'მშობლიური' : level.toUpperCase();

/* Correcting extracted facts and owned upload contacts; the file stays as sent. */
function ProfileEditor({
  open,
  candidate: c,
  onClose,
  onSaved,
}: {
  open: boolean;
  candidate: Candidate;
  onClose: () => void;
  onSaved: (profile: CandidateProfile, contact?: { email: string; phone: string }) => void;
  onError: (message: string) => void;
}) {
  const p = c.profile;
  const canEditContact = c.source === 'upload' && !c.contactHidden;
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [years, setYears] = useState('');
  const [city, setCity] = useState('');
  const [education, setEducation] = useState<EducationLevel | ''>('');
  const [skills, setSkills] = useState('');
  const [role, setRole] = useState('');
  const [languages, setLanguages] = useState<CandidateProfile['languages']>([]);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [saveError, setSaveError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setEmailError('');
    setPhoneError('');
    setSaveError('');
    setEmail(c.email);
    setPhone(c.phone);
    setYears(p?.years != null ? String(p.years) : '');
    setCity(p?.city || c.city || '');
    setEducation(p?.educationLevel ?? '');
    setSkills((p?.skills ?? []).join(', '));
    setRole(p?.roles[0] ?? '');
    setLanguages(p?.languages.length ? p.languages : []);
  }, [open, p, c.city, c.email, c.phone]);
  async function save() {
    const contact = canEditContact ? { email: email.trim(), phone: phone.trim() } : undefined;
    setSaveError('');
    const badEmail = contact?.email && !validCandidateEmail(contact.email) ? 'ელფოსტა არასწორია.' : '';
    const badPhone = contact?.phone && !validCandidatePhone(contact.phone) ? 'ტელეფონი უნდა შეიცავდეს მინიმუმ 6 ციფრს.' : '';
    setEmailError(badEmail);
    setPhoneError(badPhone);
    if (badEmail || badPhone) {
      (badEmail ? emailRef : phoneRef).current?.focus();
      return;
    }
    const edit: CandidateProfileEdit & { email?: string; phone?: string } = {
      ...contact,
      years:
        years.trim() === ''
          ? null
          : Math.max(0, Math.min(60, Math.round(Number(years) || 0))),
      city: city.trim(),
      educationLevel: education || null,
      skills: [
        ...new Set(
          skills
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ].slice(0, 40),
      roles: [role.trim(), ...(p?.roles.slice(1) ?? [])].filter(Boolean),
      languages: languages
        .map((l) => ({ name: l.name.trim(), level: l.level }))
        .filter((l) => l.name),
    };
    setBusy(true);
    try {
      await request('candidates', { action: 'profile', entry: c.entry, edit });
      onSaved({
        ...p,
        ...contact,
        origin: 'edited',
        education: p?.education ?? [],
        text: p?.text ?? '',
        years: edit.years ?? null,
        city: edit.city ?? '',
        educationLevel: edit.educationLevel ?? null,
        skills: edit.skills ?? [],
        roles: edit.roles ?? [],
        languages: edit.languages ?? [],
      }, contact);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'ვერ შეინახა');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="cp-dialog cc-profile-edit">
        <DialogTitle>პროფილის შესწორება</DialogTitle>
        <DialogDescription>
           შეგიძლიათ ამოკითხული მონაცემების შესწორება. CV ფაილი არ იცვლება. </DialogDescription>
        <div className="cp-fields">
          {canEditContact && <div className="company-form-grid">
            <label>ელფოსტა<input ref={emailRef} className="cp-input" type="email" value={email} maxLength={254} aria-invalid={!!emailError} aria-describedby={emailError ? 'cc-edit-email-error' : undefined} onChange={(e) => { setEmail(e.target.value); setEmailError(''); }} />
              {emailError && <span id="cc-edit-email-error" className="cc-field-error" role="alert">{emailError}</span>}
            </label>
            <label>ტელეფონი<input ref={phoneRef} className="cp-input" type="tel" value={phone} maxLength={32} aria-invalid={!!phoneError} aria-describedby={phoneError ? 'cc-edit-phone-error' : undefined} onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }} />
              {phoneError && <span id="cc-edit-phone-error" className="cc-field-error" role="alert">{phoneError}</span>}
            </label>
          </div>}
          <div className="company-form-grid">
            <label>
               გამოცდილება (წელი) <input
                className="cp-input"
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
            </label>
            <label>
               ქალაქი <input
                className="cp-input"
                value={city}
                maxLength={80}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
          </div>
          <label>
             ბოლო პოზიცია <input
              className="cp-input"
              value={role}
              maxLength={160}
              placeholder="მაგ.: ბუღალტერი — შპს კომპანია"
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <label>
             განათლება <select
              className="cp-input"
              value={education}
              onChange={(e) =>
                setEducation(e.target.value as EducationLevel | '')
              }
            >
              <option value="">არ არის მითითებული</option>
              {educationLevels.map((l) => (
                <option key={l} value={l}>
                  {educationLabels[l]}
                </option>
              ))}
            </select>
          </label>
          <label>
             უნარები (მძიმით) <textarea
              className="cp-input"
              rows={3}
              aria-label="უნარები (მძიმით)"
              value={skills}
              placeholder="Excel, 1C, მოლაპარაკება"
              onChange={(e) => setSkills(e.target.value)}
            />
          </label>
          <fieldset className="cc-lang-edit">
            <legend>ენები</legend>
            {languages.map((l, i) => (
              <div key={i}>
                <input
                  className="cp-input"
                  aria-label="ენა"
                  value={l.name}
                  placeholder="მაგ.: ინგლისური"
                  onChange={(e) =>
                    setLanguages((all) =>
                      all.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <select
                  className="cp-input"
                  aria-label="დონე"
                  value={l.level ?? ''}
                  onChange={(e) =>
                    setLanguages((all) =>
                      all.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              level: (e.target.value ||
                                null) as CandidateProfile['languages'][number]['level'],
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="">დონე —</option>
                  {languageLevels.map((v) => (
                    <option key={v} value={v}>
                      {levelText(v)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="cp-icon-btn"
                  aria-label="ენის წაშლა"
                  onClick={() =>
                    setLanguages((all) => all.filter((_, j) => j !== i))
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="cp-btn cp-btn--ghost"
              onClick={() =>
                setLanguages((all) => [...all, { name: '', level: null }])
              }
            >
              <Plus size={15} />
               ენის დამატება </button>
          </fieldset>
        </div>
        {saveError && <p className="cc-field-error" role="alert">{saveError}</p>}
        <div className="cp-dialog-actions">
          <button
            type="button"
            className="cp-btn cp-btn--ghost"
            disabled={busy}
            onClick={onClose}
          >
             გაუქმება </button>
          <button
            type="button"
            className="cp-btn cp-btn--primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'ინახება…' : 'შენახვა'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Board({
  canEdit,
  candidates,
  dragging,
  face,
  onDragStart,
  onDrop,
  onOpen,
  onMove,
}: {
  canEdit: boolean;
  candidates: Candidate[];
  dragging: string[] | null;
  face: (c: Candidate) => { name: string; entry: string; photo: boolean };
  onDragStart: (e: React.DragEvent, entry: string) => void;
  onDrop: (e: React.DragEvent, s: CandidateStage) => void;
  onOpen: (entry: string) => void;
  onMove: (entry: string, stage: CandidateStage) => void;
}) {
  const [over, setOver] = useState<CandidateStage | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const update = () => setEdges({
      start: element.scrollLeft <= 1,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
    });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener('scroll', update); observer.disconnect(); };
  }, []);
  return (
    <div className="cc-board-wrap">
      <div className="cc-board-navigation" aria-label="დაფაზე გადაადგილება">
        <span>შერჩევის ეტაპები</span>
        <button type="button" className="cp-icon-btn" aria-label="დაფის მარცხნივ გადახვევა" disabled={edges.start}
          onClick={() => board.current?.scrollBy({ left: -300 })}><ArrowLeft size={16} /><span>მარცხნივ</span></button>
        <button type="button" className="cp-icon-btn" aria-label="დაფის მარჯვნივ გადახვევა" disabled={edges.end}
          onClick={() => board.current?.scrollBy({ left: 300 })}><ArrowRight size={16} /><span>მარჯვნივ</span></button>
      </div>
      <div className="cc-board" ref={board} tabIndex={0} role="region" aria-label="კანდიდატები ეტაპების მიხედვით">
      {candidateStages.map((s) => {
        const items = candidates.filter((c) => c.stage === s);
        return (
          <section
            key={s}
            className="cc-column"
            data-stage={s}
            data-over={over === s || undefined}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOver(s);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setOver((o) => (o === s ? null : o));
            }}
            onDrop={(e) => {
              setOver(null);
              onDrop(e, s);
            }}
          >
            <h3>
              <StatusMark kind={s} data-stage={s}>{stageLabels[s]}</StatusMark>
              <span>{items.length}</span>
            </h3>
            <div className="cc-column-body">
              {items.map((c) => {
                const next = nextStage(c.stage);
                return (
                  <div
                    key={c.entry}
                    className="cc-card"
                    data-entry={c.entry}
                    data-unseen={!c.seen || undefined}
                    data-dragged={dragging?.includes(c.entry) || undefined}
                    draggable={canEdit}
                    onDragStart={(e) => onDragStart(e, c.entry)}
                  >
                    <button
                      type="button"
                      className="cc-card-open"
                      onClick={() => onOpen(c.entry)}
                    >
                      <Avatar {...face(c)} size="sm" />
                      <span className="cc-card-text">
                        <strong>{c.name}</strong>
                        <span>{c.jobTitle || c.title}</span>
                      </span>
                    </button>
                    <InterviewBadge candidate={c} />
                    <CandidateSignals candidate={c} />
                    <span className="cc-card-foot">
                      <time dateTime={c.appliedAt}>{timeAgo(c.appliedAt)}</time>
                      {c.rating && (
                        <span className="cc-mini-rating">
                          <Star size={11} /> {c.rating}
                        </span>
                      )}
                      {c.notes > 0 && (
                        <span className="cc-mini-notes">
                          <MessageSquare size={11} /> {c.notes}
                        </span>
                      )}
                      {canEdit && next && (
                        <button
                          type="button"
                          className="cc-card-next"
                          title={`შემდეგი ეტაპი: ${stageLabels[next]}`}
                          aria-label={`${c.name}: შემდეგი ეტაპი — ${stageLabels[next]}`}
                          onClick={() => onMove(c.entry, next)}
                        >
                          <ArrowRight size={14} /><span>{stageLabels[next]}</span>
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              {(dragging || !items.length) && (
                <div className="cc-drop-hint">
                  {dragging ? 'ჩააგდეთ აქ' : 'ცარიელია'}
                </div>
              )}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}

type Channel = 'email' | 'whatsapp' | 'viber' | 'copy';
const interviewDate = (value: string) =>
  new Intl.DateTimeFormat('ka-GE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tbilisi',
  }).format(new Date(value));

function messageData(c: Candidate, companyName: string) {
  return { name: c.name, jobTitle: c.jobTitle || c.title || 'ღია პოზიცია', companyName,
    date: c.interviewAt ? `გასაუბრება გაიმართება ${interviewDate(c.interviewAt)}-ზე (თბილისის დროით).${c.interviewNote ? ` ადგილი ან ბმული: ${c.interviewNote}.` : ''}` : 'თარიღსა და დროს თქვენთან შევათანხმებთ.' };
}

function messageLink(
  c: Candidate,
  channel: Channel,
  text: string,
  subject: string,
) {
  const phone = candidatePhone(c.phone);
  if (channel === 'email')
    return `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  if (channel === 'whatsapp')
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  if (channel === 'viber')
    return `viber://chat?number=${encodeURIComponent(phone)}`;
  return '';
}

function MessageComposer({ candidates, companyName, initialTemplate, initialChannel, onClose }: {
  candidates: Candidate[]; companyName: string; initialTemplate: TemplateKey; initialChannel: Channel; onClose: () => void;
}) {
  const [templates, setTemplates] = useState<MessageTemplates>(defaultTemplates);
  const [template, setTemplate] = useState(initialTemplate);
  const [value, setValue] = useState(defaultTemplates[initialTemplate]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [entry, setEntry] = useState(candidates[0]?.entry ?? '');
  const [channel, setChannel] = useState(initialChannel);
  const [status, setStatus] = useState('');
  useEffect(() => { let live = true; request('message-templates').then((data: MessageTemplates) => { if (live) { setTemplates(data); setValue(data[initialTemplate]); setLoaded(true); } }).catch((e) => live && setError(e.message)); return () => { live = false; }; }, [initialTemplate]);
  const c = candidates.find((v) => v.entry === entry) ?? candidates[0];
  if (!c) return null;
  const bulk = candidates.length > 1;
  const recipients = candidates.filter((v) => v.email.trim());
  const tooMany = candidates.length > 200;
  const message = render(value, messageData(c, companyName));
  const unavailable = channel === 'email' ? !c.email : channel === 'copy' ? false : !candidatePhone(c.phone);
  const ready = loaded && validTemplate(value) && !tooMany;
  async function copy() {
    try { await navigator.clipboard.writeText(message.body); setStatus('ტექსტი დაკოპირებულია.'); return true; }
    catch { setStatus('კოპირება ვერ მოხერხდა. მონიშნეთ ტექსტი და დააკოპირეთ.'); return false; }
  }
  return <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="cp-dialog cc-compose">
      <DialogTitle>{bulk ? 'წერილი კანდიდატებს' : 'შეტყობინება კანდიდატს'}</DialogTitle>
      <DialogDescription>შეამოწმეთ ტექსტი. გაგზავნას არჩეულ აპში თავად დაადასტურებთ.</DialogDescription>
      {error && <p role="alert">{error}</p>}
      {bulk && <><p>მიმღებები: {recipients.length}  · ელფოსტა არ აქვს: {candidates.length - recipients.length}</p><p className="cp-subtle">თითოეულ კანდიდატს საკუთარი სახელი და ვაკანსია ჩაესმება</p><p className="cp-subtle">წერილები ელფოსტის პროგრამაში ცალ-ცალკე გახსენით.</p></>}
      {tooMany && <p role="alert">ერთდროულად მაქსიმუმ 200 კანდიდატი მონიშნეთ.</p>}
      <label>შაბლონი<SelectField label="შაბლონი" placeholder="აირჩიეთ" value={template} disabled={!loaded} onChange={(next) => { const key = next as TemplateKey; setTemplate(key); setValue(templates[key]); setStatus(''); }} options={templateKinds.map((key) => ({ value: key, label: templateLabels[key] }))} /></label>
      <div className="cmt-actions" role="group" aria-label="წერილის რეჟიმი"><button type="button" className="cp-btn cp-btn--ghost" aria-pressed={!preview} onClick={() => setPreview(false)}>რედაქტირება</button><button type="button" className="cp-btn cp-btn--ghost" aria-pressed={preview} onClick={() => setPreview(true)}>გადახედვა</button></div>
      {preview ? <><p className="cp-subtle">{candidates[0].name}</p><TemplatePreview value={render(value, messageData(candidates[0], companyName))} /></> : <TemplateFields value={value} onChange={setValue} disabled={!loaded} />}
      {bulk && <label>კანდიდატი<select aria-label="კანდიდატი" className="cp-input" value={entry} onChange={(e) => { setEntry(e.target.value); setStatus(''); }}>{candidates.map((v) => <option key={v.entry} value={v.entry}>{v.name}{!v.email ? ' — ელფოსტა არ აქვს' : ''}</option>)}</select></label>}
      {!bulk && <label>არხი<select aria-label="არხი" className="cp-input" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}><option value="email" disabled={!c.email}>ელფოსტა</option><option value="whatsapp" disabled={!candidatePhone(c.phone)}>WhatsApp</option><option value="viber" disabled={!candidatePhone(c.phone)}>Viber</option><option value="copy">ტექსტის კოპირება</option></select></label>}
      {channel === 'viber' && <p className="cp-subtle">ტექსტს დავაკოპირებთ და Viber-ს გავხსნით. ჩასვით ტექსტი საუბარში.</p>}
      {unavailable && <p role="alert">ამ არხისთვის კანდიდატის საკონტაქტო ინფორმაცია არ არის. აირჩიეთ სხვა არხი ან დააკოპირეთ ტექსტი.</p>}
      <p role="status">{status}</p>
      <div className="cc-message-actions"><button type="button" className="cp-btn cp-btn--ghost" disabled={!ready} onClick={() => void copy()}><Copy size={14} />კოპირება</button>
        {channel !== 'copy' && !unavailable && ready && <a className="cp-btn cp-btn--primary" href={messageLink(c, channel, message.body, message.subject)} target={channel === 'whatsapp' ? '_blank' : undefined} rel="noopener noreferrer" onClick={channel === 'viber' ? async (e) => { e.preventDefault(); if (await copy()) window.location.href = messageLink(c, 'viber', message.body, message.subject); } : undefined}>გახსნა: {channel === 'email' ? 'ელფოსტა' : channel === 'whatsapp' ? 'WhatsApp' : 'Viber'}</a>}
        <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose}>დახურვა</button>
      </div>
    </DialogContent>
  </Dialog>;
}

function InterviewBadge({ candidate: c }: { candidate: Candidate }) {
  if (!c.interviewAt) return null;
  return (
    <time className="cc-interview-badge" dateTime={c.interviewAt}>
       გასაუბრება: {interviewDate(c.interviewAt)}
    </time>
  );
}

function downloadFile(body: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Numeric day.month.year so spreadsheets read it regardless of browser locale.
function csvDate(value: string | null | undefined) {
  if (!value) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Tbilisi',
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

function exportCandidates(candidates: Candidate[]) {
  // Quote every field and neutralise formula prefixes when opened in spreadsheet apps.
  const cell = (value: string | number | boolean | null | undefined) => {
    const raw = String(value ?? '');
    const safe =
      /^[\s]*[=+@-]/.test(raw) || /^[\t\r\n]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const rows = [
    [
      'სახელი',
      'ელფოსტა',
      'ტელეფონი',
      'ვაკანსია',
      'ეტაპი',
      'შეფასება',
      'განაცხადის თარიღი',
      'გასაუბრება',
    ],
    ...candidates.map((c) => [
      c.name,
      c.email,
      c.phone,
      c.jobTitle,
      stageLabels[c.stage],
      c.rating,
      csvDate(c.appliedAt),
      csvDate(c.interviewAt),
    ]),
  ];
  downloadFile(
    '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n'),
    'text/csv;charset=utf-8',
    'candidates.csv',
  );
}
