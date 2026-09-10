'use client';
import { useCallback, useEffect, useState } from 'react';
import { FolderHeart, Search, Trash2, ArrowUpRight } from 'lucide-react';
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
  PERSONAL_PREFIX,
  readPersonal,
  putPersonal,
  saveSearch,
  recordKey,
  type PersonalRecord,
  type SearchFilters,
  type Application,
  type SavedSearch,
} from '@/lib/personal-space';
import type { PublicJob } from '@/lib/types';

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
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);
  function act(operation: () => void, success: string) {
    try {
      operation();
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
    }, 'ეტაპი შენახულია. განაცხადი არ გაგზავნილა.');
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
}: {
  job: PublicJob;
  space: PersonalController;
  disabled: boolean;
}) {
  const entry = space.records.find(
    (r): r is Application => r.kind === 'application' && r.id === job.id,
  );
  return (
    <section className="application-control">
      <label htmlFor="application-stage">ჩემი განაცხადი</label>
      <select
        id="application-stage"
        disabled={disabled || !space.ready}
        value={entry?.status || ''}
        onChange={(e) => {
          if (e.target.value)
            space.track(job, e.target.value as Application['status']);
        }}
      >
        <option value="" disabled>
          აირჩიე ეტაპი
        </option>
        {Object.entries(applicationStatuses).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <p>
        {disabled
          ? 'წინასწარი ნახვის რეჟიმში პირადი აღრიცხვა გამორთულია.'
          : 'პირადი ჩანაწერი — დამსაქმებელს არ ეგზავნება.'}
      </p>
      <Feedback space={space} />
    </section>
  );
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
  const [section, setSection] = useState<'searches' | 'applications'>(
    'searches',
  );
  const [stage, setStage] = useState('all');
  const searches = space.records.filter(
    (r): r is SavedSearch => r.kind === 'search',
  );
  const applications = space.records.filter(
    (r): r is Application => r.kind === 'application',
  );
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
            </div>
            <Feedback space={space} />
            {!space.ready && !space.error && <p>იტვირთება…</p>}
            {section === 'searches' ? (
              <>
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
                {searches.map((record) => (
                  <article className="personal-card" key={record.id}>
                    <h3>{record.name}</h3>
                    <p>{summary(record.filters)}</p>
                    <small>დალაგება: {record.filters.sort}</small>
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
                        className="icon-button"
                        aria-label={`${record.name} — წაშლა`}
                        onClick={() => space.remove(record)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </>
            ) : (
              <>
                <p>
                  ეტაპებს შენ ცვლი. „გავაგზავნე“ დამსაქმებლის პასუხს ან მიღების
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
                      გახსენი ვაკანსია და „ჩემი განაცხადის“ ველში აირჩიე ეტაპი.
                    </p>
                  </div>
                )}
                {applications
                  .filter((r) => stage === 'all' || r.status === stage)
                  .map((record) => (
                    <article className="personal-card" key={record.id}>
                      <p>
                        {record.company} · {record.city}
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
                        <a href={`/vacancies/${record.id}`}>
                          ვაკანსიის ნახვა <ArrowUpRight size={14} />
                        </a>
                        <button
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
