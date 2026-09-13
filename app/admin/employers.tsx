'use client';
import { useEffect, useState } from 'react';
import type { EmployerCandidate, EmployerName } from '@/lib/server/employers';

/* Near spellings the automatic identity cannot prove are one employer. A person answers once;
   a merge then applies to every spelling of both sides, and "separate" stops the question. */
export function EmployersPanel() {
  const [state, setState] = useState<{
    rows?: EmployerCandidate[];
    error?: string;
  } | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/employers', { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error || 'სია ვერ ჩაიტვირთა');
        setState({ rows: body.candidates });
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setState({ error: String(e.message || e) });
      });
    return () => controller.abort();
  }, []);
  const decide = async (
    row: EmployerCandidate,
    decision: 'merge' | 'separate',
  ) => {
    const key = `${row.a}\n${row.b}`;
    setBusy(key);
    try {
      const r = await fetch('/api/admin/employers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: row.a, b: row.b, decision }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error || 'პასუხი ვერ შეინახა');
      setState((s) => ({
        rows: s?.rows?.filter((x) => `${x.a}\n${x.b}` !== key),
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="admin-analytics">
      <p className="admin-analytics-note">
        მსგავსი სახელები, რომლებიც შეილება ერთი დამსაქმებელი იყოს. ავტომატურად
        არაფერი ერთიანდება — ერთი პასუხი ყველ მართლწერას ეხება.
      </p>
      {state?.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {!state ? (
        <p>იტვირთება…</p>
      ) : !state.rows ? null : !state.rows.length ? (
        <p className="admin-analytics-empty">
          ახლა შესამოწმებელი არაფერი არის.
        </p>
      ) : (
        <ol className="admin-employer-list">
          {state.rows.map((row) => {
            const key = `${row.a}\n${row.b}`;
            return (
              <li key={key}>
                <Names names={row.left} />
                <span className="admin-employer-vs" aria-hidden="true">
                  ≈
                </span>
                <Names names={row.right} />
                <span className="admin-employer-actions">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void decide(row, 'merge')}
                  >
                    ერთი კომპანიაა
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void decide(row, 'separate')}
                  >
                    სხვადასხვაა
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Names({ names }: { names: EmployerName[] }) {
  return (
    <span className="admin-employer-names">
      {names.map((n) => (
        <span key={n.name}>
          {n.name} <b>{n.count}</b>
        </span>
      ))}
    </span>
  );
}
