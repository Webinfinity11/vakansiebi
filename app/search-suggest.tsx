/* oxlint-disable jsx-a11y/prefer-tag-over-role -- a combobox listbox: the native
   <select>/<option> the rule prefers cannot float under a free-text input. */
'use client';
import './search-features.css';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { History, Trash2, X } from 'lucide-react';
import type { Suggestion } from '@/lib/server/suggest';
import {
  clearRecentSearches,
  forgetRecentSearch,
  readRecentSearches,
} from '@/lib/recent-searches';

/* Asked for once per session, the first time a reader opens the field. */
let popularOnce: Promise<string[]> | null = null;
function popularTerms() {
  popularOnce ||= fetch('/api/popular-searches')
    .then((r) => (r.ok ? r.json() : { terms: [] }))
    .then((body: { terms?: { label?: unknown }[] }) =>
      (body.terms ?? [])
        .map((t) => t.label)
        .filter((l): l is string => typeof l === 'string'),
    )
    .catch(() => []);
  return popularOnce;
}

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

const phoneQuery = '(max-width: 760px)';
function subscribePhone(onChange: () => void) {
  const media = window.matchMedia(phoneQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const isPhone = () => window.matchMedia(phoneQuery).matches;
const serverIsPhone = () => false;

/* An open search field with nothing typed in it used to show nothing at all,
   which asks the reader to invent a word before the site has offered one. It now
   opens on what they searched before and on the roles this catalogue actually
   answers — one tap instead of one guess. */
function StartPanel({ onPick }: { onPick: (value: string) => void }) {
  const phone = useSyncExternalStore(subscribePhone, isPhone, serverIsPhone);
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => setRecent(readRecentSearches()), 0);
    let live = true;
    void popularTerms().then((terms) => live && setPopular(terms));
    return () => {
      clearTimeout(timer);
      live = false;
    };
  }, []);
  if (!recent.length && !popular.length) return null;
  return (
    <div
      className="search-suggest search-start"
      onPointerDown={(event) => event.preventDefault()}
    >
      {recent.length > 0 && (
        <section className="search-start-recent">
          <header>
            <h2>ბოლოს მოძებნილი</h2>
            <button
              type="button"
              className="ds-btn ds-btn--ghost ds-btn--sm"
              onClick={() => {
                clearRecentSearches();
                setRecent([]);
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> გასუფთავება
            </button>
          </header>
          <ul>
            {recent.slice(0, phone ? 3 : 6).map((value) => (
              <li key={value}>
                <button
                  type="button"
                  className="search-start-term"
                  onClick={() => onPick(value)}
                >
                  <History size={16} aria-hidden="true" />
                  <span>{value}</span>
                </button>
                <button
                  type="button"
                  className="search-start-forget"
                  aria-label={`„${value}" ისტორიიდან წაშლა`}
                  onClick={() => {
                    forgetRecentSearch(value);
                    setRecent(readRecentSearches());
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {popular.length > 0 && (
        <section className="search-start-popular">
          <h2>პოპულარული ძიებები</h2>
          <div className="search-start-chips">
            {popular.slice(0, phone ? 6 : 18).map((value) => (
              <button
                key={value}
                type="button"
                className="ds-chip"
                onClick={() => onPick(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
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
  // The empty-field panel is dismissed on its own: it belongs to no query.
  const [startClosed, setStartClosed] = useState(false);
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
      setStartClosed(false);
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
        setStartClosed(true);
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
        .then(async (response) => {
          /* Only an answer is worth remembering. The endpoint refuses a request when it is
             busy, and memoising that refusal as "this prefix has no suggestions" would keep
             the panel empty for the rest of the session; the next keystroke asks again. */
          if (!response.ok) return null;
          const body = await response.json();
          return Array.isArray(body.suggestions)
            ? (body.suggestions as Suggestion[])
            : [];
        })
        .then((list) => {
          if (!list || controller.signal.aborted) return;
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

  /* Nothing typed yet: the panel offers a starting point instead of a blank. */
  if (focused && !trimmed && !startClosed)
    return (
      <StartPanel
        onPick={(value) => {
          setStartClosed(true);
          onPick(value);
        }}
      />
    );
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
            aria-label={`${s.value} — ${s.kind === 'company' ? 'კომპანია' : 'პოზიცია'}`}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => {
              onPick(s.value);
              setActive(-1);
            }}
          >
            {/* The frequency of a title in the catalogue is not the number of
                vacancies the suggestion leads to — a search for it also matches
                longer titles — so the count was read as a promise the results
                page then broke. The list stays a list of words. */}
            <span className="suggest-value">{highlight(s.value, trimmed)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
