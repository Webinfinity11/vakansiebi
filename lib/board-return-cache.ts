import type { PublicJob } from './types';
import type { SearchMeta } from './server/search-plan';

type Snapshot = {
  key: string;
  page: number;
  through: number;
  path: string;
  jobs: PublicJob[];
  total: number;
  pages: number;
  search: SearchMeta | null;
  companyLinksPending?: boolean;
};
export type BoardInitial = Omit<
  Snapshot,
  'through' | 'path' | 'companyLinksPending'
> & {
  companyLinksPending: boolean;
};
// One short-lived snapshot in memory, never a growing browser-storage archive.
let cached: { at: number; value: Snapshot } | null = null;
export function rememberBoard(value: Snapshot, now = Date.now()) {
  cached = value.jobs.length <= 1000 ? { at: now, value } : null;
}
export function takeBoard(key: string, page: number, now = Date.now()) {
  const value = cached;
  if (
    !value ||
    now - value.at > 120000 ||
    value.value.key !== key ||
    value.value.page !== page
  )
    return null;
  cached = null;
  return value.value;
}
export function clearBoard() {
  cached = null;
}
