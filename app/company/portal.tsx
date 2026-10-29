'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import {
  Plus,
  LogOut,
  Building2,
  Briefcase,
  KeyRound,
  ArrowUpRight,
  Search,
} from 'lucide-react';
import { Brand } from '../brand';
import { SelectField } from '../select-field';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { categories } from '@/lib/types';
import { workModes, employmentOptions } from '@/lib/job-submission';
import { newCompanyJob, type CompanyJobForm } from '@/lib/company-job-form';
import type { CompanyIdentity } from '@/lib/company-portal';
import './portal.css';
type Job = {
  id: string;
  version: number;
  status: string;
  needsReview: boolean;
  title: string;
  imported: boolean;
  salary: string;
  form: CompanyJobForm;
};
type Profile = {
  name: string;
  website: string;
  description: string;
  logoUrl: string;
  version: number;
};
async function request(path: string, data?: unknown, method = 'POST') {
  const res = await fetch(
    '/api/company/' + path,
    data
      ? {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : { cache: 'no-store' },
  );
  const body = await res.json();
  if (!res.ok) {
    if (res.status === 401 && !['session', 'password'].includes(path))
      window.location.reload();
    throw Error(body.error || 'მოქმედება ვერ შესრულდა');
  }
  return body;
}
const statuses: Record<string, string> = {
  pending: 'დადასტურებას ელოდება',
  published: 'გამოქვეყნებული',
  archived: 'დახურული',
  rejected: 'უარყოფილი',
  merged: 'გაერთიანებული',
};
export function CompanyPortal({
  identity,
}: {
  identity: CompanyIdentity | null;
}) {
  const [tab, setTab] = useState('jobs');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{
    job?: Job;
    form: CompanyJobForm;
    requestId: string;
  } | null>(null);
  const [closing, setClosing] = useState<Job | null>(null);
  const ready = identity && !identity.mustChangePassword;
  async function load() {
    const [a, b] = await Promise.all([request('jobs'), request('profile')]);
    setJobs(a);
    setProfile(b);
    setLoaded(true);
  }
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void Promise.all(
      ['jobs', 'profile'].map((path) =>
        fetch('/api/company/' + path, {
          signal: controller.signal,
          cache: 'no-store',
        }).then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw Error(body.error);
          return body;
        }),
      ),
    )
      .then(([a, b]) => {
        setJobs(a);
        setProfile(b);
        setLoaded(true);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => controller.abort();
  }, [ready]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'მოქმედება ვერ შესრულდა');
    } finally {
      setBusy(false);
    }
  }
  async function login(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action(async () => {
      await request('session', {
        username: data.get('username'),
        password: data.get('password'),
      });
      window.location.reload();
    });
  }
  async function password(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action(async () => {
      if (data.get('password') !== data.get('repeat'))
        throw Error('ახალი პაროლები არ ემთხვევა.');
      await request('password', {
        currentPassword: data.get('currentPassword'),
        password: data.get('password'),
      });
      window.location.reload();
    });
  }
  const passwordForm = (
    <form className="company-form company-security" onSubmit={password}>
      <h2>პაროლის შეცვლა</h2>
      <p>
        {identity?.mustChangePassword
          ? 'პირველი შესვლისას შეცვალე დროებითი პაროლი.'
          : 'შეცვლის შემდეგ ყველა მოწყობილობაზე სესია დასრულდება და ხელახლა შეხვალ.'}
      </p>
      <label>
        მიმდინარე პაროლი
        <input
          className="ds-input"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <label>
        ახალი პაროლი
        <input
          className="ds-input"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
        <small>სულ მცირე 12 სიმბოლო</small>
      </label>
      <label>
        გაიმეორე ახალი პაროლი
        <input
          className="ds-input"
          name="repeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      <button className="ds-btn ds-btn--primary" disabled={busy}>
        პაროლის შენახვა
      </button>
    </form>
  );
  return (
    <div className="company-portal">
      <header className="company-header">
        <Brand />
        <span>კომპანიის სივრცე</span>
        <Link href="/" className="company-site-link">
          საიტის ნახვა <ArrowUpRight size={15} />
        </Link>
        {identity && (
          <button
            className="ds-btn ds-btn--ghost ds-btn--sm"
            onClick={() =>
              void action(async () => {
                await fetch('/api/company/session', { method: 'DELETE' });
                window.location.reload();
              })
            }
          >
            <LogOut size={16} />
            გასვლა
          </button>
        )}
      </header>
      <main className="company-main">
        {identity && (
          <header className="company-heading">
            <h1>{identity.name}</h1>
            <p>მართე კომპანიის გვერდი და ვაკანსიები.</p>
          </header>
        )}
        {error && (
          <p role="alert" className="company-error">
            {error}
          </p>
        )}
        {notice && <output className="company-notice">{notice}</output>}
        {!identity ? (
          <form className="company-form company-login" onSubmit={login}>
            <Building2 size={28} />
            <h1>კომპანიის სივრცეში შესვლა</h1>
            <p>გამოიყენე JOBX-ის გუნდისგან მიღებული მონაცემები.</p>
            <label>
              მომხმარებლის სახელი
              <input
                className="ds-input"
                name="username"
                autoComplete="username"
                required
                maxLength={64}
              />
            </label>
            <label>
              პაროლი
              <input
                className="ds-input"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <button className="ds-btn ds-btn--primary" disabled={busy}>
              {busy ? 'მიმდინარეობს…' : 'შესვლა'}
            </button>
            <Link href="/contact">დახმარება შესვლაში</Link>
          </form>
        ) : identity.mustChangePassword ? (
          passwordForm
        ) : (
          <>
            <nav className="company-tabs" aria-label="კომპანიის მართვა">
              {[
                { id: 'jobs', label: 'ვაკანსიები', Icon: Briefcase },
                { id: 'profile', label: 'კომპანიის გვერდი', Icon: Building2 },
                { id: 'security', label: 'პაროლი', Icon: KeyRound },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => {
                    setTab(id);
                    setError('');
                    setNotice('');
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'jobs' && (
              <>
                <div className="company-toolbar">
                  <label className="company-search">
                    <Search size={17} />
                    <input
                      className="ds-input"
                      type="search"
                      aria-label="ვაკანსიის ძიება"
                      placeholder="მოძებნე ვაკანსია"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <button
                    className="ds-btn ds-btn--primary"
                    onClick={() =>
                      setEditing({
                        form: newCompanyJob(),
                        requestId: crypto.randomUUID(),
                      })
                    }
                  >
                    <Plus size={17} />
                    ვაკანსიის დამატება
                  </button>
                </div>
                <p className="company-hint">
                  ახალი განცხადება და ცვლილებები ქვეყნდება JOBX-ის გუნდის
                  დადასტურების შემდეგ. ვაკანსიის დახურვა მაშინვე მოქმედებს.
                </p>
                {!loaded ? (
                  <p>იტვირთება…</p>
                ) : (
                  <ul className="company-job-list">
                    {jobs
                      .filter((j) =>
                        j.title.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((job) => (
                        <li key={job.id}>
                          <div>
                            <h2>{job.title}</h2>
                            <p>
                              {job.form.city} ·{' '}
                              <span>{statuses[job.status] || job.status}</span>
                              {job.needsReview && job.status === 'published'
                                ? ' · ცვლილება განიხილება'
                                : ''}
                            </p>
                          </div>
                          <div className="company-row-actions">
                            <button
                              className="ds-btn ds-btn--secondary ds-btn--sm"
                              onClick={() =>
                                setEditing({
                                  job,
                                  form: structuredClone(job.form),
                                  requestId: job.id,
                                })
                              }
                            >
                              მართვა
                            </button>
                            {!['archived', 'rejected', 'merged'].includes(
                              job.status,
                            ) && (
                              <button
                                className="ds-btn ds-btn--ghost ds-btn--sm"
                                onClick={() => setClosing(job)}
                              >
                                დახურვა
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
                {loaded && !jobs.length && (
                  <div className="company-empty">
                    <Briefcase size={28} />
                    <h2>ვაკანსია ჯერ არ დაგიმატებია</h2>
                    <p>
                      დაამატე პირველი განცხადება ან დაგვიკავშირდი უკვე არსებული
                      ვაკანსიის ანგარიშზე მისაბმელად.
                    </p>
                  </div>
                )}
              </>
            )}
            {tab === 'profile' && profile && (
              <form
                className="company-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    setProfile(await request('profile', profile));
                    setNotice('კომპანიის მონაცემები შენახულია.');
                  });
                }}
              >
                <h2>კომპანიის გვერდი</h2>
                <label>
                  კომპანიის სახელი
                  <input className="ds-input" value={profile.name} disabled />
                  <small>სახელის შესაცვლელად დაგვიკავშირდი.</small>
                </label>
                <label>
                  ვებგვერდი
                  <input
                    className="ds-input"
                    type="url"
                    placeholder="https://"
                    maxLength={2000}
                    value={profile.website}
                    onChange={(e) =>
                      setProfile({ ...profile, website: e.target.value })
                    }
                  />
                </label>
                <label>
                  ლოგოს ბმული
                  <input
                    className="ds-input"
                    type="url"
                    placeholder="https://"
                    maxLength={2000}
                    value={
                      profile.logoUrl.startsWith('/') ? '' : profile.logoUrl
                    }
                    onChange={(e) =>
                      setProfile({ ...profile, logoUrl: e.target.value })
                    }
                  />
                  <small>
                    არსებული ლოგო შენარჩუნდება, თუ ახალ ბმულს არ მიუთითებ.
                  </small>
                </label>
                <label>
                  კომპანიის შესახებ
                  <textarea
                    className="ds-input"
                    rows={7}
                    maxLength={3000}
                    value={profile.description}
                    onChange={(e) =>
                      setProfile({ ...profile, description: e.target.value })
                    }
                  />
                </label>
                <button className="ds-btn ds-btn--primary" disabled={busy}>
                  ცვლილებების შენახვა
                </button>
              </form>
            )}
            {tab === 'security' && passwordForm}
          </>
        )}
      </main>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
      >
        <DialogContent className="company-job-dialog">
          <DialogTitle>
            {editing?.job ? 'ვაკანსიის მართვა' : 'ახალი ვაკანსია'}
          </DialogTitle>
          <DialogDescription>
            შეავსე პირობები და გაგზავნე შესამოწმებლად.
          </DialogDescription>
          {editing && (
            <form
              className="company-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await request('jobs', {
                    action: editing.job
                      ? ['archived', 'rejected'].includes(editing.job.status)
                        ? 'restore'
                        : 'save'
                      : 'create',
                    id: editing.job?.id,
                    version: editing.job?.version,
                    requestId: editing.requestId,
                    form: editing.form,
                  });
                  setEditing(null);
                  await load();
                  setNotice('ვაკანსია გაგზავნილია შესამოწმებლად.');
                });
              }}
            >
              {error && (
                <p role="alert" className="company-error">
                  {error}
                </p>
              )}
              <label>
                პოზიციის დასახელება
                <input
                  className="ds-input"
                  value={editing.form.title}
                  required
                  maxLength={160}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      form: { ...editing.form, title: e.target.value },
                    })
                  }
                />
              </label>
              <div className="company-form-grid">
                <label>
                  ქალაქი
                  <input
                    className="ds-input"
                    required
                    value={editing.form.city}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        form: { ...editing.form, city: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  განაცხადების ბოლო ვადა
                  <input
                    className="ds-input"
                    type="date"
                    required
                    value={editing.form.deadline}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        form: { ...editing.form, deadline: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
              {!editing.job?.imported && (
                <>
                  <label htmlFor="company-select-0">
                    კატეგორია
                    <SelectField
                      id="company-select-0"
                      label="კატეგორია"
                      options={[...categories]}
                      value={editing.form.category}
                      onChange={(value) =>
                        setEditing({
                          ...editing,
                          form: {
                            ...editing.form,
                            category: value as CompanyJobForm['category'],
                          },
                        })
                      }
                    />
                  </label>
                  <div className="company-form-grid">
                    <label htmlFor="company-select-1">
                      მუშაობის ფორმა
                      <SelectField
                        id="company-select-1"
                        label="მუშაობის ფორმა"
                        options={[...workModes]}
                        value={editing.form.mode}
                        onChange={(value) =>
                          setEditing({
                            ...editing,
                            form: {
                              ...editing.form,
                              mode: value as CompanyJobForm['mode'],
                            },
                          })
                        }
                      />
                    </label>
                    <label htmlFor="company-select-2">
                      განაკვეთი
                      <SelectField
                        id="company-select-2"
                        label="განაკვეთი"
                        options={[...employmentOptions]}
                        value={editing.form.employmentType}
                        onChange={(value) =>
                          setEditing({
                            ...editing,
                            form: {
                              ...editing.form,
                              employmentType:
                                value as CompanyJobForm['employmentType'],
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="company-form-grid">
                    <label>
                      ანაზღაურება — დან (₾)
                      <input
                        className="ds-input"
                        type="number"
                        min="1"
                        value={editing.form.salaryFrom}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            form: {
                              ...editing.form,
                              salaryFrom: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      მდე (₾)
                      <input
                        className="ds-input"
                        type="number"
                        min="1"
                        value={editing.form.salaryTo}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            form: { ...editing.form, salaryTo: e.target.value },
                          })
                        }
                      />
                    </label>
                    <label htmlFor="company-select-3">
                      პერიოდი
                      <SelectField
                        id="company-select-3"
                        label="ანაზღაურების პერიოდი"
                        options={['თვე', 'დღე']}
                        value={editing.form.salaryPeriod}
                        onChange={(value) =>
                          setEditing({
                            ...editing,
                            form: {
                              ...editing.form,
                              salaryPeriod: value as 'თვე' | 'დღე',
                            },
                          })
                        }
                      />
                    </label>
                    <label htmlFor="company-select-4">
                      თანხა
                      <SelectField
                        id="company-select-4"
                        label="თანხის ტიპი"
                        options={['ხელზე', 'დარიცხული']}
                        value={editing.form.salaryBasis}
                        onChange={(value) =>
                          setEditing({
                            ...editing,
                            form: {
                              ...editing.form,
                              salaryBasis: value as 'ხელზე' | 'დარიცხული',
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </>
              )}
              {editing.job?.imported && (
                <p className="company-hint">
                  წყაროდან მიღებული კატეგორია, გრაფიკი და ანაზღაურება (
                  {editing.job.salary || 'მითითებული არ არის'}) შენარჩუნდება.
                  მათ შესაცვლელად დაგვიკავშირდი.
                </p>
              )}
              <label>
                აღწერა
                <textarea
                  className="ds-input"
                  rows={8}
                  minLength={30}
                  maxLength={20000}
                  required
                  value={editing.form.description}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      form: { ...editing.form, description: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                განაცხადის მისაღებად — ელფოსტა, ტელეფონი ან ბმული
                <input
                  className="ds-input"
                  required
                  value={editing.form.contact}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      form: { ...editing.form, contact: e.target.value },
                    })
                  }
                />
              </label>
              <div className="company-row-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  გაუქმება
                </button>
                <button
                  className="ds-btn ds-btn--primary"
                  disabled={busy || editing.job?.status === 'merged'}
                >
                  {busy ? 'იგზავნება…' : 'შესამოწმებლად გაგზავნა'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!closing}
        onOpenChange={(open) => {
          if (!open && !busy) setClosing(null);
        }}
      >
        <DialogContent>
          <DialogTitle>ვაკანსიის დახურვა</DialogTitle>
          <DialogDescription>
            „{closing?.title}“ აღარ გამოჩნდება აქტიურ ვაკანსიებში. მოგვიანებით
            მისი ხელახლა გაგზავნა შეგეძლება.
          </DialogDescription>
          <div className="company-row-actions">
            <button
              className="ds-btn ds-btn--secondary"
              disabled={busy}
              onClick={() => setClosing(null)}
            >
              გაუქმება
            </button>
            <button
              className="ds-btn ds-btn--primary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  if (!closing) return;
                  await request('jobs', {
                    action: 'archive',
                    id: closing.id,
                    version: closing.version,
                  });
                  setClosing(null);
                  await load();
                  setNotice('ვაკანსია დახურულია.');
                })
              }
            >
              დახურვა
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
