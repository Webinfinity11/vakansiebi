'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, CheckCircle2, Search } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import type { EmployerCandidate, EmployerName } from '@/lib/server/employers';

type EmployerPageSummary = { slug: string; name: string; count: number };

/* Near spellings the automatic identity cannot prove are one employer. A person answers once;
   a merge then applies to every spelling of both sides, and "separate" stops the question. */
export function EmployersPanel() {
  const [state, setState] = useState<{
    rows?: EmployerCandidate[];
    error?: string;
  } | null>(null);
  const [pages, setPages] = useState<EmployerPageSummary[]>([]);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/employers', { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error || 'სია ვერ ჩაიტვირთა');
        setState({ rows: body.candidates });
        setPages(body.pages || []);
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
        მსგავსი სახელები, რომლებიც შეიძლება ერთი დამსაქმებელი იყოს. ავტომატურად
        არაფერი ერთიანდება — ერთი პასუხი ყველა მართლწერას ეხება.
      </p>
      {state?.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {!!pages.length && (
        <details className="raw-details">
          <summary>
            <ChevronDown className="admin-summary-mark" aria-hidden="true" />
            საკუთარი გვერდის მქონე დამსაქმებლები ({pages.length})
          </summary>
          <ol className="admin-employer-pages">
            {pages.map((p) => (
              <li key={p.slug}>
                <a
                  href={`/companies/${encodeURIComponent(p.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {p.name}
                </a>
                <b>{p.count}</b>
              </li>
            ))}
          </ol>
        </details>
      )}
      {!state ? (
        <SkeletonRows rows={4} block label="კომპანიები იტვირთება" />
      ) : !state.rows ? null : !state.rows.length ? (
        <div className="empty">
          <CheckCircle2 size={20} aria-hidden="true" />
          <h3>შესამოწმებელი სახელი არ არის</h3>
          <p>მსგავსი მართლწერის ახალი წყვილი გამოჩენისთანავე აქ დაემატება.</p>
        </div>
      ) : (
        <>
          <div className="admin-search">
            <Search size={16} />
            <input
              aria-label="დამსაქმებლის სახელით გაფილტვრა"
              placeholder="სახელით გაფილტვრა"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <FilteredEmployerList
            rows={state.rows}
            query={query}
            busy={busy}
            decide={decide}
          />
        </>
      )}
    </section>
  );
}

function FilteredEmployerList({
  rows,
  query,
  busy,
  decide,
}: {
  rows: EmployerCandidate[];
  query: string;
  busy: string;
  decide: (
    row: EmployerCandidate,
    decision: 'merge' | 'separate',
  ) => Promise<void>;
}) {
  const needle = query.trim().toLowerCase();
  const matches = (names: EmployerName[]) =>
    names.some((n) => n.name.toLowerCase().includes(needle));
  const visible = needle
    ? rows.filter((row) => matches(row.left) || matches(row.right))
    : rows;
  return !visible.length ? (
    <p className="admin-analytics-empty">ვერაფერი მოიძებნა.</p>
  ) : (
    <ol className="admin-employer-list">
      {visible.map((row) => {
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
                className="ds-btn ds-btn--secondary ds-btn--sm"
                disabled={Boolean(busy)}
                onClick={() => void decide(row, 'merge')}
              >
                ერთი კომპანიაა
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--secondary ds-btn--sm"
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
