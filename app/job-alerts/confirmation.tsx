'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUi } from '../ui-language';
export function AlertConfirmation({
  token,
  action,
}: {
  token: string;
  action: 'confirm' | 'unsubscribe';
}) {
  const { ui } = useUi();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/job-alerts/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
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
  }
  return (
    <>
      <h1>
        {ui(
          action === 'confirm' ? 'ვაკანსიების გამოწერა' : 'გამოწერის გაუქმება',
        )}
      </h1>
      <p>
        {ui(
          done
            ? action === 'confirm'
              ? 'გამოწერა დადასტურებულია. ახალ ვაკანსიებს ელფოსტაზე ყოველდღიურად მიიღებ.'
              : 'გამოწერა გაუქმებულია. ამ პირობებით ვაკანსიებს აღარ გამოგიგზავნით.'
            : action === 'confirm'
              ? 'დაადასტურე, რომ გსურს არჩეული პირობებით ახალი ვაკანსიების მიღება.'
              : 'ამ პირობებით ახალი ვაკანსიების მიღება აღარ გსურს?',
        )}
      </p>
      {error && <p role="alert">{ui(error)}</p>}
      {!done && token && (
        <button
          className="ds-btn ds-btn--primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {ui(
            busy
              ? 'იგზავნება…'
              : action === 'confirm'
                ? 'გამოწერის დადასტურება'
                : 'გამოწერის გაუქმება',
          )}
        </button>
      )}
      {!token && (
        <p>
          {ui('ბმული არასწორია ან ვადა გაუვიდა. გამოწერა ხელახლა მოითხოვე.')}
        </p>
      )}
      <p>
        <Link href="/">{ui('ვაკანსიების ნახვა')}</Link>
      </p>
    </>
  );
}
