import type { Source } from './types';

/* What the admin panel should say without being read like a table. The source
   list already holds every fact; what it has never done is draw a conclusion —
   which source stopped, which is jammed, which is asking to be left alone for a
   while — or say what to do about it. Three days of a government source going
   uncollected, and every scraper run red for a week, both sat in plain sight in
   those tables. */
export type Attention = {
  id: string;
  severity: 'stopped' | 'stuck' | 'tired' | 'note';
  title: string;
  detail: string;
  advice: string;
  /* The panel already knows how to run, retry and configure a source; a finding
     only names which of those its fix is. */
  action?: { label: string; source: string; kind: 'run' | 'retry' | 'rest' };
};

/* The two government hosts time out from every GitHub runner and are collected
   from the office Mac instead (README). A silence here is a machine that was
   asleep, not a source that broke. */
export const locallyCollected = ['vacancy.hr.gov.ge', 'worknet.moh.gov.ge'];

const hours = (ms: number) => ms / 3600000;
const since = (value: string | null, now: number) =>
  value ? hours(now - Date.parse(value)) : Infinity;
export function whenText(h: number) {
  if (!Number.isFinite(h)) return 'არასდროს';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} წუთის წინ`;
  if (h < 48) return `${Math.round(h)} საათის წინ`;
  return `${Math.round(h / 24)} დღის წინ`;
}

export function attentionList(
  sources: Source[],
  now = Date.now(),
): Attention[] {
  const found: Attention[] = [];
  for (const source of sources) {
    if (!source.enabled) {
      found.push({
        id: `${source.id}:off`,
        severity: 'note',
        title: `${source.name} — გამორთულია`,
        detail: 'ამ წყაროდან ვაკანსიები არ შემოდის.',
        advice: 'თუ განზრახ არაა გამორთული, ჩართე წყაროების ჩანართში.',
      });
      continue;
    }
    const ok = since(source.last_success_at, now);
    const every = hours((source.interval_minutes || 180) * 60000);
    const local = locallyCollected.includes(source.name);
    const running =
      source.latest_run?.status === 'running' &&
      now - Date.parse(source.latest_run.started_at) > 25 * 60000;
    // A request that no run has picked up: the scheduler is not reaching it.
    const unclaimed = since(source.requested_at, now) > 3;

    if (ok > Math.max(3 * every, 6)) {
      found.push({
        id: `${source.id}:stopped`,
        severity: 'stopped',
        title: `${source.name} — გაჩერდა`,
        detail: `ბოლო წარმატებული შემოწმება ${whenText(ok)}; განრიგით ყოველ ${Math.round(every)} საათში უნდა მოწმდებოდეს.`,
        advice: local
          ? 'ამ წყაროს ეს კომპიუტერი კრებს. გახსენი ტერმინალი და გაუშვი `npm run worker:gov` — ის ყოველ 3 საათში გაიმეორებს, სანამ ფანჯარა ღიაა.'
          : 'დააჭირე „შემოწმებას". თუ მაინც არ შემოდის, წყარო შესაძლოა მისამართს ან გვერდის აგებულებას ცვლიდეს.',
        ...(local
          ? {}
          : {
              action: {
                label: 'შემოწმება',
                source: source.id,
                kind: 'run' as const,
              },
            }),
      });
      continue;
    }
    if (running || (source.requested_at && unclaimed)) {
      found.push({
        id: `${source.id}:stuck`,
        severity: 'stuck',
        title: `${source.name} — ჩაიჭედა`,
        detail: running
          ? `გაშვება ${whenText(since(source.latest_run?.started_at ?? null, now))} დაიწყო და ჯერ არ დასრულებულა.`
          : `შემოწმება ${whenText(since(source.requested_at, now))} მოვითხოვეთ და ჯერ არავის აუღია.`,
        advice:
          'ერთი გაშვება 35 წუთზე მეტს არ უნდა ჭირდებოდეს. სცადე ხელახლა; თუ მეორედაც გაიჭედა, წყარო ნელა პასუხობს და ინტერვალი უნდა გაიზარდოს.',
        action: { label: 'ხელახლა', source: source.id, kind: 'retry' },
      });
      continue;
    }
    if (source.consecutive_failures >= 3) {
      found.push({
        id: `${source.id}:tired`,
        severity: 'tired',
        title: `${source.name} — დასვენება სჭირდება`,
        detail:
          `ზედიზედ ${source.consecutive_failures} შემოწმება ვერ დასრულდა. ${source.last_error || ''}`.trim(),
        advice:
          'წყარო ალბათ ზღუდავს ჩვენს მოთხოვნებს. გაზარდე ინტერვალი ან შეამცირე პარტიის ზომა წყაროს პარამეტრებში, სანამ დამშვიდდება.',
        action: {
          label: 'შესვენება — ინტერვალის გაზრდა',
          source: source.id,
          kind: 'rest',
        },
      });
      continue;
    }
    if ((source.quality_held ?? 0) > 0)
      found.push({
        id: `${source.id}:quality`,
        severity: 'note',
        title: `${source.name} — ${source.quality_held} ჩანაწერი შემოწმებას ელოდება`,
        detail:
          'ტექსტი წყაროზე შეიცვალა ისე, რომ ავტომატურად გამოქვეყნება სარისკოა.',
        advice: 'გადახედე „შემოტანის ისტორიაში" და დაადასტურე ან უარყავი.',
      });
    if ((source.queued ?? 0) > (source.batch_limit ?? 200) * 3)
      found.push({
        id: `${source.id}:backlog`,
        severity: 'note',
        title: `${source.name} — რიგი დაგროვდა (${source.queued})`,
        detail: `ერთ გაშვებაზე ${source.batch_limit ?? 200} მუშავდება, ანუ რიგის ამოწურვას რამდენიმე დღე დასჭირდება.`,
        advice:
          'თუ ვაკანსიები ნელა ჩნდება, გაზარდე პარტიის ზომა ან შეამცირე ინტერვალი.',
      });
  }
  const order = { stopped: 0, stuck: 1, tired: 2, note: 3 };
  return found.sort((a, b) => order[a.severity] - order[b.severity]);
}
