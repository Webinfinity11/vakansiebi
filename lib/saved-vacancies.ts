export const savedVacanciesKey = 'ertad-saved';
const changed = 'ertad-saved-changed';
const limit = 100;
export const savedLimitMessage =
  'უკვე შენახულია 100 ვაკანსია. ახლის დასამატებლად ერთი მოხსენი; ძველი ჩანაწერები არ წაშლილა.';
type SavedStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readSavedVacancies(
  storage: Pick<Storage, 'getItem'>,
): string[] {
  const value: unknown = JSON.parse(storage.getItem(savedVacanciesKey) || '[]');
  // An unreadable value must not be overwritten by an empty in-memory list.
  if (!Array.isArray(value)) throw new Error('Invalid saved vacancies');
  return [
    ...new Set(
      value.filter(
        (id): id is string =>
          typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id),
      ),
    ),
  ];
}

export function updateSavedVacancies(
  storage: SavedStorage,
  id: string,
  desired?: boolean,
) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid vacancy id');
  // Read at write time: a component's snapshot may predate another tab's save.
  const ids = readSavedVacancies(storage);
  const wasSaved = ids.includes(id);
  const saved = desired ?? !wasSaved;
  if (saved && !wasSaved && ids.length >= limit)
    return { ids, wasSaved, saved: false, limited: true };
  const next = saved
    ? wasSaved
      ? ids
      : [...ids, id]
    : ids.filter((value) => value !== id);
  storage.setItem(savedVacanciesKey, JSON.stringify(next));
  return { ids: next, wasSaved, saved, limited: false };
}

export async function changeSavedVacancy(id: string, desired?: boolean) {
  const update = () => {
    const result = updateSavedVacancies(window.localStorage, id, desired);
    window.dispatchEvent(new Event(changed));
    return result;
  };
  // Serialize simultaneous writes across tabs where Web Locks is available.
  return navigator.locks
    ? navigator.locks.request(savedVacanciesKey, update)
    : update();
}

export function subscribeSavedVacancies(read: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === savedVacanciesKey || event.key === null) read();
  };
  window.addEventListener('storage', storage);
  window.addEventListener(changed, read);
  window.addEventListener('pageshow', read);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(changed, read);
    window.removeEventListener('pageshow', read);
  };
}
