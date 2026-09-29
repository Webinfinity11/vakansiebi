'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { trackingSchema, type TrackingRecord } from '@/lib/tracking';
import './tracking-settings.css';

export function TrackingSettings() {
  const [record, setRecord] = useState<TrackingRecord | null>(null);
  const [saved, setSaved] = useState<TrackingRecord | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/tracking', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'პარამეტრები ვერ ჩაიტვირთა');
        setRecord(data);
        setSaved(data);
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [reload]);
  const dirty = JSON.stringify(record) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record) return;
    const parsed = trackingSchema.safeParse(record.settings);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...record, settings: parsed.data }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'შენახვა ვერ მოხერხდა');
      setRecord(data);
      setSaved(data);
      setMessage('შენახულია — ცვლილება საიტის შემდეგ ჩატვირთვაზე ამოქმედდება.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tracking-settings">
      {error && (
        <div role="alert" className="tracking-error">
          {error}{' '}
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            disabled={busy}
            onClick={() => {
              setReload((v) => v + 1);
              setMessage('');
            }}
          >
            შენახულის ჩატვირთვა
          </button>
        </div>
      )}
      {!record ? (
        !error && <output>პარამეტრები იტვირთება…</output>
      ) : (
        <form onSubmit={save}>
          <p>
            არსებული ანალიტიკა და პიქსელები ერთ სივრცეში. შენახვის შემდეგ საიტის
            ხელახლა გამოქვეყნება საჭირო არ არის.
          </p>
          <fieldset disabled={busy}>
            {(
              [
                [
                  'googleId',
                  'googleEnabled',
                  'Google Analytics',
                  'Measurement ID',
                  'G-9S8J0W7QXM',
                ],
                [
                  'yandexId',
                  'yandexEnabled',
                  'Yandex Metrika',
                  'Counter ID',
                  '112737833',
                ],
                ['topGeId', 'topGeEnabled', 'Top.ge', 'Site ID', '118973'],
              ] as const
            ).map(([id, enabled, title, label, placeholder]) => (
              <section className="tracking-card ds-card" key={id}>
                <header>
                  <h2>{title}</h2>
                  <span className="ds-badge">
                    {saved?.settings[enabled] ? 'ჩართულია' : 'გამორთულია'}
                  </span>
                </header>
                <label className="tracking-toggle">
                  <input
                    type="checkbox"
                    checked={record.settings[enabled]}
                    onChange={(e) => {
                      setRecord({
                        ...record,
                        settings: {
                          ...record.settings,
                          [enabled]: e.target.checked,
                        },
                      });
                      setMessage('');
                    }}
                  />
                  ჩართვა
                </label>
                <label className="tracking-field">
                  {label}
                  <input
                    className="ds-input"
                    value={record.settings[id]}
                    placeholder={placeholder}
                    maxLength={40}
                    onChange={(e) => {
                      setRecord({
                        ...record,
                        settings: { ...record.settings, [id]: e.target.value },
                      });
                      setMessage('');
                    }}
                  />
                </label>
              </section>
            ))}
            <section className="tracking-card ds-card">
              <header>
                <h2>Custom code · პიქსელები</h2>
                <span className="ds-badge">
                  {saved?.settings.customEnabled ? 'ჩართულია' : 'გამორთულია'}
                </span>
              </header>
              <label className="tracking-toggle">
                <input
                  type="checkbox"
                  checked={record.settings.customEnabled}
                  onChange={(e) => {
                    setRecord({
                      ...record,
                      settings: {
                        ...record.settings,
                        customEnabled: e.target.checked,
                      },
                    });
                    setMessage('');
                  }}
                />
                ჩართვა
              </label>
              <label className="tracking-field">
                HTML / JavaScript
                <textarea
                  className="ds-input tracking-code"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  rows={18}
                  maxLength={50000}
                  value={record.settings.customHtml}
                  onChange={(e) => {
                    setRecord({
                      ...record,
                      settings: {
                        ...record.settings,
                        customHtml: e.target.value,
                      },
                    });
                    setMessage('');
                  }}
                />
              </label>
              <p>
                ჩასვი სრული კოდი, მათ შორის &lt;script&gt; ტეგები. შესაძლებელია
                რამდენიმე პიქსელის დამატება. Google და Yandex კოდები ზემოთ
                იმართება — აქ მათი გამეორება საჭირო არ არის.
              </p>
              <p>
                კოდი სრულდება საჯარო საიტზე, დოკუმენტის ჩატვირთვისას ერთხელ.
                ადმინში მხოლოდ ტექსტი ჩანს; JavaScript-ის გარეშე ეს კოდი არ
                იტვირთება.
              </p>
            </section>
          </fieldset>
          <div className="tracking-actions">
            <button
              className="ds-btn ds-btn--primary"
              disabled={busy || !dirty}
            >
              {busy ? 'ინახება…' : 'ცვლილებების შენახვა'}
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--secondary"
              disabled={busy || !dirty}
              onClick={() => {
                setRecord(saved);
                setError('');
                setMessage('');
              }}
            >
              გაუქმება
            </button>
            <output>
              {dirty
                ? 'შეუნახავი ცვლილებები'
                : message || 'ყველა ცვლილება შენახულია'}
            </output>
          </div>
        </form>
      )}
    </div>
  );
}
