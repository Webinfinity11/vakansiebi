'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { Plus, Search, Copy, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { CompanyAccount } from '@/lib/company-portal';
import '../../company/portal.css';
import './accounts.css';

type Suggestion = { name: string; jobs: number; hasAccount: boolean };
export function CompanyAccounts() {
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const [current, setCurrent] = useState<CompanyAccount | null>(null);
  const [secret, setSecret] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [jobId, setJobId] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [view, setView] = useState<'all' | 'pending'>('all');
  const [companyName, setCompanyName] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Suggestion | null>(null);
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
    if (!response.ok) throw Error(body.error || 'მოქმედება ვერ შესრულდა');
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
    const form = new FormData(event.currentTarget);
    await act(async () => {
      const result = await request({
        action: 'create',
        name: companyName.trim(),
        username: form.get('username'),
        email: form.get('email'),
        confirmed: form.get('confirmed') === 'on',
        attachJobs: form.get('attachJobs') === 'on',
      });
      setCreate(false);
      setCompanyName('');
      setPicked(null);
      setSuggestions([]);
      if (result.attached)
        setNotice(`ანგარიშს ${result.attached} ვაკანსია მიება.`);
      setSecret({
        username: result.account.username,
        password: result.password,
      });
      await load();
    });
  }
  async function change(action: string, mode?: CompanyAccount['trustedMode']) {
    if (!current) return;
    await act(async () => {
      const result = await request({
        action,
        ...(mode ? { mode } : {}),
        id: current.id,
        version: current.version,
        ...(action === 'assign-job' ? { jobId } : {}),
      });
      if (result.password)
        setSecret({ username: current.username, password: result.password });
      setConfirmation(null);
      setCurrent(null);
      setJobId('');
      await load();
      setNotice(
        action === 'assign-job'
          ? 'ვაკანსია კომპანიას მიება.'
          : action === 'assign-company-jobs'
            ? result.attached
              ? `კომპანიას ${result.attached} ვაკანსია მიება.`
              : 'ახალი ვაკანსია ვერ მოიძებნა. ყველა უკვე მიბმულია ან სხვა სახელითაა.'
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
              setCompanyName('');
              setPicked(null);
              setSuggestions([]);
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
                  <h2>{account.name}</h2>
                  <p>
                    {account.username} · {account.email}
                  </p>
                  <p>
                    {account.approval_status === 'pending'
                      ? 'შემოწმების მოლოდინში'
                      : account.approval_status === 'rejected'
                        ? 'უარყოფილია'
                        : account.enabled
                          ? 'აქტიური'
                          : 'გათიშული'}
                    {account.must_change_password
                      ? ' · პაროლი შესაცვლელია'
                      : ''}
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
          <DialogTitle>კომპანიის ანგარიშის შექმნა</DialogTitle>
          <DialogDescription>
            კომპანია პირველ შესვლაზე შეცვლის დროებით პაროლს.
          </DialogDescription>
          <form className="company-form" onSubmit={add}>
            {error && (
              <p role="alert" className="company-error">
                {error}
              </p>
            )}
            <label>
              კომპანიის სრული სახელი
              <input
                className="ds-input"
                name="name"
                required
                minLength={2}
                maxLength={160}
                autoComplete="off"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setPicked(null);
                  if (e.target.value.trim().length < 2) setSuggestions([]);
                }}
              />
              <small>
                აკრიფე და აირჩიე საიტზე უკვე არსებული კომპანია, ან ჩაწერე ახალი
                სახელი.
              </small>
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
                      disabled={s.hasAccount}
                      onClick={() => {
                        setCompanyName(s.name);
                        setPicked(s);
                        setSuggestions([]);
                      }}
                    >
                      <strong>{s.name}</strong>
                      <span>
                        {s.hasAccount
                          ? 'ანგარიში უკვე აქვს'
                          : `${s.jobs} ვაკანსია`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked && (
              <p className="account-picked">
                არჩეულია საიტზე არსებული კომპანია: {picked.name} · {picked.jobs}{' '}
                ვაკანსია
              </p>
            )}
            <label className="account-confirm">
              <input type="checkbox" name="attachJobs" defaultChecked />
              ამ სახელის აქტიური და მოლოდინში მყოფი ვაკანსიების მიბმა
            </label>
            <label>
              მომხმარებლის სახელი
              <input
                className="ds-input"
                name="username"
                autoComplete="off"
                required
                pattern="[a-z0-9][a-z0-9._\-]{2,63}"
                maxLength={64}
              />
              <small>
                ლათინური პატარა ასოები და ციფრები; მინიმუმ 3 სიმბოლო
              </small>
            </label>
            <label>
              კომპანიის ელფოსტა
              <input
                className="ds-input"
                name="email"
                type="email"
                required
                maxLength={254}
              />
            </label>
            <label className="account-confirm">
              <input type="checkbox" name="confirmed" required />
              გადამოწმებულია, რომ წვდომას კომპანიის უფლებამოსილ წარმომადგენელს
              ვაძლევ.
            </label>
            <button className="ds-btn ds-btn--primary" disabled={busy}>
              {busy ? 'იქმნება…' : 'შექმნა და დროებითი პაროლის მიღება'}
            </button>
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
          <DialogDescription>
            {current?.username} · {current?.email}
          </DialogDescription>
          {error && (
            <p role="alert" className="company-error">
              {error}
            </p>
          )}
          <div className="company-form">
            <h2>კომპანიის დადასტურება</h2>
            <p>
              სტატუსი:{' '}
              {current?.approval_status === 'pending'
                ? 'შემოწმების მოლოდინში'
                : current?.approval_status === 'rejected'
                  ? 'უარყოფილია'
                  : 'დადასტურებულია'}
            </p>
            <p>
              კოდი: {current?.registration_code || '—'} ·{' '}
              {current?.representative_name} · {current?.position} ·{' '}
              {current?.phone}
            </p>
            <p>
              ელფოსტა:{' '}
              {current?.email_verified ? 'დადასტურებულია' : 'დასადასტურებელია'}
            </p>
            {current?.role === 'owner' && (
              <div className="company-row-actions">
                <button
                  className="ds-btn ds-btn--primary"
                  disabled={busy || !current.email_verified}
                  onClick={() => void change('approve')}
                >
                  კომპანიის დამტკიცება
                </button>
                <button
                  className="ds-btn ds-btn--secondary"
                  disabled={busy}
                  onClick={() => void change('reject')}
                >
                  უარყოფა
                </button>
              </div>
            )}
            <label>
              ავტომატური გამოქვეყნება
              <select className="ds-input" value={current?.trustedMode ?? 'auto'} disabled={busy}
                onChange={(event) => void change('trusted-mode', event.target.value as CompanyAccount['trustedMode'])}>
                <option value="auto">წესით (3 დამტკიცებული, 0 უარყოფილი 90 დღეში)</option>
                <option value="on">ყოველთვის</option>
                <option value="off">არასოდეს</option>
              </select>
            </label>
            <p>{current?.trusted ? 'ახლა: სანდო' : 'ახლა: რიგში დგება'}</p>
            <h2>ვაკანსიების მიბმა</h2>
            <p>
              კომპანიის სახელით მოიძებნება ყველა აქტიური და მოლოდინში მყოფი
              ვაკანსია, რომელიც სხვა ანგარიშს არ ეკუთვნის.
            </p>
            <button
              className="ds-btn ds-btn--primary"
              disabled={busy}
              onClick={() => void change('assign-company-jobs')}
            >
              კომპანიის ყველა ვაკანსიის მიბმა
            </button>
            <p>
              ან მიუთითე ერთი ვაკანსიის ID. მიბმა დაშვებულია მხოლოდ იმავე
              სახელის კომპანიის განცხადებაზე; სხვა კომპანიაზე არსებული წვდომა არ
              გადაიწერება.
            </p>
            <label>
              ვაკანსიის ID
              <input
                className="ds-input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <button
              className="ds-btn ds-btn--secondary"
              disabled={busy || !jobId.trim()}
              onClick={() => void change('assign-job')}
            >
              მიბმა
            </button>
            <h2>შესვლის მართვა</h2>
            <div className="company-row-actions">
              <button
                className="ds-btn ds-btn--secondary"
                onClick={() => setConfirmation('reset-password')}
              >
                ახალი დროებითი პაროლი
              </button>
              <button
                className="ds-btn ds-btn--secondary"
                onClick={() =>
                  setConfirmation(current?.enabled ? 'disable' : 'enable')
                }
              >
                {current?.enabled ? 'ანგარიშის გათიშვა' : 'ანგარიშის ჩართვა'}
              </button>
            </div>
            {confirmation && (
              <div className="company-confirm">
                <p>
                  {confirmation === 'reset-password'
                    ? 'ძველი პაროლი აღარ იმუშავებს და ყველა სესია დასრულდება.'
                    : confirmation === 'disable'
                      ? 'კომპანია სივრცეში ვეღარ შევა. ვაკანსიები შენარჩუნდება.'
                      : 'კომპანიას სივრცეში შესვლა კვლავ შეეძლება.'}
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
                    className="ds-btn ds-btn--primary"
                    disabled={busy}
                    onClick={() => void change(confirmation)}
                  >
                    დადასტურება
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
            დროებითი პაროლი მხოლოდ ამ ფანჯარაში ჩანს. გადასცე კომპანიის
            წარმომადგენელს დაცული გზით; პირველი შესვლისას შეცვლის.
          </DialogDescription>
          <dl className="account-credentials">
            <dt>შესვლა</dt>
            <dd>/company</dd>
            <dt>მომხმარებელი</dt>
            <dd>{secret?.username}</dd>
            <dt>დროებითი პაროლი</dt>
            <dd>
              <code>{secret?.password}</code>
            </dd>
          </dl>
          <button
            className="ds-btn ds-btn--primary"
            onClick={() =>
              void act(async () => {
                await navigator.clipboard.writeText(
                  `${location.origin}/company\nმომხმარებელი: ${secret?.username}\nდროებითი პაროლი: ${secret?.password}`,
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
