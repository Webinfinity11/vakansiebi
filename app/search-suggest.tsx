/* oxlint-disable jsx-a11y/prefer-tag-over-role -- a combobox listbox: the native
   <select>/<option> the rule prefers cannot float under a free-text input. */
'use client';
import './search-features.css';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Suggestion } from '@/lib/server/suggest';

/* Session-local memo of prefix → suggestions; the route also allows a minute of
   HTTP caching, this only spares repeated keystrokes their round trip. */
const memo = new Map<string, Suggestion[]>();
function remember(key: string, value: Suggestion[]) {
  if (memo.size >= 50) memo.delete(memo.keys().next().value as string);
  memo.set(key, value);
}
function highlight(value: string, query: string) {
  const at = value.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return value;
  return (
    <>
      {value.slice(0, at)}
      <mark>{value.slice(at, at + query.length)}</mark>
      {value.slice(at + query.length)}
    </>
  );
}
export function SearchSuggest({
  query,
  inputRef,
  onPick,
  listId,
}: {
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onPick: (value: string) => void;
  listId: string;
}) {
  const [result, setResult] = useState<{
    key: string;
    list: Suggestion[];
  } | null>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState('');
  // The highlighted row belongs to one query; typing on resets it without an effect.
  const [cursor, setCursor] = useState({ key: '', index: -1 });
  const trimmed = query.trim().replace(/\s+/g, ' ');
  const key = trimmed.toLowerCase();
  const items: Suggestion[] =
    trimmed.length < 2
      ? []
      : result?.key === key
        ? result.list
        : (memo.get(key) ?? []);
  const active = cursor.key === key ? cursor.index : -1;
  const setActive = (index: number) => setCursor({ key, index });
  const open =
    focused &&
    trimmed.length >= 2 &&
    dismissed !== trimmed &&
    items.length > 0 &&
    !(
      items.length === 1 &&
      items[0].value.toLowerCase() === trimmed.toLowerCase()
    );
  // The keydown listener is attached once; it reads the current query state here.
  const latest = useRef({ items, active, open, onPick, key });
  useEffect(() => {
    latest.current = { items, active, open, onPick, key };
  });

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    let blurTimer = 0;
    const onFocus = () => {
      window.clearTimeout(blurTimer);
      setFocused(true);
    };
    const onBlur = () => {
      blurTimer = window.setTimeout(() => setFocused(false), 120);
    };
    const onKey = (event: KeyboardEvent) => {
      const state = latest.current;
      const move = (index: number) => setCursor({ key: state.key, index });
      if (event.key === 'Escape') {
        if (state.open) event.preventDefault();
        setDismissed(input.value.trim().replace(/\s+/g, ' '));
        move(-1);
        return;
      }
      if (!state.open) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        move((state.active + 1) % state.items.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(state.active <= 0 ? state.items.length - 1 : state.active - 1);
      } else if (event.key === 'Enter' && state.active >= 0) {
        event.preventDefault();
        state.onPick(state.items[state.active].value);
        move(-1);
      }
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(blurTimer);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKey);
    };
  }, [inputRef]);

  useEffect(() => {
    if (trimmed.length < 2 || memo.has(key)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch('/api/suggest?q=' + encodeURIComponent(trimmed), {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((d) => {
          if (controller.signal.aborted) return;
          const list: Suggestion[] = Array.isArray(d.suggestions)
            ? d.suggestions
            : [];
          remember(key, list);
          setResult({ key, list });
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, key]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) input.setAttribute('aria-controls', listId);
    else input.removeAttribute('aria-controls');
    if (open && active >= 0)
      input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }, [inputRef, open, active, listId]);

  if (!open) return null;
  // A combobox listbox: aria-activedescendant on the input points at these ids.
  // The native <option> the linter prefers cannot live outside a <select>.
  return (
    <div className="search-suggest">
      <div role="listbox" id={listId} aria-label="შემოთავაზებები">
        {items.map((s, i) => (
          <button
            key={s.kind + s.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            aria-label={`${s.value} — ${s.kind === 'company' ? 'კომპანია' : 'პოზიცია'}, ${s.count}`}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => {
              onPick(s.value);
              setActive(-1);
            }}
          >
            <span className="suggest-value">{highlight(s.value, trimmed)}</span>
            <small className="suggest-meta">
              {s.kind === 'company' ? 'კომპანია' : 'პოზიცია'} · {s.count}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
