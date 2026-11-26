'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { Plus, Search, Copy, RefreshCw, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { CompanyAccount, CompanyAccountJob } from '@/lib/company-portal';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { day, since, passwordState, jobState } from '@/lib/company-account-status';
import '../../company/portal.css';
import './accounts.css';

type Suggestion = { name: string; jobs: number; hasAccount: boolean };
type Secret = {
  username: string;
  email: string;
  password: string;
  mustChangePassword: boolean;
};

/* Employer names already on the site, typed and picked: another spelling of the same company. */
function NameSearch({
  label,
  hint,
  exclude,
  disabled,
  onPick,
}: {
  label: string;
  hint: string;
  exclude: string[];
  disabled?: boolean;
  onPick: (s: Suggestion) => void;
}) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Suggestion[]>([]);
  useEffect(() => {
    if (text.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      fetch('/api/admin/company-accounts?companies=' + encodeURIComponent(text.trim()), {
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Suggestion[]) => {
          if (active) setRows(list.filter((s) => !exclude.includes(s.name)));
        })
        .catch(() => {});
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, exclude]);
  return (
    <div className="account-name-search">
      <label>
        {label}
        <input
          className="ds-input"
          autoComplete="off"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim().length < 2) setRows([]);
          }}
        />
        <small>{hint}</small>
      </label>
      {text.trim().length >= 2 && rows.length > 0 && (
        <ul className="account-suggestions" aria-label="საიტზე არსებული კომპანიები">
          {rows.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                disabled={s.hasAccount || disabled}
                onClick={() => {
                  onPick(s);
                  setText('');
                  setRows([]);
                }}
              >
                <strong>{s.name}</strong>
                <span>{s.hasAccount ? 'ანგარიში უკვე აქვს' : `${s.jobs} ვაკანსია`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* hr@tbc.ge → "tbc": a shared mailbox name says nothing about the company, its domain does. */
const sharedMailboxes = new Set(['hr', 'info', 'jobs', 'job', 'career', 'careers', 'contact', 'office', 'mail', 'admin', 'recruitment', 'vacancy']);
export function usernameFromEmail(email: string) {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[._-]+/, '');
  const [local = '', domain = ''] = email.trim().split('@');
  const name = clean(local);
  const company = clean(domain.split('.')[0] ?? '');
  return (name.length < 3 || sharedMailboxes.has(name) ? company || name : name).slice(0, 64);
}

function statusOf(a: CompanyAccount): [string, 'ok' | 'wait' | 'off'] {
  if (a.approval_status === 'pending') return ['შემოწმება', 'wait'];
  if (a.approval_status === 'rejected') return ['უარყოფილი', 'off'];
  if (!a.enabled) return ['გათიშული', 'off'];
  return ['აქტიური', 'ok'];
}
function StatusPill({ account }: { account: CompanyAccount }) {
  const [label, tone] = statusOf(account);
  return (
    <span className="account-pills">
      <span className={`account-pill account-pill--${tone}`}>{label}</span>
      {account.must_change_password && (
        <span className="account-pill">დროებითი პაროლი</span>
      )}
    </span>
  );
}

export function CompanyAccounts() {
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const [current, setCurrent] = useState<CompanyAccount | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [aliases, setAliases] = useState<Suggestion[]>([]);
  const [username, setUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [jobId, setJobId] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [view, setView] = useState<'all' | 'pending'>('all');
  const [companyName, setCompanyName] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  // Set when the name already belongs to a company: the admin decides.
  const [sameName, setSameName] = useState<{ message: string; form: FormData } | null>(null);
  // What the last create attempt used, to point at the account that already has it.
  const [ownedJobs, setOwnedJobs] = useState<CompanyAccountJob[] | null>(null);
  const currentKey = current?.company_key;
  useEffect(() => {
    if (!currentKey) return;
    let active = true;
    fetch('/api/admin/company-accounts?jobs=' + encodeURIComponent(currentKey), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: CompanyAccountJob[]) => {
        if (active) setOwnedJobs(rows);
      })
      .catch(() => {
        if (active) setOwnedJobs([]);
      });
    return () => {
      active = false;
      setOwnedJobs(null);
    };
  }, [currentKey, current?.version]);
  const [tried, setTried] = useState<{ email: string; username: string } | null>(null);
  const owner = (name: string) =>
    accounts.find((a) => a.role === 'owner' && a.name.trim().toLowerCase() === name.trim().toLowerCase());
  const existing =
    error && tried
      ? accounts.find(
          (a) => a.email.toLowerCase() === tried.email.toLowerCase() || a.username === tried.username,
        )
      : undefined;
  function openAccount(a: CompanyAccount) {
    setCreate(false);
    setError('');
    setConfirmation(null);
    setCurrent(a);
  }
  const pending = accounts.filter(
    (a) => a.approval_status === 'pending' && a.role === 'owner',
  ).length;
  useEffect(() => {
    if (!create || picked || companyName.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      fetch(
        '/api/admin/company-accounts?companies=' +
          encodeURIComponent(companyName.trim()),
        { cache: 'no-store' },
      )
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: Suggestion[]) => {
          if (active) setSuggestions(rows);
        })
        .catch(() => {});
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [create, companyName, picked]);
  async function request(data?: unknown) {
    const response = await fetch(
      '/api/admin/company-accounts',
      data
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }
        : { cache: 'no-store' },
    );
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(Error(body.error || 'მოქმედება ვერ შესრულდა'), {
        code: response.headers.get('X-Jobx-Error') ?? '',
      });
    return body;
  }
  async function load() {
    setAccounts(await request());
    setLoaded(true);
  }
  useEffect(() => {
    let active = true;
    void request()
      .then((rows) => {
        if (active) {
          setAccounts(rows);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'შეცდომა');
    } finally {
      setBusy(false);
    }
  }
  async function add(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(new FormData(event.currentTarget), false);
  }
  async function submit(form: FormData, allowSameName: boolean) {
    setSameName(null);
    setTried({ email: String(form.get('email') ?? '').trim(), username: String(form.get('username') ?? '') });
    await act(async () => {
      let result;
      try {
        result = await request({
        sameName: allowSameName,
        action: 'create',
        name: companyName.trim(),
        username: form.get('username'),
        email: form.get('email'),
        password: form.get('password'),
        mustChangePassword: form.get('mustChangePassword') === 'on',
        aliases: aliases.map((a) => a.name),
        confirmed: form.get('confirmed') === 'on',
        attachJobs: form.get('attachJobs') === 'on',
      });
      } catch (e) {
        if ((e as { code?: string }).code === 'same-name') {
          setSameName({ message: (e as Error).message, form });
          return;
        }
        throw e;
      }
      setCreate(false);
      setCompanyName('');
      setPicked(null);
      setSuggestions([]);
      setAliases([]);
      if (result.attached)
        setNotice(`ანგარიშს ${result.attached} ვაკანსია მიება.`);
      setSecret({
        username: result.account.username,
        email: result.account.email,
        password: result.password,
        mustChangePassword: result.mustChangePassword,
      });
      await load();
    });
  }
  async function change(action: string, extra: Record<string, unknown> = {}) {
    if (!current) return;
    await act(async () => {
      const result = await request({
        action,
        ...extra,
        id: current.id,
        version: current.version,
        ...(action === 'assign-job' ? { jobId } : {}),
      });
      if (result.password)
        setSecret({
          username: current.username,
          email: result.email || current.email,
          password: result.password,
          mustChangePassword: result.mustChangePassword,
        });
      setConfirmation(null);
      setJobId('');
      const rows: CompanyAccount[] = await request();
      setAccounts(rows);
      // Name changes keep the dialog open on the refreshed account; the rest close it.
      setCurrent(
        ['add-alias', 'remove-alias', 'assign-company-jobs', 'assign-job', 'trusted-mode'].includes(action)
          ? (rows.find((a) => a.id === current.id) ?? null)
          : null,
      );
      setNotice(
        action === 'assign-job'
          ? 'ვაკანსია კომპანიას მიება.'
          : action === 'assign-company-jobs' || action === 'add-alias'
            ? result.attached
              ? `კომპანიას ${result.attached} ვაკანსია მიება.`
              : action === 'add-alias'
                ? 'სახელი დაემატა. ამ სახელით ახალი ვაკანსიებიც ავტომატურად მიებმება.'
                : 'ახალი ვაკანსია ვერ მოიძებნა. ყველა უკვე მიბმულია ან სხვა სახელითაა.'
            : action === 'remove-alias'
              ? 'სახელი მოიხსნა. უკვე მიბმული ვაკანსიები დარჩა.'
              : action === 'delete-company'
                ? `კომპანია წაიშალა${result.releasedJobs ? `; ${result.releasedJobs} ვაკანსია საიტზე დარჩა` : ''}.`
              : action === 'set-login'
                ? 'შესვლის მონაცემები შეიცვალა.'
                : 'ანგარიში განახლებულია.',
      );
    });
  }
  return (
    <>
      <div className="company-toolbar">
        <label className="company-search">
          <Search size={16} />
          <input
            className="ds-input"
            type="search"
            placeholder="კომპანია ან მომხმარებელი"
            aria-label="ანგარიშის ძიება"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="company-row-actions">
          <button
            className="ds-btn ds-btn--secondary"
            disabled={busy}
            onClick={() => void act(load)}
          >
            <RefreshCw size={16} />
            განახლება
          </button>
          <button
            className="ds-btn ds-btn--primary"
            onClick={() => {
              setCreate(true);
              setError('');
              setSameName(null);
              setCompanyName('');
              setPicked(null);
              setSuggestions([]);
              setAliases([]);
              setUsername('');
              setUsernameEdited(false);
            }}
          >
            <Plus size={16} />
            ანგარიშის შექმნა
          </button>
        </div>
      </div>
      {error && !create && !current && (
        <p role="alert" className="company-error">
          {error}
        </p>
      )}
      {notice && <output className="company-notice">{notice}</output>}
      {loaded && accounts.length > 0 && (() => {
        const owners = accounts.filter((a) => a.role === 'owner');
        const week = Date.now() - 7 * day;
        const stats: [string, number][] = [
          ['კომპანია', owners.length],
          ['აქტიური', owners.filter((a) => a.approval_status === 'approved' && a.enabled).length],
          ['შევიდა ბოლო 7 დღეში', owners.filter((a) => a.lastLoginAt && Date.parse(a.lastLoginAt) > week).length],
          ['არასდროს შესულა', owners.filter((a) => !a.lastLoginAt).length],
          ['აქტიური ვაკანსია', owners.reduce((n, a) => n + a.liveJobs, 0)],
          ['განაცხადი 30 დღეში', owners.reduce((n, a) => n + a.recentApplications, 0)],
        ];
        return (
          <dl className="account-stats">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dd>{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        );
      })()}
      {loaded && accounts.length > 0 && (
        <div
          className="account-views"
          role="group"
          aria-label="ანგარიშების ფილტრი"
        >
          <button
            className={view === 'all' ? 'is-active' : ''}
            aria-pressed={view === 'all'}
            onClick={() => setView('all')}
          >
            ყველა <span>{accounts.length}</span>
          </button>
          <button
            className={
              (view === 'pending' ? 'is-active ' : '') +
              (pending ? 'has-pending' : '')
            }
            aria-pressed={view === 'pending'}
            onClick={() => setView('pending')}
          >
            ახალი მოთხოვნები <span>{pending}</span>
          </button>
        </div>
      )}
      {!loaded ? (
        <p>იტვირთება…</p>
      ) : !accounts.length ? (
        <div className="company-empty">
          <h2>ანგარიში ჯერ არ შექმნილა</h2>
          <p>
            შექმენი კომპანიის ანგარიში და გადასცე დროებითი პაროლი მის
            წარმომადგენელს.
          </p>
        </div>
      ) : (
        <ul className="company-job-list">
          {accounts
            .filter(
              (a) =>
                view === 'all' ||
                (a.approval_status === 'pending' && a.role === 'owner'),
            )
            .filter((a) =>
              `${a.name} ${a.username} ${a.email}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((account) => (
              <li key={account.id}>
                <div>
                  <h2>
                    {account.name} <StatusPill account={account} />
                  </h2>
                  <p>{account.email}</p>
                  <p className="account-meta">
                    <span>{account.lastLoginAt ? `შევიდა ${since(account.lastLoginAt)}` : 'ჯერ არ შესულა'}</span>
                    {account.role === 'owner' && (
                      <>
                        <span>{account.liveJobs} აქტიური ვაკანსია{account.jobs > account.liveJobs ? ` (სულ ${account.jobs})` : ''}</span>
                        <span>{account.recentApplications} განაცხადი 30 დღეში</span>
                        {account.baseViews > 0 && <span>CV ბაზა: {account.baseViews} კონტაქტი</span>}
                      </>
                    )}
                    {account.role !== 'owner' && <span>გუნდის წევრი</span>}
                  </p>
                </div>
                <button
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  onClick={() => {
                    setCurrent(account);
                    setConfirmation(null);
                    setError('');
                  }}
                >
                  მართვა
                </button>
              </li>
            ))}
        </ul>
      )}
      <Dialog
        open={create}
        onOpenChange={(open) => {
          if (!busy) setCreate(open);
        }}
      >
        <DialogContent className="company-job-dialog">
          <DialogTitle>ახალი ანგარიში</DialogTitle>
          <DialogDescription>კომპანია ამ ელფოსტით შევა.</DialogDescription>
          <form
            className="company-form account-form"
            onSubmit={add}
            onInvalidCapture={(e) => {
              const box = (e.target as HTMLElement).closest('details');
              if (box) box.open = true;
            }}
          >
            {error && (
              <div role="alert" className="company-error account-error">
                <span>{error}</span>
                {existing && (
                  <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => openAccount(existing)}>
                    ანგარიშის გახსნა
                  </button>
                )}
              </div>
            )}
            <label>
              კომპანია
              <input
                className="ds-input"
                name="name"
                required
                minLength={2}
                maxLength={160}
                autoComplete="off"
                placeholder="დაიწყეთ აკრეფა"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setPicked(null);
                  if (e.target.value.trim().length < 2) setSuggestions([]);
                }}
              />
            </label>
            {!picked && suggestions.length > 0 && (
              <ul
                className="account-suggestions"
                aria-label="საიტზე არსებული კომპანიები"
              >
                {suggestions.map((s) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onClick={() => {
                        const has = s.hasAccount ? owner(s.name) : undefined;
                        if (has) return openAccount(has);
                        setCompanyName(s.name);
                        setPicked(s);
                        setSuggestions([]);
                      }}
                    >
                      <strong>{s.name}</strong>
                      <span>
                        {s.hasAccount
                          ? 'ანგარიში აქვს — გახსნა'
                          : `${s.jobs} ვაკანსია`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked && (
              <p className="account-picked">{picked.jobs} ვაკანსია მიება ანგარიშს</p>
            )}
            <div className="company-form-grid">
              <label>
                ელფოსტა
                <input
                  className="ds-input"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  onChange={(e) => {
                    if (usernameEdited) return;
                    setUsername(usernameFromEmail(e.target.value));
                  }}
                />
              </label>
              <label>
                პაროლი
                <input
                  className="ds-input"
                  name="password"
                  type="text"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  spellCheck={false}
                  placeholder="ცარიელი — შეიქმნება ავტომატურად"
                />
              </label>
            </div>
            <details className="account-more">
              <summary>დამატებით</summary>
              <div className="company-form">
                <label>
                  მომხმარებლის სახელი
                  <input
                    className="ds-input"
                    name="username"
                    autoComplete="off"
                    required
                    pattern="[a-z0-9][a-z0-9._\-]{2,63}"
                    title="ლათინური პატარა ასოები და ციფრები, მინიმუმ 3 სიმბოლო"
                    maxLength={64}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameEdited(true);
                    }}
                  />
                </label>
                <NameSearch
                  label="სხვა სახელები"
                  hint="მაგ. TBC Bank — ამ სახელის ვაკანსიებიც მიება."
                  exclude={[companyName, ...aliases.map((a) => a.name)]}
                  onPick={(s) => setAliases((list) => [...list, s])}
                />
                {aliases.length > 0 && (
                  <ul className="account-aliases" aria-label="დამატებული სახელები">
                    {aliases.map((a) => (
                      <li key={a.name}>
                        {a.name} · {a.jobs}
                        <button
                          type="button"
                          aria-label={`${a.name} — მოხსნა`}
                          onClick={() => setAliases((list) => list.filter((x) => x.name !== a.name))}
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="account-confirm">
                  <input type="checkbox" name="attachJobs" defaultChecked />
                  ვაკანსიების მიბმა
                </label>
                <label className="account-confirm">
                  <input type="checkbox" name="mustChangePassword" defaultChecked />
                  პირველ შესვლაზე პაროლის შეცვლა
                </label>
              </div>
            </details>
            <label className="account-confirm">
              <input type="checkbox" name="confirmed" required />
              წარმომადგენელი გადამოწმებულია
            </label>
            {sameName && (
              <div className="company-confirm" role="alert">
                <p>{sameName.message}</p>
                <div className="company-row-actions">
                  <button
                    type="button"
                    className="ds-btn ds-btn--primary"
                    disabled={busy}
                    onClick={() => void submit(sameName.form, true)}
                  >
                    კი, დავამატო
                  </button>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary"
                    disabled={busy}
                    onClick={() => setSameName(null)}
                  >
                    არა
                  </button>
                </div>
              </div>
            )}
            {!sameName && (
              <button className="ds-btn ds-btn--primary" disabled={busy}>
                {busy ? 'იქმნება…' : 'შექმნა'}
              </button>
            )}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!current}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setCurrent(null);
            setConfirmation(null);
            setJobId('');
          }
        }}
      >
        <DialogContent className="company-job-dialog">
          <DialogTitle>{current?.name}</DialogTitle>
          <DialogDescription className="account-head">
            {current?.email}
            {current && <StatusPill account={current} />}
          </DialogDescription>
          {error && (
            <p role="alert" className="company-error">
              {error}
            </p>
          )}
          <div className="company-form account-manage">
            {current?.role === 'owner' && current.approval_status !== 'approved' && (
              <div className="account-approve">
                <p>
                  {current.email_verified
                    ? 'კომპანია დადასტურებას ელოდება.'
                    : 'ელფოსტა ჯერ დადასტურებული არ არის.'}
                </p>
                <div className="company-row-actions">
                  <button
                    className="ds-btn ds-btn--primary"
                    disabled={busy || !current.email_verified}
                    onClick={() => void change('approve')}
                  >
                    დამტკიცება
                  </button>
                  {current.approval_status === 'pending' && (
                    <button
                      className="ds-btn ds-btn--secondary"
                      disabled={busy}
                      onClick={() => void change('reject')}
                    >
                      უარყოფა
                    </button>
                  )}
                </div>
              </div>
            )}
            <dl className="account-facts">
              <dt>საკონტაქტო პირი</dt>
              <dd>
                {current?.representative_name || '—'}
                {current?.position ? `, ${current.position}` : ''}
              </dd>
              <dt>ტელეფონი</dt>
              <dd>{current?.phone || '—'}</dd>
              <dt>საიდ. კოდი</dt>
              <dd>{current?.registration_code || '—'}</dd>
              <dt>ელფოსტა</dt>
              <dd>{current?.email_verified ? 'დადასტურებულია' : 'დაუდასტურებელი'}</dd>
              <dt>პაროლი</dt>
              <dd>{current && passwordState(current)}</dd>
              <dt>ბოლო შესვლა</dt>
              <dd>{since(current?.lastLoginAt) || 'ჯერ არ შესულა'}</dd>
              <dt>შეიქმნა</dt>
              <dd>{since(current?.createdAt)}</dd>
            </dl>
            {current?.role === 'owner' && (
              <dl className="account-stats account-stats--small">
                {([
                  ['აქტიური ვაკანსია', current.liveJobs],
                  ['განაცხადი 30 დღეში', current.recentApplications],
                  ['განაცხადი სულ', current.applications],
                  ['CV ბაზა, 30 დღე', current.baseViews],
                  ['გუნდი', current.team],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label}>
                    <dd>{value}</dd>
                    <dt>{label}</dt>
                  </div>
                ))}
              </dl>
            )}
            <details className="account-more">
              <summary>
                ვაკანსიები და სახელები
                <span>{current?.jobs ?? 0}</span>
              </summary>
              <div className="company-form">
                <p className="account-rule">
                  ებმება საიტზე ამ სახელებით გამოქვეყნებული ვაკანსიები, რომლებიც სხვა კომპანიას არ ეკუთვნის.
                  ახლებიც თავისით მიება, როცა კომპანია სივრცეს გახსნის.
                </p>
                {ownedJobs === null ? (
                  <p className="account-rule">იტვირთება…</p>
                ) : ownedJobs.length === 0 ? (
                  <p className="account-empty">
                    ჯერ არცერთი ვაკანსია არ არის მიბმული. სცადეთ „ყველა ვაკანსიის მიბმა“; თუ ვერ მოიძებნა,
                    საიტზე ამ სახელით ვაკანსია ჯერ არ არის, ან სხვა დაწერილობითაა — დაამატეთ სახელი ქვემოთ.
                  </p>
                ) : (
                  <ul className="account-jobs">
                    {ownedJobs.map((j) => {
                      const [label, tone] = jobState(j);
                      return (
                        <li key={j.id}>
                          <a href={vacancyPath({ id: j.id, title: j.title })} target="_blank" rel="noopener">
                            {j.title}
                          </a>
                          <span className={`account-pill account-pill--${tone}`}>{label}</span>
                          <small>
                            {[j.company, j.sources, j.deadline ? `ვადა ${j.deadline}` : ''].filter(Boolean).join(' · ')}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <ul className="account-aliases" aria-label="კომპანიის სახელები">
                  <li>{current?.name}</li>
                  {current?.aliases?.map((name) => (
                    <li key={name}>
                      {name}
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`${name} — მოხსნა`}
                        onClick={() => void change('remove-alias', { name })}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <NameSearch
                  label="სახელის დამატება"
                  hint="მაგ. TBC Bank — ამ სახელის ვაკანსიებიც მიება."
                  exclude={[current?.name ?? '', ...(current?.aliases ?? [])]}
                  disabled={busy}
                  onPick={(s) => void change('add-alias', { name: s.name })}
                />
                <button
                  className="ds-btn ds-btn--secondary"
                  disabled={busy}
                  onClick={() => void change('assign-company-jobs')}
                >
                  ყველა ვაკანსიის მიბმა
                </button>
                <div className="account-inline">
                  <input
                    className="ds-input"
                    aria-label="ვაკანსიის ID"
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    placeholder="ვაკანსიის ID"
                  />
                  <button
                    className="ds-btn ds-btn--secondary"
                    disabled={busy || !jobId.trim()}
                    onClick={() => void change('assign-job', { jobId })}
                  >
                    მიბმა
                  </button>
                </div>
              </div>
            </details>
            <details className="account-more">
              <summary>შესვლა და პაროლი</summary>
              <form
                className="company-form"
                key={current?.id + ':' + current?.version}
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const email = String(form.get('email') ?? '').trim();
                  void change('set-login', {
                    ...(email && email !== current?.email ? { email } : {}),
                    password: form.get('password'),
                    mustChangePassword: form.get('mustChangePassword') === 'on',
                  });
                }}
              >
                <div className="company-form-grid">
                  <label>
                    ელფოსტა
                    <input
                      className="ds-input"
                      name="email"
                      type="email"
                      maxLength={254}
                      defaultValue={current?.email}
                    />
                  </label>
                  <label>
                    ახალი პაროლი
                    <input
                      className="ds-input"
                      name="password"
                      type="text"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      spellCheck={false}
                      placeholder="ცარიელი — არ შეიცვლება"
                    />
                  </label>
                </div>
                <label className="account-confirm">
                  <input type="checkbox" name="mustChangePassword" defaultChecked />
                  პირველ შესვლაზე პაროლის შეცვლა
                </label>
                <div className="company-row-actions">
                  <button className="ds-btn ds-btn--primary" disabled={busy}>
                    შენახვა
                  </button>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary"
                    onClick={() => setConfirmation('reset-password')}
                  >
                    დროებითი პაროლის გენერაცია
                  </button>
                </div>
              </form>
            </details>
            <details className="account-more">
              <summary>პარამეტრები</summary>
              <div className="company-form">
                <label>
                  ვაკანსიების გამოქვეყნება
                  <select
                    className="ds-input"
                    value={current?.trustedMode ?? 'auto'}
                    disabled={busy}
                    onChange={(event) =>
                      void change('trusted-mode', {
                        mode: event.target.value as CompanyAccount['trustedMode'],
                      })
                    }
                  >
                    <option value="auto">ავტომატურად, 3 დამტკიცების შემდეგ</option>
                    <option value="on">ყოველთვის შემოწმების გარეშე</option>
                    <option value="off">ყოველთვის შემოწმებით</option>
                  </select>
                  <small>{current?.trusted ? 'ახლა: შემოწმების გარეშე' : 'ახლა: შემოწმებით'}</small>
                </label>
                <button
                  className="ds-btn ds-btn--secondary"
                  onClick={() => setConfirmation(current?.enabled ? 'disable' : 'enable')}
                >
                  {current?.enabled ? 'ანგარიშის გათიშვა' : 'ანგარიშის ჩართვა'}
                </button>
                <button
                  className="ds-btn account-delete-btn"
                  onClick={() => setConfirmation('delete-company')}
                >
                  კომპანიის წაშლა
                </button>
              </div>
            </details>
            {confirmation && (
              <div className="company-confirm">
                <p>
                  {confirmation === 'reset-password'
                    ? 'ძველი პაროლი აღარ იმუშავებს.'
                    : confirmation === 'delete-company'
                      ? `„${current?.name}“ წაიშლება: ანგარიშები, გუნდი და კანდიდატების სამუშაო სივრცე. ვაკანსიები საიტზე დარჩება. ამის დაბრუნება შეუძლებელია.`
                    : confirmation === 'disable'
                      ? 'კომპანია ვეღარ შევა. ვაკანსიები დარჩება.'
                      : 'კომპანია ისევ შეძლებს შესვლას.'}
                </p>
                <div className="company-row-actions">
                  <button
                    className="ds-btn ds-btn--secondary"
                    disabled={busy}
                    onClick={() => setConfirmation(null)}
                  >
                    გაუქმება
                  </button>
                  <button
                    className={
                      confirmation === 'delete-company'
                        ? 'ds-btn account-delete-btn account-delete-btn--solid'
                        : 'ds-btn ds-btn--primary'
                    }
                    disabled={busy}
                    onClick={() => void change(confirmation)}
                  >
                    {confirmation === 'delete-company' ? 'წაშლა' : 'დადასტურება'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!secret}
        onOpenChange={(open) => {
          if (!open) setSecret(null);
        }}
      >
        <DialogContent>
          <DialogTitle>შესვლის მონაცემები</DialogTitle>
          <DialogDescription>
            პაროლი მხოლოდ ახლა ჩანს — დააკოპირეთ და გადაეცით კომპანიას.
          </DialogDescription>
          <dl className="account-credentials">
            <dt>შესვლა</dt>
            <dd>/company</dd>
            <dt>ელფოსტა</dt>
            <dd>{secret?.email}</dd>
            <dt>მომხმარებელი</dt>
            <dd>{secret?.username}</dd>
            <dt>{secret?.mustChangePassword ? 'დროებითი პაროლი' : 'პაროლი'}</dt>
            <dd>
              <code>{secret?.password}</code>
            </dd>
          </dl>
          <button
            className="ds-btn ds-btn--primary"
            onClick={() =>
              void act(async () => {
                await navigator.clipboard.writeText(
                  `${location.origin}/company\nელფოსტა: ${secret?.email}\nმომხმარებელი: ${secret?.username}\nპაროლი: ${secret?.password}`,
                );
                setNotice('მონაცემები დაკოპირებულია.');
              })
            }
          >
            <Copy size={16} />
            მონაცემების კოპირება
          </button>
          {notice && <output>{notice}</output>}
        </DialogContent>
      </Dialog>
    </>
  );
}
