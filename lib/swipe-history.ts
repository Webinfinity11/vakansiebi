import type { CvStorage } from './cv';

/* What this browser has already sent from /swipe, so a vacancy is offered once
   and the reader can see where their CV went. Kept locally, like saved
   vacancies; the server keeps its own record for the once-per-vacancy rule. */
export const swipeHistoryKey = 'jobx-swipe-sent-v1';
export const swipeApplicantKey = 'jobx-swipe-applicant-v1';
const historyLimit = 200;

export type SwipeSent = {
  id: string;
  title: string;
  company: string;
  to: string;
  at: string;
};
export type SwipeApplicant = { name: string; email: string; phone: string };

export function readSwipeHistory(storage: CvStorage): SwipeSent[] {
  try {
    const raw = JSON.parse(storage.getItem(swipeHistoryKey) || '[]');
    return Array.isArray(raw)
      ? raw.filter(
          (item): item is SwipeSent =>
            item &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            typeof item.at === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export function recordSwipeSent(storage: CvStorage, entry: SwipeSent) {
  const next = [
    entry,
    ...readSwipeHistory(storage).filter((item) => item.id !== entry.id),
  ].slice(0, historyLimit);
  try {
    storage.setItem(swipeHistoryKey, JSON.stringify(next));
  } catch {}
  return next;
}

export function readSwipeApplicant(storage: CvStorage): SwipeApplicant | null {
  try {
    const raw = JSON.parse(storage.getItem(swipeApplicantKey) || 'null');
    return raw && typeof raw.email === 'string'
      ? {
          name: String(raw.name ?? ''),
          email: raw.email,
          phone: String(raw.phone ?? ''),
        }
      : null;
  } catch {
    return null;
  }
}

export function writeSwipeApplicant(
  storage: CvStorage,
  applicant: SwipeApplicant,
) {
  try {
    storage.setItem(swipeApplicantKey, JSON.stringify(applicant));
  } catch {}
}

/* Filters changed inside /swipe replace its URL, so the browser's Back still
   holds the list's old address. The deck leaves the new filters here and the
   list picks them up once, when it opens with the address the deck came from. */
const swipeFiltersKey = 'jobx-swipe-filters';
const swipeFiltersAge = 30 * 60 * 1000;

export function rememberSwipeFilters(
  storage: CvStorage,
  from: string,
  to: string,
) {
  try {
    storage.setItem(
      swipeFiltersKey,
      JSON.stringify({ from, to, at: Date.now() }),
    );
  } catch {}
}

export function takeSwipeFilters(
  storage: CvStorage,
  current: string,
): string | null {
  try {
    const raw = JSON.parse(storage.getItem(swipeFiltersKey) || 'null');
    storage.removeItem(swipeFiltersKey);
    if (
      !raw ||
      typeof raw.from !== 'string' ||
      typeof raw.to !== 'string' ||
      typeof raw.at !== 'number' ||
      Date.now() - raw.at > swipeFiltersAge ||
      raw.from !== current ||
      raw.to === current
    )
      return null;
    return raw.to;
  } catch {
    return null;
  }
}
