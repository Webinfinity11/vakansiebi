'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { Brand } from '../job-board';
export default function Login() {
  const [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <Brand />
      <form
        className="login-box"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const r = await fetch('/api/admin/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            window.location.assign('/admin');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ShieldCheck size={20} aria-hidden="true" />
        <h1>ადმინის სივრცე</h1>
        <p>წყაროების, ვაკანსიებისა და გამოქვეყნების მართვა.</p>
        <label>
          პაროლი
          <input
            className="ds-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={256}
          />
        </label>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <button className="ds-btn ds-btn--primary" disabled={busy}>
          {busy && <span className="ds-spinner" aria-hidden="true" />}
          {busy ? 'შესვლა…' : 'შესვლა'}
        </button>
        <Link href="/" className="ds-btn ds-btn--ghost ds-btn--sm login-back">
          <ChevronLeft size={16} aria-hidden="true" />
          ვაკანსიებზე დაბრუნება
        </Link>
      </form>
    </main>
  );
}
