import type { Source } from './types';
export function sourceHealth(source: Source, now: number) {
  if (!source.enabled) return { tone: 'muted', label: 'წყარო გამორთულია' };
  const latest = source.latest_run;
  if (latest?.status === 'running') {
    if (now - Date.parse(latest.started_at) < 25 * 60_000)
      return { tone: 'blue', label: 'მუშავდება' };
    return { tone: 'amber', label: 'გაშვება შესამოწმებელია' };
  }
  if (source.requested_at) return { tone: 'blue', label: 'გაშვების რიგშია' };
  if (!source.auto_enabled)
    return { tone: 'muted', label: 'ავტომატური ძებნა შეჩერებულია' };
  if (latest?.status === 'deferred')
    return { tone: 'amber', label: 'წყარო მიუწვდომელია · ხელახლა ვცდით' };
  if (latest?.status === 'failed')
    return { tone: 'amber', label: 'შემოწმება ვერ დასრულდა' };
  if (source.last_error || source.refresh_retrying || source.quality_held)
    return { tone: 'amber', label: 'მუშაობს · ნაწილის გამეორება საჭიროა' };
  if (now - Date.parse(source.next_run_at) > 90 * 60_000)
    return { tone: 'amber', label: 'განახლება დაგვიანებულია' };
  return { tone: 'green', label: 'ავტომატური ძებნა ჩართულია' };
}
