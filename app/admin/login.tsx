'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
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
        <ShieldCheck size={34} />
        <h1>ადმინის სივრცე</h1>
        <p>წყაროების, ვაკანსიებისა და გამოქვეყნების მართვა.</p>
        <label>
          პაროლი
          <input
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
        <button className="primary" disabled={busy}>
          {busy ? 'შესვლა…' : 'შესვლა'}
        </button>
        <Link href="/">
          <ArrowLeft size={15} /> ვაკანსიებზე დაბრუნება
        </Link>
      </form>
    </main>
  );
}
