'use client';
import { useCallback, useEffect, useState } from 'react';
import { readActivity, type VacancyActivity } from '@/lib/vacancy-activity';
const key = 'ertad-vacancy-activity';
const changed = 'ertad-vacancy-activity-changed';
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
  const [state, setState] = useState<VacancyActivity>({ seen: [], hidden: [] });
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
  const markSeen = useCallback(
    (id: string) =>
      update((s) => ({
        ...s,
        seen: [...s.seen.filter((v) => v !== id), id].slice(-500),
      })),
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
  return { ...state, ready, markSeen, hide, restore };
}
