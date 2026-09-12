'use client';
import './personal-space.css';
import { useCallback, useEffect, useRef, useState, useId } from 'react';
import {
  FolderHeart,
  Search,
  Trash2,
  ArrowUpRight,
  UserRound,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  applicationStatuses,
  beginApplication,
  PERSONAL_PREFIX,
  readPersonal,
  putPersonal,
  saveSearch,
  recordKey,
  readApplicant,
  writeApplicant,
  filterIdentity,
  type Applicant,
  type PersonalRecord,
  type SearchFilters,
  type Application,
  type SavedSearch,
} from '@/lib/personal-space';
import type { PublicJob } from '@/lib/types';
import { searchParams } from '@/lib/search-state';

const personalChanged = 'ertad-personal-changed';
export function usePersonalSpace() {
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [undo, setUndo] = useState<PersonalRecord | null>(null);
  const refresh = useCallback(() => {
    try {
      const result = readPersonal(localStorage);
      setRecords(result.records);
      setError(
        result.invalid
          ? 'ზოგი შენახული ჩანაწერი ვერ წავიკითხეთ. სხვა ჩანაწერები ხელმისაწვდომია.'
          : '',
      );
      setReady(true);
    } catch {
      setError(
        'ბრაუზერის საცავი მიუწვდომელია. ამ რეჟიმში მონაცემებს ვერ შევინახავთ.',
      );
      setReady(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith(PERSONAL_PREFIX)) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(personalChanged, refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(personalChanged, refresh);
    };
  }, [refresh]);
  function act(operation: () => void, success: string) {
    try {
      operation();
      setError('');
      window.dispatchEvent(new Event(personalChanged));
      refresh();
      setMessage(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.message.startsWith('შეგიძლია')
          ? e.message
          : 'შენახვა ვერ მოხერხდა. ცვლილება არ შენახულა; გადაამოწმე ბრაუზერის საცავი.',
      );
      return false;
    }
  }
  function track(job: PublicJob, status: Application['status']) {
    return act(() => {
      putPersonal(localStorage, {
        version: 1,
        kind: 'application',
        id: job.id,
        title: job.title,
        company: job.company,
        city: job.city,
        url: job.url,
        deadline: job.deadline,
        status,
        updatedAt: new Date().toISOString(),
      });
      if (undo?.id === job.id) setUndo(null);
    }, 'პირადი სტატუსი განახლდა.');
  }
  function begin(job: PublicJob) {
    return act(() => {
      beginApplication(localStorage, {
        version: 1,
        kind: 'application',
        id: job.id,
        title: job.title,
        company: job.company,
        city: job.city,
        url: job.url,
        deadline: job.deadline,
        status: 'started',
        updatedAt: new Date().toISOString(),
      });
      if (undo?.id === job.id) setUndo(null);
    }, '');
  }
  function updateStatus(record: Application, status: Application['status']) {
    return act(() => {
      const latest = readPersonal(localStorage).records.find(
        (r) => recordKey(r) === recordKey(record),
      );
      if (!latest || latest.kind !== 'application') throw Error('Removed');
      putPersonal(localStorage, {
        ...latest,
        status,
        updatedAt: new Date().toISOString(),
      });
    }, 'განაცხადის ეტაპი განახლდა.');
  }
  function remove(record: PersonalRecord) {
    act(() => {
      const latest = readPersonal(localStorage).records.find(
        (r) => recordKey(r) === recordKey(record),
      );
      localStorage.removeItem(recordKey(record));
      setUndo(latest || null);
    }, 'ჩანაწერი წაიშალა.');
  }
  function restore() {
    if (undo)
      act(() => {
        if (localStorage.getItem(recordKey(undo)))
          throw Error('Already restored');
        putPersonal(localStorage, undo);
        setUndo(null);
      }, 'ჩანაწერი აღდგენილია.');
  }
  return {
    records,
    ready,
    error,
    message,
    undo,
    restore,
    remove,
    track,
    begin,
    updateStatus,
    save: (name: string, filters: SearchFilters) =>
      act(() => {
        saveSearch(localStorage, name, filters);
      }, 'ძიება შენახულია. შეტყობინებები არ ჩაირთო.'),
  };
}
export type PersonalController = ReturnType<typeof usePersonalSpace>;
function Feedback({ space }: { space: PersonalController }) {
  return (
    <>
      {space.error && (
        <p role="alert" className="personal-error">
          {space.error}
        </p>
      )}
      <output aria-live="polite" className="personal-feedback">
        {space.message}
        {space.undo && <button onClick={space.restore}>წაშლის გაუქმება</button>}
      </output>
    </>
  );
}
export function ApplicationControl({
  job,
  space,
  disabled,
  seen = false,
}: {
  job: PublicJob;
  space: PersonalController;
  disabled: boolean;
  seen?: boolean;
}) {
  const stageId = useId();
  const entry = space.records.find(
    (r): r is Application => r.kind === 'application' && r.id === job.id,
  );
  return (
    <section
      className="application-control"
      data-application-status={entry?.status || ''}
    >
      <div className="application-control-heading">
        <label htmlFor={stageId}>ჩემი სტატუსი</label>
        {seen && <span className="seen-badge">ნანახია</span>}
      </div>
      <select
        id={stageId}
        disabled={disabled || !space.ready}
        value={entry?.status || ''}
        onChange={(e) => {
          if (e.target.value)
            space.track(job, e.target.value as Application['status']);
          else if (entry) space.remove(entry);
        }}
      >
        <option value="">ეტაპის გარეშე</option>
        {Object.entries(applicationStatuses).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {entry?.status === 'started' && (
        <div className="application-confirm">
          <p>ბმულის გახსნა გაგზავნას არ ადასტურებს. უკვე გაგზავნე განაცხადი?</p>
          <button
            className="secondary-button"
            disabled={disabled || !space.ready}
            onClick={() => space.track(job, 'applied')}
          >
            კი, გავაგზავნე
          </button>
        </div>
      )}
      <p>
        {disabled
          ? 'წინასწარი ნახვის რეჟიმში პირადი აღრიცხვა გამორთულია.'
          : 'პირადი აღნიშვნა · ინახება ამ ბრაუზერში.'}
      </p>
      <Feedback space={space} />
    </section>
  );
}
/* The server honours only these windows, so a saved search can only be asked about one of them.
   The window chosen is never wider than the time since the search was saved: a wider one would
   count vacancies that were already there, and "new" has to mean new. */
const freshnessWindows = [1, 3, 7, 30] as const;
type FreshnessWindow = (typeof freshnessWindows)[number];
export function freshnessWindow(savedAt: string, now = Date.now()) {
  const days = Math.floor((now - Date.parse(savedAt)) / 86400000);
  let chosen: FreshnessWindow = 1;
  for (const window of freshnessWindows)
    if (window <= Math.max(1, days)) chosen = window;
  return chosen;
}
type Freshness = { total: number; fresh: number; days: FreshnessWindow };
const freshnessKey = (record: SavedSearch) =>
  record.id + '|' + filterIdentity(record.filters);
async function countMatches(
  filters: SearchFilters,
  signal: AbortSignal,
  days?: FreshnessWindow,
) {
  const params = searchParams(
    days ? { ...filters, postedWithin: days } : filters,
  );
  params.set('countsOnly', '1');
  const response = await fetch('/api/jobs?' + params, { signal });
  if (!response.ok) throw Error('unavailable');
  const data = await response.json();
  if (typeof data.total !== 'number') throw Error('unavailable');
  return data.total as number;
}

export function PersonalSpace({
  space,
  filters,
  onApply,
  active,
  disabled,
  open,
  setOpen,
}: {
  space: PersonalController;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  active: boolean;
  disabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [section, setSection] = useState<
    'searches' | 'applications' | 'details'
  >('applications');
  const [stage, setStage] = useState('all');
  const [counts, setCounts] = useState<Record<string, Freshness | 'error'>>({});
  const requested = useRef(new Set<string>());
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [details, setDetails] = useState<Applicant>({
    fullName: '',
    phone: '',
    email: '',
  });
  const [detailsError, setDetailsError] = useState('');
  const [detailsMessage, setDetailsMessage] = useState('');
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const searches = space.records.filter(
    (r): r is SavedSearch => r.kind === 'search',
  );
  const applications = space.records.filter(
    (r): r is Application => r.kind === 'application',
  );
  /* Checked only while the tab is open, two at a time, and never again for the same saved
     filters in this session. Nothing is scheduled, nothing is sent: this is the whole of
     "notifications" that a page which never contacts anyone can honestly offer. */
  const checkable = searches.slice(0, 8);
  const checkKeys = checkable.map(freshnessKey).join('~');
  useEffect(() => {
    if (!open || section !== 'searches' || !checkKeys) return;
    const controller = new AbortController();
    const queue = checkable.filter(
      (record) => !requested.current.has(freshnessKey(record)),
    );
    if (!queue.length) return;
    for (const record of queue) requested.current.add(freshnessKey(record));
    const worker = async () => {
      for (let record = queue.shift(); record; record = queue.shift()) {
        const key = freshnessKey(record);
        const days = freshnessWindow(record.updatedAt);
        try {
          const [total, fresh] = await Promise.all([
            countMatches(record.filters, controller.signal),
            countMatches(record.filters, controller.signal, days),
          ]);
          if (controller.signal.aborted) return;
          setCounts((prev) => ({ ...prev, [key]: { total, fresh, days } }));
        } catch {
          if (controller.signal.aborted) return;
          requested.current.delete(key);
          setCounts((prev) => ({ ...prev, [key]: 'error' }));
        }
      }
    };
    void Promise.all([worker(), worker()]);
    return () => controller.abort();
    // checkable is derived from checkKeys; listing it would refetch on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section, checkKeys]);
  useEffect(() => {
    if (!open) return;
    const read = () => {
      try {
        const stored = readApplicant(localStorage);
        setApplicant(stored);
        setDetails(stored || { fullName: '', phone: '', email: '' });
      } catch {
        setApplicant(null);
      }
    };
    const timer = setTimeout(read, 0);
    window.addEventListener('storage', read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', read);
    };
  }, [open]);
  const summary = (f: SearchFilters) =>
    [
      f.query,
      f.city === 'ყველა' ? '' : f.city,
      f.category === 'ყველა' ? '' : f.category,
      f.source === 'ყველა' ? '' : f.source,
      f.paid ? 'ხელფასი მითითებულია' : '',
      f.remote ? 'დისტანციური' : '',
      f.employment === 'daily'
        ? 'დღიური სამუშაო'
        : f.employment === 'part-time'
          ? 'ნახევარი განაკვეთი'
          : f.employment === 'internship'
            ? 'სტაჟირება'
            : '',
      f.entryLevel ? 'გამოცდილების გარეშე' : '',
      f.postedWithin ? `ბოლო ${f.postedWithin} დღეში` : '',
      f.salaryFrom !== null || f.salaryTo !== null
        ? `${f.salaryFrom ?? 0}–${f.salaryTo ?? '∞'} ₾ / ${f.salaryPeriod === 'day' ? 'დღე' : 'თვე'}`
        : f.salaryPeriod === 'day'
          ? 'დღიური ანაზღაურება'
          : '',
    ]
      .filter(Boolean)
      .join(' · ');
  return (
    <div className="personal-tools" id="personal-tools">
      <button
        className="secondary-button"
        disabled={disabled || !active || !space.ready}
        title={!active ? 'ჯერ აირჩიე საძიებო სიტყვა ან ფილტრი' : undefined}
        onClick={() => {
          setName(summary(filters).slice(0, 80));
          setSaving(true);
        }}
      >
        <Search size={16} />
        ძიების შენახვა
      </button>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        <FolderHeart size={17} />
        ჩემი სივრცე <span>{searches.length + applications.length}</span>
      </button>
      {!open && !saving && (space.error || space.message) && (
        <Feedback space={space} />
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="personal-sheet">
          <SheetHeader>
            <SheetTitle>ჩემი სივრცე</SheetTitle>
            <SheetDescription>
              შენახული ძიებები და განაცხადების პირადი ისტორია
            </SheetDescription>
          </SheetHeader>
          <div className="personal-body">
            <p className="personal-storage-note">
              ინახება მხოლოდ ამ ბრაუზერში. სხვა მოწყობილობაზე არ გადადის;
              ბრაუზერის მონაცემების გასუფთავებისას წაიშლება.
            </p>
            <div className="personal-tabs">
              <button
                aria-pressed={section === 'searches'}
                onClick={() => setSection('searches')}
              >
                ძიებები ({searches.length})
              </button>
              <button
                aria-pressed={section === 'applications'}
                onClick={() => setSection('applications')}
              >
                განაცხადები ({applications.length})
              </button>
              <button
                aria-pressed={section === 'details'}
                onClick={() => setSection('details')}
              >
                <UserRound size={15} /> ჩემი მონაცემები
              </button>
            </div>
            <Feedback space={space} />
            {!space.ready && !space.error && <p>იტვირთება…</p>}
            {section === 'searches' ? (
              <>
                {!!searches.length && (
                  <p className="saved-freshness-note">
                    შეტყობინებები არ იგზავნება — რაოდენობა მოწმდება მხოლოდ ამ
                    გვერდის გახსნისას.
                  </p>
                )}
                {!searches.length && (
                  <div className="personal-empty">
                    <h3>სასურველი ძიება შეინახე</h3>
                    <p>
                      აირჩიე პოზიცია, ქალაქი ან სხვა ფილტრი და დააჭირე „ძიების
                      შენახვას“. შემდეგ იმავე პირობებით მოძებნი განახლებულ
                      ვაკანსიებს.
                    </p>
                  </div>
                )}
                {searches.map((record) => {
                  const freshness = counts[freshnessKey(record)];
                  const counted =
                    freshness && freshness !== 'error' ? freshness : null;
                  return (
                    <article className="personal-card" key={record.id}>
                      <h3>{record.name}</h3>
                      <p>{summary(record.filters)}</p>
                      <small>დალაგება: {record.filters.sort}</small>
                      <p className="saved-freshness">
                        {!freshness
                          ? 'მოწმდება…'
                          : freshness === 'error'
                            ? 'რაოდენობა ვერ შემოწმდა'
                            : `სულ ${counted!.total} ვაკანსია · ბოლო ${counted!.days} დღეში ${counted!.fresh}`}
                      </p>
                      {!!counted?.fresh && (
                        <button
                          type="button"
                          className="secondary-button saved-open-new"
                          onClick={() => {
                            onApply({
                              ...record.filters,
                              postedWithin: counted.days,
                            });
                            setOpen(false);
                          }}
                        >
                          ნახე ახლები ({counted.fresh})
                        </button>
                      )}
                      <div className="personal-actions">
                        <button
                          className="primary"
                          onClick={() => {
                            onApply(record.filters);
                            setOpen(false);
                          }}
                        >
                          ძიების გახსნა <ArrowUpRight size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`${record.name} — წაშლა`}
                          onClick={() => space.remove(record)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </>
            ) : section === 'details' ? (
              <form
                className="applicant-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    const saved = writeApplicant(localStorage, details);
                    setApplicant(saved);
                    setDetailsError('');
                    setDetailsMessage(
                      saved
                        ? 'მონაცემები შენახულია ამ ბრაუზერში.'
                        : 'მონაცემები წაიშალა.',
                    );
                  } catch (error) {
                    setDetailsMessage('');
                    setDetailsError(
                      error instanceof Error
                        ? error.message
                        : 'შენახვა ვერ მოხერხდა.',
                    );
                  }
                }}
              >
                <p className="applicant-note">
                  ინახება მხოლოდ ამ ბრაუზერში და მხოლოდ წერილის ტექსტში
                  ჩაისმება. არსად არ იგზავნება.
                </p>
                <label htmlFor={nameId}>სახელი და გვარი</label>
                <input
                  id={nameId}
                  value={details.fullName}
                  maxLength={80}
                  autoComplete="name"
                  enterKeyHint="done"
                  onChange={(event) =>
                    setDetails({ ...details, fullName: event.target.value })
                  }
                />
                <label htmlFor={phoneId}>ტელეფონი</label>
                <input
                  id={phoneId}
                  value={details.phone}
                  maxLength={32}
                  inputMode="tel"
                  autoComplete="tel"
                  enterKeyHint="done"
                  onChange={(event) =>
                    setDetails({ ...details, phone: event.target.value })
                  }
                />
                <label htmlFor={emailId}>ელფოსტა</label>
                <input
                  id={emailId}
                  value={details.email}
                  maxLength={120}
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint="done"
                  onChange={(event) =>
                    setDetails({ ...details, email: event.target.value })
                  }
                />
                {detailsError && (
                  <p role="alert" className="personal-error">
                    {detailsError}
                  </p>
                )}
                <output aria-live="polite" className="personal-feedback">
                  {detailsMessage}
                </output>
                <div className="applicant-actions">
                  <button className="primary" type="submit">
                    შენახვა
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!applicant}
                    onClick={() => {
                      try {
                        writeApplicant(localStorage, {});
                      } catch {}
                      setApplicant(null);
                      setDetails({ fullName: '', phone: '', email: '' });
                      setDetailsError('');
                      setDetailsMessage('მონაცემები წაიშალა.');
                    }}
                  >
                    წაშლა
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p>
                  ეტაპებს შენ ცვლი. „გაგზავნილია“ დამსაქმებლის პასუხს ან მიღების
                  დადასტურებას არ ნიშნავს.
                </p>
                <label className="personal-stage-filter">
                  ეტაპით გაფილტვრა
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="all">ყველა ეტაპი</option>
                    {Object.entries(applicationStatuses).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label} (
                        {applications.filter((r) => r.status === key).length})
                      </option>
                    ))}
                  </select>
                </label>
                {!applications.filter(
                  (r) => stage === 'all' || r.status === stage,
                ).length && (
                  <div className="personal-empty">
                    <h3>ამ ეტაპზე ჩანაწერი არ გაქვს</h3>
                    <p>
                      გახსენი ვაკანსია და „ჩემი სტატუსის“ ველში აირჩიე ეტაპი.
                    </p>
                  </div>
                )}
                {applications
                  .filter((r) => stage === 'all' || r.status === stage)
                  .map((record) => (
                    <article className="personal-card" key={record.id}>
                      <p>
                        {[record.company, record.city]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <h3>{record.title}</h3>
                      <label>
                        ჩემი ეტაპი
                        <select
                          value={record.status}
                          onChange={(e) =>
                            space.updateStatus(
                              record,
                              e.target.value as Application['status'],
                            )
                          }
                        >
                          {Object.entries(applicationStatuses).map(
                            ([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <small>
                        ბოლო ცვლილება: {record.updatedAt.slice(0, 10)}
                        {record.deadline &&
                          ` · განცხადების ვადა: ${record.deadline}`}
                      </small>
                      <p className="personal-snapshot-note">
                        შენახვისას არსებული მონაცემები. ჩანაწერი რჩება ვაკანსიის
                        წაშლის შემდეგაც.
                      </p>
                      <div className="personal-actions">
                        <a
                          className="secondary-button"
                          href={`/vacancies/${record.id}`}
                        >
                          ვაკანსიის ნახვა <ArrowUpRight size={14} />
                        </a>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`${record.title} — პირადი ისტორიიდან წაშლა`}
                          onClick={() => space.remove(record)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="personal-save-dialog">
          <DialogHeader>
            <DialogTitle>ძიების შენახვა</DialogTitle>
            <DialogDescription>
              შეინახე ფილტრები ამავე ბრაუზერში შემდეგი ვიზიტისთვის.
              შეტყობინებები არ ჩაირთვება.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (space.save(name, filters)) setSaving(false);
            }}
          >
            <label htmlFor="saved-search-name">ძიების სახელი</label>
            <input
              id="saved-search-name"
              value={name}
              maxLength={80}
              required
              enterKeyHint="done"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
            <p>{summary(filters)}</p>
            <Feedback space={space} />
            <button className="primary" disabled={!name.trim() || !space.ready}>
              შენახვა
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
