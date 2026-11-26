// How the admin reads a company account: time since, password and vacancy state.
import type { CompanyAccount, CompanyAccountJob } from './company-portal';

export const day = 86_400_000;
/** "დღეს", "გუშინ", "5 დღის წინ", or a date for anything older than a month. */
export function since(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((now - t) / day);
  if (days <= 0) return 'დღეს';
  if (days === 1) return 'გუშინ';
  if (days < 31) return `${days} დღის წინ`;
  return new Date(t).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' });
}
/** Whether the company has set its own password yet. */
export function passwordState(a: Pick<CompanyAccount, 'must_change_password' | 'passwordChangedAt'>) {
  if (a.must_change_password) return 'დროებითი — ჯერ არ შეუცვლია';
  if (a.passwordChangedAt) return `შეცვალა ${since(a.passwordChangedAt)}`;
  return 'ადმინის მიცემული';
}
export function jobState(j: Pick<CompanyAccountJob, 'status' | 'deadline'>, today = new Date().toISOString().slice(0, 10)): [string, 'ok' | 'wait' | 'off'] {
  if (j.status === 'pending') return ['მოლოდინში', 'wait'];
  if (j.status !== 'published') return ['მოხსნილი', 'off'];
  return j.deadline && j.deadline < today ? ['ვადაგასული', 'off'] : ['აქტიური', 'ok'];
}

