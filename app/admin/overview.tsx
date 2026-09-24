'use client';
import { useEffect, useState } from 'react';
import {
  CircleAlert,
  Clock3,
  Flag,
  Inbox,
  Pause,
  RefreshCw,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import {
  attentionList,
  locallyCollected,
  whenText,
  type Attention,
} from '@/lib/admin-attention';
import { sourceHealth } from '@/lib/scraper-status';
import { listingSourceNames, type Source } from '@/lib/types';
import type { OverviewPeriod } from '@/lib/server/admin-overview';
import { RecentChanges } from './history';

type Overview = {
  days: OverviewPeriod;
  imported: {
    now: number;
    before: number;
    series: { day: string; count: number }[];
  };
  archived: { now: number; before: number; expired: number; removed: number };
  submissions: { now: number; before: number; waiting: number };
  revenue: { now: number; before: number; awaiting: number };
};
const periods: [OverviewPeriod, string][] = [
  [1, 'დღეს'],
  [7, '7 დღე'],
  [30, '30 დღე'],
];
const whole = new Intl.NumberFormat('ka-GE');
const hours = (value: string | null, now: number) =>
  value ? (now - Date.parse(value)) / 3600000 : Infinity;

/* Against the window before it, in words a person reads at a glance. */
function Change({ now, before }: { now: number; before: number }) {
  if (!now && !before) return <small>ჯერ არაფერი</small>;
  const diff = now - before;
  if (!diff) return <small>წინა პერიოდის ტოლი</small>;
  return (
    <small>
      <b className={diff > 0 ? 'up' : 'down'}>
        {diff > 0 ? '+' : '−'}
        {whole.format(Math.abs(diff))}
      </b>{' '}
      წინა პერიოდთან
    </small>
  );
}

function Spark({ values, alert }: { values: number[]; alert?: boolean }) {
  if (values.length < 2 || !values.some(Boolean)) return null;
  const top = Math.max(...values);
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * 100).toFixed(1)},${(24 - (v / top) * 20).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={alert ? '#c8322b' : '#2457e6'}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type Item = {
  id: string;
  tone: 'crit' | 'warn';
  icon: LucideIcon;
  title: string;
  detail: string;
  chips?: string[];
  action?: { label: string; run: () => void; primary?: boolean };
};

/* The findings, grouped so seven stopped scrapers read as one problem with one button, and the
   queue that means money and a client — an employer waiting for approval — comes first. */
export function attentionItems({
  sources,
  now,
  waiting,
  reports,
  go,
  onAct,
  onReview,
}: {
  sources: Source[];
  now: number;
  waiting: number;
  reports: number;
  go: (tab: string) => void;
  onAct: (source: string, body: Record<string, unknown>) => void;
  onReview: (source: string) => void;
}) {
  const found = now ? attentionList(sources, now) : [];
  const items: Item[] = [];
  if (waiting)
    items.push({
      id: 'submissions',
      tone: 'crit',
      icon: Inbox,
      title: `${waiting} განცხადება ელოდება დადასტურებას`,
      detail:
        'დამსაქმებელმა ფორმით გამოგზავნა — საიტზე შენი დადასტურებით ჩნდება.',
      action: {
        label: 'განხილვა',
        run: () => go('submissions'),
        primary: true,
      },
    });
  const name = (a: Attention) => a.title.split(' — ')[0];
  const stopped = found.filter(
    (a) => a.severity === 'stopped' && a.action?.kind === 'run',
  );
  if (stopped.length)
    items.push({
      id: 'stopped',
      tone: 'crit',
      icon: CircleAlert,
      title:
        stopped.length === 1
          ? stopped[0].title
          : `${stopped.length} წყარო გაჩერდა`,
      detail:
        stopped.length === 1
          ? stopped[0].detail
          : 'ბოლო წარმატებული შემოწმება განრიგზე გაცილებით ადრე იყო.',
      chips: stopped.map(name),
      action: {
        label: stopped.length === 1 ? 'შემოწმება' : 'ყველას შემოწმება',
        run: () =>
          stopped.length === 1
            ? onAct(stopped[0].action!.source, { action: 'run' })
            : onAct('all', { action: 'run' }),
      },
    });
  for (const a of found.filter((a) => a.severity === 'stopped' && !a.action))
    items.push({
      id: a.id,
      tone: 'crit',
      icon: Terminal,
      title: `${name(a)} — ამ კომპიუტერიდან იკრიფება`,
      detail: a.detail,
      chips: ['npm run worker:gov'],
    });
  for (const a of found.filter((a) => a.severity === 'stuck'))
    items.push({
      id: a.id,
      tone: 'warn',
      icon: Clock3,
      title: a.title,
      detail: a.detail,
      action: {
        label: 'ხელახლა',
        run: () => onAct(a.action!.source, { action: 'retry' }),
      },
    });
  for (const a of found.filter((a) => a.severity === 'tired'))
    items.push({
      id: a.id,
      tone: 'warn',
      icon: Pause,
      title: a.title,
      detail: a.detail,
      action: {
        label: 'ინტერვალის გაზრდა',
        run: () => {
          const current =
            sources.find((s) => s.id === a.action!.source)?.interval_minutes ||
            180;
          onAct(a.action!.source, {
            action: 'configure',
            intervalMinutes: Math.min(1440, current * 2),
          });
        },
      },
    });
  if (reports)
    items.push({
      id: 'reports',
      tone: 'warn',
      icon: Flag,
      title: `${reports} ღია შეტყობინება ვაკანსიებზე`,
      detail:
        'მომხმარებლებმა პრობლემა მონიშნეს: ვადა, არასწორი ინფორმაცია ან დუბლიკატი.',
      action: { label: 'განხილვა', run: () => go('reports') },
    });
  for (const a of found.filter((a) => a.action?.kind === 'review'))
    items.push({
      id: a.id,
      tone: 'warn',
      icon: CircleAlert,
      title: a.title,
      detail: a.detail,
      action: { label: 'შემოწმება', run: () => onReview(a.action!.source) },
    });
  const off = sources.filter((s) => !s.enabled && !s.retired);
  return { items, off };
}

export function OverviewPanel({
  sources,
  now,
  busy,
  counts,
  go,
  onAct,
  onReview,
  onOpenJob,
}: {
  sources: Source[];
  now: number;
  busy: boolean;
  counts: Record<string, number>;
  go: (tab: string) => void;
  onAct: (source: string, body: Record<string, unknown>) => void;
  onReview: (source: string) => void;
  onOpenJob: (id: string) => void;
}) {
  const [days, setDays] = useState<OverviewPeriod>(1);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/overview?days=${days}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'მონაცემები ვერ ჩაიტვირთა');
        setData(body);
        setError('');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [days, now]);
  const { items, off } = attentionItems({
    sources,
    now,
    waiting: counts.submissions ?? 0,
    reports: counts.reports ?? 0,
    go,
    onAct,
    onReview,
  });
  const shown = data?.days === days ? data : null;
  const live = sources.filter((s) => !s.retired);
  return (
    <div className="overview">
      <div className="overview-bar">
        <fieldset className="overview-periods" aria-label="პერიოდი">
          {periods.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          className="primary"
          onClick={() => go('vacancies')}
        >
          შესამოწმებელი ვაკანსიები · {whole.format(counts.review ?? 0)}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}

      <div className="overview-kpis">
        <button type="button" onClick={() => go('runs')}>
          <span>ახალი ვაკანსიები</span>
          <strong>{shown ? whole.format(shown.imported.now) : '…'}</strong>
          {shown && <Change {...shown.imported} />}
          {shown && (
            <Spark values={shown.imported.series.map((d) => d.count)} />
          )}
        </button>
        <button type="button" onClick={() => go('history')}>
          <span>არქივში გადავიდა</span>
          <strong>{shown ? whole.format(shown.archived.now) : '…'}</strong>
          {shown && (
            <small>
              ვადა გავიდა: {whole.format(shown.archived.expired)} · წყაროზე აღარ
              არის: {whole.format(shown.archived.removed)}
            </small>
          )}
        </button>
        <button type="button" onClick={() => go('submissions')}>
          <span>ახალი განცხადება</span>
          <strong>{shown ? whole.format(shown.submissions.now) : '…'}</strong>
          {shown && (
            <small>
              {shown.submissions.waiting
                ? `${whole.format(shown.submissions.waiting)} ელოდება დადასტურებას`
                : 'მოლოდინში არაფერია'}
            </small>
          )}
        </button>
        <button
          type="button"
          className={items.length ? 'overview-kpi-alert' : undefined}
          onClick={() =>
            document
              .getElementById('overview-attention')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          <span>ყურადღება სჭირდება</span>
          <strong>{whole.format(items.length)}</strong>
          <small>
            {items.length
              ? 'ქვემოთ, მნიშვნელობის მიხედვით'
              : 'ყველაფერი რიგზეა'}
          </small>
        </button>
        <button type="button" onClick={() => go('billing')}>
          <span>შემოსავალი</span>
          <strong>
            {shown ? `${whole.format(shown.revenue.now)} ₾` : '…'}
          </strong>
          {shown && (
            <small>
              წინა პერიოდში: {whole.format(shown.revenue.before)} ₾
              {shown.revenue.awaiting
                ? ` · მოლოდინში ${whole.format(shown.revenue.awaiting)} ₾`
                : ''}
            </small>
          )}
        </button>
      </div>

      <div className="overview-cols">
        <section className="overview-card" id="overview-attention">
          <header>
            <h2>ყურადღება სჭირდება</h2>
            <span>{items.length ? `${items.length} საკითხი` : ''}</span>
          </header>
          {!now ? (
            <p className="overview-empty">მდგომარეობა იტვირთება…</p>
          ) : !items.length ? (
            <p className="overview-empty">
              ყველაფერი რიგზეა: წყაროები მუშაობს და არაფერი ელოდება.
            </p>
          ) : (
            <ul className="overview-attention">
              {items.map((item) => (
                <li key={item.id} data-tone={item.tone}>
                  <item.icon size={17} strokeWidth={1.75} aria-hidden="true" />
                  <div>
                    <b>{item.title}</b>
                    <p>{item.detail}</p>
                    {!!item.chips?.length && (
                      <span className="overview-chips">
                        {item.chips.map((chip) => (
                          <code key={chip}>{chip}</code>
                        ))}
                      </span>
                    )}
                  </div>
                  {item.action && (
                    <button
                      type="button"
                      className={
                        item.action.primary
                          ? 'primary'
                          : 'secondary-button'
                      }
                      disabled={busy}
                      onClick={item.action.run}
                    >
                      {!item.action.primary && (
                        <RefreshCw
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      )}
                      {item.action.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!!off.length && (
            <p className="overview-foot">
              განზრახ გამორთულია: {off.map((s) => s.name).join(', ')}
            </p>
          )}
        </section>
        <section className="overview-card">
          <header>
            <h2>ბოლო ცვლილებები</h2>
            <button
              type="button"
              className="overview-link"
              onClick={() => go('history')}
            >
              ისტორია →
            </button>
          </header>
          <RecentChanges onOpenJob={onOpenJob} />
        </section>
      </div>

      <section className="overview-card">
        <header>
          <h2>წყაროების მდგომარეობა</h2>
          <button
            type="button"
            className="overview-link"
            onClick={() => go('sources')}
          >
            მონიტორინგი →
          </button>
        </header>
        {!now && <p className="overview-empty">მდგომარეობა იტვირთება…</p>}
        <div className="overview-health">
          {(now ? live : []).map((s) => {
            const health = sourceHealth(s, now);
            const late =
              s.enabled &&
              hours(s.last_success_at, now) >
                Math.max((3 * (s.interval_minutes || 180)) / 60, 6);
            const tone = !s.enabled ? 'off' : late ? 'bad' : health.tone;
            return (
              <button
                type="button"
                key={s.id}
                data-tone={tone}
                title={health.label}
                onClick={() => go('sources')}
              >
                <b>
                  <i aria-hidden="true" />
                  {listingSourceNames[
                    s.id as keyof typeof listingSourceNames
                  ] || s.name}
                </b>
                <span>
                  {!s.enabled
                    ? 'გამორთულია'
                    : `ბოლო: ${whenText(hours(s.last_success_at, now))}`}
                </span>
                {s.enabled && (
                  <span>
                    {locallyCollected.includes(s.name)
                      ? 'ხელით · npm run worker:gov'
                      : s.queued
                        ? `რიგში: ${whole.format(s.queued)}`
                        : health.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
