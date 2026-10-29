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
        name: form.get('name'),
        username: form.get('username'),
        email: form.get('email'),
        confirmed: form.get('confirmed') === 'on',
      });
      setCreate(false);
      setSecret({
        username: result.account.username,
        password: result.password,
      });
      await load();
    });
  }
  async function change(action: string) {
    if (!current) return;
    await act(async () => {
      const result = await request({
        action,
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
                    {account.enabled ? 'აქტიური' : 'გათიშული'}
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
            კომპანია პირველ შესვლაზე შეცვლის დროებით პაროლს. არსებული ვაკანსიები
            ავტომატურად არ მიებმება.
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
              />
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
            <h2>ვაკანსიის მიბმა</h2>
            <p>
              მიუთითე ვაკანსიის ID. მიბმა დაშვებულია მხოლოდ იმავე სახელის
              კომპანიის განცხადებაზე; სხვა კომპანიაზე არსებული წვდომა არ
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
