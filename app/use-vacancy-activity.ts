'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  readActivity,
  recentLimit,
  type VacancyActivity,
} from '@/lib/vacancy-activity';
const key = 'ertad-vacancy-activity';
const changed = 'ertad-vacancy-activity-changed';
const empty: VacancyActivity = { seen: [], hidden: [], recent: [] };
function update(change: (state: VacancyActivity) => VacancyActivity) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(change(readActivity(localStorage.getItem(key)))),
    );
    window.dispatchEvent(new Event(changed));
    return true;
  } catch {
    return false;
  }
}
export function useVacancyActivity() {
  const [state, setState] = useState<VacancyActivity>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setState(readActivity(localStorage.getItem(key)));
      } catch {}
      setReady(true);
    };
    const timer = setTimeout(read, 0);
    window.addEventListener('storage', read);
    window.addEventListener(changed, read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', read);
      window.removeEventListener(changed, read);
    };
  }, []);
  /* Marks a vacancy as seen; with `meta` it also becomes the newest "recently viewed" entry. */
  const markSeen = useCallback(
    (id: string, meta?: { title: string; company: string }) =>
      update((s) => ({
        ...s,
        seen: [...s.seen.filter((v) => v !== id), id].slice(-500),
        recent: meta
          ? [
              {
                id,
                title: meta.title.slice(0, 180),
                company: (meta.company || '').slice(0, 120),
                at: Date.now(),
              },
              ...s.recent.filter((v) => v.id !== id),
            ].slice(0, recentLimit)
          : s.recent,
      })),
    [],
  );
  const clearRecent = useCallback(
    () => update((s) => ({ ...s, recent: [] })),
    [],
  );
  const hide = useCallback(
    (id: string, title: string) =>
      update((s) => ({
        ...s,
        hidden: [
          ...s.hidden.filter((v) => v.id !== id),
          { id, title: title.slice(0, 180) },
        ].slice(-100),
      })),
    [],
  );
  const restore = useCallback(
    (id?: string) =>
      update((s) => ({
        ...s,
        hidden: id ? s.hidden.filter((v) => v.id !== id) : [],
      })),
    [],
  );
  return { ...state, ready, markSeen, clearRecent, hide, restore };
}
