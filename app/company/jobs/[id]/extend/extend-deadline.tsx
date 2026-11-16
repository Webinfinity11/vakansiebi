'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatDeadlineDate } from '@/lib/notification-emails';
import { StatusMark } from '../../../status-mark';
import './extend.css';
export function ExtendDeadline({ job }: { job: { id: string; title: string; deadline: string; reason: string } }) {
  const [deadline, setDeadline] = useState(job.deadline);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function extend() {
    setBusy(true); setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch('/api/company/jobs/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) window.location.reload();
        setError(result.error || 'მოქმედება ვერ შესრულდა');
        return;
      }
      setDeadline(result.deadline); setDone(true);
    } catch { setError('ვერ შეინახა. სცადეთ ხელახლა.'); }
    finally { clearTimeout(timeout); setBusy(false); }
  }
  return <main className="cp-extend"><Link href="/company">კომპანიის სივრცე</Link>
    <section className="cp-extend-card">
      <h1>ვადის გაგრძელება</h1><h2>{job.title}</h2>
      <p>{done ? 'ახალი ვადა' : 'ახლანდელი ვადა'}: <strong>{deadline ? formatDeadlineDate(deadline, true) : 'მითითებული არ არის'}</strong></p>
      {done ? <p role="status"><StatusMark kind="published">ვადა გაგრძელებულია</StatusMark></p> : job.reason ? <p>{job.reason}</p> :
        <button className="cp-btn cp-btn--primary" disabled={busy} onClick={() => void extend()}>{busy ? 'ინახება…' : 'ვადის გაგრძელება 30 დღით'}</button>}
      {error && <p className="cp-alert" role="alert">{error}</p>}
      {(job.reason || error) && !done && <p><Link href={`/company/jobs/${job.id}/edit`}>ვაკანსიის რედაქტირება</Link></p>}
      <p><Link href="/company">ვაკანსიების სიაზე დაბრუნება</Link></p>
    </section>
  </main>;
}
