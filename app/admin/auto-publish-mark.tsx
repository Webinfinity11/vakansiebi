'use client';
import { useState } from 'react';

export type AutoPublishedJob = { autoPublished?: { at: string | null; reviewed: string | null } };
export function AutoPublishMark({ id, value }: { id: string; value: AutoPublishedJob['autoPublished'] }) {
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');
  if (!value?.at || value.reviewed || reviewed) return null;
  async function review() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/jobs/auto-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'მოქმედება ვერ შესრულდა');
      setReviewed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'მოქმედება ვერ შესრულდა');
    } finally { setBusy(false); }
  }
  return <div className="admin-auto-publish">
    <span>ავტომატურად გამოქვეყნდა — გადახედეთ</span>
    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={busy} onClick={() => void review()}>{busy ? 'ინახება…' : 'გადახედილია'}</button>
    {error && <small role="alert">{error}</small>}
  </div>;
}
