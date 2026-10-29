'use client';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import type { SearchFilters } from '@/lib/personal-space';
import { useUi } from './ui-language';
import './job-alerts.css';

export function JobAlertSignup({ filters }: { filters: SearchFilters }) {
  const { ui } = useUi();
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/job-alerts', { signal: controller.signal })
      .then((r) => r.json())
      .then((b) => setEnabled(b.enabled === true))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!enabled) return null;
  return (
    <details className="job-alert-signup">
      <summary>
        <Bell size={16} aria-hidden="true" />
        {ui('ახალი ვაკანსიების გამოწერა')}
      </summary>
      {done ? (
        <output>
          {ui(
            'მოთხოვნა მიღებულია. თუ გამოწერა ჯერ არ დაგიდასტურებია, ელფოსტაზე მოსულ ბმულს მიჰყევი. შეამოწმე სპამის საქაღალდეც.',
          )}
        </output>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const response = await fetch('/api/job-alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, filters }),
              });
              const body = await response.json();
              if (!response.ok) throw Error(body.error);
              setDone(true);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'ოპერაცია ვერ შესრულდა. სცადე ხელახლა.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {ui(
              'არჩეული საძიებო პირობებით ახალ ვაკანსიებს ყოველდღე მიიღებ. გამოწერის გაუქმება ნებისმიერ დროს შეგიძლია.',
            )}
          </p>
          <label>
            {ui('ელფოსტა')}
            <input
              className="ds-input"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="ds-btn ds-btn--primary"
            disabled={busy}
          >
            {ui(busy ? 'იგზავნება…' : 'გამოწერა')}
          </button>
          {error && <p role="alert">{ui(error)}</p>}
        </form>
      )}
    </details>
  );
}
