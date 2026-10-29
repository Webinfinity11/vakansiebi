'use client';
import { ChevronDown, FileText, Mail, Phone, RefreshCw } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import { useEffect, useState } from 'react';
import { adminTime } from '@/lib/admin-format';
import { type Cv } from '@/lib/cv';
import { CvDialog } from './cv-dialog';
import '../cv.css';
import { placementLabels, type PlacementTier } from '@/lib/placement';
import {
  contactKinds,
  contacts,
  type VacancyAnalytics,
  type VacancyDay,
  type ResumeContact,
  type VacancyEventKind,
} from '@/lib/vacancy-analytics';

type WithSeries = VacancyAnalytics & {
  series?: VacancyDay[];
  people?: ResumeContact[];
};

export function useVacancyAnalytics(
  ids: string[],
  refresh: unknown,
  series = false,
) {
  const key = [...new Set(ids)].sort().join(',');
  const [state, setState] = useState<{
    key: string;
    refresh: unknown;
    data?: Record<string, WithSeries>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void fetch(
      `/api/admin/analytics/vacancies?ids=${encodeURIComponent(key)}${series ? '&series=1' : ''}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'სტატისტიკა ვერ ჩაიტვირთა');
        return body as Record<string, WithSeries>;
      })
      .then((data) => setState({ key, refresh, data }))
      .catch((error) => {
        if (error.name !== 'AbortError')
          setState({ key, refresh, error: error.message });
      });
    return () => controller.abort();
  }, [key, refresh, series]);
  return state?.key === key && state.refresh === refresh ? state : null;
}

const labels: Record<VacancyEventKind, string> = {
  view: 'ნახვები',
  outbound: 'პირველწყაროზე გადასვლა',
  call: 'ტელეფონის ღილაკი',
  cv: 'CV-ის ღილაკი',
  email: 'საკონტაქტო წერილის გახსნა',
  apply: 'განაცხადის ღილაკი',
  save: 'შენახვა',
};
const whole = new Intl.NumberFormat('ka-GE');
/* Each way of reaching the employer keeps one colour everywhere: in the overall mix, in a
   row's mini bar and in a vacancy's funnel. The order is fixed, never by size. */
const contactColumns = [
  ['call', 'დარეკვა'],
  ['cv', 'CV'],
  ['email', 'წერილი'],
  ['apply', 'განაცხადი'],
  ['outbound', 'გარე ბმული'],
] as const satisfies readonly [(typeof contactKinds)[number], string][];
const percent = (part: number, whole: number) =>
  whole
    ? `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%`
    : '0%';

/* One bar split by contact kind. The numbers always sit beside it (legend or title):
   three of the five colours are too light to carry a value on their own. */
export function ContactMix({
  counts,
  legend = false,
}: {
  counts: Record<VacancyEventKind, number>;
  legend?: boolean;
}) {
  const total = contacts(counts);
  const parts = contactColumns.filter(([kind]) => counts[kind] > 0);
  const summary = parts
    .map(([kind, name]) => `${name}: ${whole.format(counts[kind])}`)
    .join(', ');
  return (
    <div className={`contact-mix${legend ? ' contact-mix-legend' : ''}`}>
      <span className="sr-only">
        {total ? summary : 'კონტაქტი ჯერ არ ყოფილა'}
      </span>
      <div
        className="contact-mix-bar"
        aria-hidden="true"
        title={total ? summary : undefined}
      >
        {parts.map(([kind, name]) => (
          <i
            key={kind}
            className={`viz-${kind}`}
            style={{ flexGrow: counts[kind] }}
            title={`${name}: ${whole.format(counts[kind])} (${percent(counts[kind], total)})`}
          />
        ))}
      </div>
      {legend && (
        <ul>
          {contactColumns.map(([kind, name]) => (
            <li key={kind} className={counts[kind] ? undefined : 'is-zero'}>
              <span
                className={`contact-swatch viz-${kind}`}
                aria-hidden="true"
              />
              <span title={labels[kind]}>{name}</span>
              <b>{whole.format(counts[kind])}</b>
              <small>{counts[kind] ? percent(counts[kind], total) : '—'}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* A week against the week before it, written out with its sign so it never rests on colour. */
const pressNames: Record<ResumeContact['kinds'][number]['kind'], string> = {
  cv: 'CV-ის ღილაკი',
  call: 'დარეკვა',
  apply: 'განაცხადი',
};

/* Who pressed a contact button while holding a CV built on JOBX. Everyone else stays a
   count above: a reader without a JOBX CV is never known. */
function ResumeContacts({ people }: { people: ResumeContact[] }) {
  const [open, setOpen] = useState<{
    id: string;
    cv?: Cv;
    error?: string;
  } | null>(null);
  async function show(id: string) {
    setOpen({ id });
    try {
      const response = await fetch(`/api/admin/resumes?id=${id}`, {
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(body.error || 'რეზიუმე ვერ ჩაიტვირთა');
      setOpen((current) =>
        current?.id === id ? { id, cv: body.cv } : current,
      );
    } catch (e) {
      setOpen((current) =>
        current?.id === id
          ? {
              id,
              error: e instanceof Error ? e.message : 'რეზიუმე ვერ ჩაიტვირთა',
            }
          : current,
      );
    }
  }
  return (
    <div className="resume-contacts">
      <h4>
        JOBX-ის CV-ით დაკავშირებული <span>{whole.format(people.length)}</span>
      </h4>
      {!people.length ? (
        <p className="admin-analytics-note">
          ჯერ არავინ. აქ ჩნდება ის, ვისაც CV JOBX-ზე აქვს შექმნილი და ამ
          ვაკანსიაზე დარეკვას, CV-ის გაგზავნას ან განაცხადს დააჭირა.
        </p>
      ) : (
        <ul>
          {people.map((person) => (
            <li key={person.resumeId}>
              <div>
                <strong>{person.fullName || 'სახელი არ წერია'}</strong>
                {(person.title || person.city) && (
                  <small>
                    {[person.title, person.city].filter(Boolean).join(' · ')}
                  </small>
                )}
                <small>
                  {person.kinds
                    .map(
                      (k) =>
                        pressNames[k.kind] +
                        (k.presses > 1 ? ` ×${k.presses}` : ''),
                    )
                    .join(', ')}{' '}
                  · {adminTime(person.lastAt)}
                </small>
              </div>
              <div className="resume-contact-actions">
                {person.phone && (
                  <a
                    className="ds-btn ds-btn--ghost ds-btn--sm"
                    href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}
                  >
                    <Phone size={16} aria-hidden="true" />
                    {person.phone}
                  </a>
                )}
                {person.email && (
                  <a
                    className="ds-btn ds-btn--ghost ds-btn--sm"
                    href={`mailto:${person.email}`}
                  >
                    <Mail size={16} aria-hidden="true" />
                    {person.email}
                  </a>
                )}
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  onClick={() => void show(person.resumeId)}
                >
                  <FileText size={16} aria-hidden="true" />
                  CV
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <CvDialog
        open={!!open}
        onClose={() => setOpen(null)}
        cv={open?.cv}
        error={open?.error}
      />
    </div>
  );
}
/* Written out rather than left to Intl: browsers without full Georgian locale data print
   "M09 24" for a short Georgian month. */
const months = [
  'იან',
  'თებ',
  'მარ',
  'აპრ',
  'მაი',
  'ივნ',
  'ივლ',
  'აგვ',
  'სექ',
  'ოქტ',
  'ნოე',
  'დეკ',
];
const shortDay = (day: string) =>
  `${Number(day.slice(8, 10))} ${months[Number(day.slice(5, 7)) - 1]}`;
/* Below this many views a percentage says more about chance than about the vacancy. */
const enoughViews = 30;

function conversion(views: number, reached: number) {
  if (views < enoughViews) return null;
  return `${((reached / views) * 100).toFixed(1)}%`;
}
function sum(days: VacancyDay[], pick: (d: VacancyDay) => number) {
  return days.reduce((total, d) => total + pick(d), 0);
}
const metrics = {
  view: { name: 'ნახვები', pick: (d: VacancyDay) => d.view },
  contact: {
    name: 'კონტაქტის მცდელობები',
    pick: (d: VacancyDay) => contacts(d),
  },
} as const;
type Metric = keyof typeof metrics;

/* The last seven days against the seven before them; nothing is said without both weeks. */
function Delta({ days, pick }: { days: VacancyDay[]; pick: Metric }) {
  if (days.length < 14) return null;
  const now = sum(days.slice(-7), metrics[pick].pick);
  const before = sum(days.slice(-14, -7), metrics[pick].pick);
  const diff = now - before;
  return (
    <small>
      7 დღე: {whole.format(now)}
      {diff !== 0 &&
        ` (${diff > 0 ? '+' : '−'}${whole.format(Math.abs(diff))} წინა კვირასთან)`}
    </small>
  );
}

function DailyBars({ days, metric }: { days: VacancyDay[]; metric: Metric }) {
  const [at, setAt] = useState<number | null>(null);
  const pick = metrics[metric].pick;
  const values = days.map(pick);
  const top = Math.max(1, ...values);
  const width = 600,
    height = 120,
    bottom = 18,
    gap = 2;
  const step = width / days.length;
  const hovered = at === null ? null : days[at];
  if (!values.some(Boolean))
    return (
      <p className="admin-analytics-empty">
        ბოლო 30 დღეში {metrics[metric].name.toLowerCase()} არ ყოფილა.
      </p>
    );
  return (
    <figure className="vacancy-trend">
      <figcaption>
        {metrics[metric].name} დღეების მიხედვით, ბოლო 30 დღე
        <output>
          {hovered
            ? `${shortDay(hovered.day)}: ${whole.format(pick(hovered))}`
            : `მაქს. დღეში: ${whole.format(top)}`}
        </output>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        onPointerLeave={() => setAt(null)}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) * width;
          setAt(Math.max(0, Math.min(days.length - 1, Math.floor(x / step))));
        }}
      >
        <line
          x1={0}
          x2={width}
          y1={height - bottom}
          y2={height - bottom}
          style={{ stroke: 'var(--ds-line)' }}
        />
        {values.map((value, i) => {
          const h = (value / top) * (height - bottom - 4);
          return (
            <rect
              key={days[i].day}
              x={i * step + gap / 2}
              y={height - bottom - h}
              width={step - gap}
              height={Math.max(0, h)}
              rx={Math.min(4, (step - gap) / 2)}
              style={{
                fill: at === i ? 'var(--ds-accent-ink)' : 'var(--ds-accent)',
              }}
              opacity={at === null || at === i ? 1 : 0.55}
            />
          );
        })}
        {[0, days.length - 1].map((i) => (
          <text
            key={i}
            x={i === 0 ? 0 : width}
            y={height - 4}
            textAnchor={i === 0 ? 'start' : 'end'}
          >
            {shortDay(days[i].day)}
          </text>
        ))}
      </svg>
    </figure>
  );
}

export function VacancyAnalyticsBlock({
  data,
  error,
}: {
  data?: WithSeries;
  error?: string;
}) {
  const [metric, setMetric] = useState<Metric>('view');
  const reached = data ? contacts(data.total) : 0;
  const rate = data ? conversion(data.total.view, reached) : null;
  return (
    <section
      className="submission-summary vacancy-stats"
      aria-label="ვაკანსიის სტატისტიკა"
    >
      <h3>ვაკანსიის სტატისტიკა</h3>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <SkeletonRows rows={3} block label="სტატისტიკა იტვირთება" />
      ) : (
        <>
          <div className="vacancy-kpis">
            {(['view', 'contact'] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={metric === key}
                onClick={() => setMetric(key)}
              >
                <span>{metrics[key].name}</span>
                <strong>
                  {whole.format(key === 'view' ? data.total.view : reached)}
                </strong>
                {data.series && <Delta days={data.series} pick={key} />}
              </button>
            ))}
            <div>
              <span>კონვერსია</span>
              <strong
                title={
                  rate
                    ? 'კონტაქტის მცდელობები ნახვებთან შეფარდებით'
                    : `${enoughViews} ნახვამდე პროცენტი ჯერ არაფერს ამბობს`
                }
              >
                {rate ?? '—'}
              </strong>
              {!rate && <small>საკმარისი ნახვა ჯერ არ არის</small>}
            </div>
          </div>
          {data.series && <DailyBars days={data.series} metric={metric} />}
          {reached > 0 && (
            <section className="contact-mix-panel" aria-label="კონტაქტის გზები">
              <h4>როგორ დაუკავშირდნენ</h4>
              <ContactMix counts={data.total} legend />
            </section>
          )}
          <dl className="vacancy-funnel">
            {(
              ['view', ...contactColumns.map(([kind]) => kind), 'save'] as const
            ).map((kind) => {
              const count = data.total[kind];
              const share = data.total.view
                ? Math.min(100, (count / data.total.view) * 100)
                : 0;
              return (
                <div key={kind}>
                  <dt>{labels[kind]}</dt>
                  <dd>
                    <i
                      className={
                        kind === 'view' || kind === 'save'
                          ? undefined
                          : `viz-${kind}`
                      }
                      style={{ width: `${Math.max(share, count ? 1 : 0)}%` }}
                    />
                    <b>{whole.format(count)}</b>
                    {kind !== 'view' && data.total.view >= enoughViews && (
                      <small>{share.toFixed(1)}%</small>
                    )}
                    <small>7 დღე: {whole.format(data.last7[kind])}</small>
                  </dd>
                </div>
              );
            })}
          </dl>
          {data.people && <ResumeContacts people={data.people} />}
          <p className="admin-analytics-note">
            ერთ ვიზიტში ვაკანსიის ნახვა და თითოეული ღილაკი ერთხელ ითვლება;
            ბოტები არ ითვლება. სხვა დღეს დაბრუნებული ადამიანი ხელახლა ითვლება.
            ღილაკზე დაჭერა გაგზავნას ან დაკავშირებას არ ადასტურებს.
          </p>
        </>
      )}
    </section>
  );
}

type Performance = VacancyAnalytics & {
  id: string;
  title: string | null;
  company: string | null;
  status: string;
  tier: PlacementTier;
  series: VacancyDay[];
  /** How many JOBX-built CVs reached this vacancy. */
  people: number;
};
const statusNames: Record<string, string> = {
  pending: 'დადასტურებას ელოდება',
  published: 'გამოქვეყნებული',
  archived: 'არქივი',
  rejected: 'უარყოფილი',
  merged: 'გაერთიანებული',
};

type SortKey = 'view' | 'contact' | 'rate';
const sortNames: Record<SortKey, string> = {
  view: 'ნახვები',
  contact: 'დაჭერები',
  rate: 'დაჭერა / ნახვა',
};
const rateOf = (r: Performance) =>
  r.total.view >= enoughViews ? contacts(r.total) / r.total.view : -1;

function SortHeader({
  by,
  sortBy,
  onSort,
  className = 'num',
}: {
  by: SortKey;
  sortBy: SortKey;
  onSort: (by: SortKey) => void;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={className}
      aria-sort={sortBy === by ? 'descending' : undefined}
    >
      <button
        type="button"
        className={`sort-button${sortBy === by ? ' is-active' : ''}`}
        onClick={() => onSort(by)}
      >
        {sortNames[by]}
        {sortBy === by && <ChevronDown aria-hidden="true" />}
      </button>
    </th>
  );
}

/* Every vacancy sent through our own posting form, with how it is doing. Imported vacancies
   are left out on purpose: their employers are elsewhere and do not see these numbers. */
export function SubmissionPerformance({
  onOpen,
}: {
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<Performance[] | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('view');
  const [period, setPeriod] = useState<'all' | '7' | '30'>('30');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/analytics/submissions', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'სტატისტიკა ვერ ჩაიტვირთა');
        setRows(body.vacancies);
        setError('');
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [version]);
  const pick = {
    view: (r: Performance) => r.total.view,
    contact: (r: Performance) => contacts(r.total),
    rate: rateOf,
  }[sortBy];
  const sorted = (rows ?? [])
    .filter(
      (row) =>
        (status === 'all' || row.status === status) &&
        `${row.title} ${row.company}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .map((row) => ({
      ...row,
      total:
        period === 'all'
          ? row.total
          : (Object.fromEntries(
              (['view', 'save', ...contactKinds] as const).map((kind) => [
                kind,
                row.series
                  .slice(-Number(period))
                  .reduce((n, day) => n + day[kind], 0),
              ]),
            ) as Record<VacancyEventKind, number>),
    }))
    .sort((a, b) => pick(b) - pick(a) || b.total.view - a.total.view);
  const totals = Object.fromEntries(
    (['view', 'save', ...contactKinds] as const).map((kind) => [
      kind,
      sorted.reduce((n, row) => n + row.total[kind], 0),
    ]),
  ) as Record<VacancyEventKind, number>;
  const reached = contacts(totals);
  const pages = Math.max(1, Math.ceil(sorted.length / 20));
  const visiblePage = Math.min(page, pages);
  const showing = sorted.slice((visiblePage - 1) * 20, visiblePage * 20);
  return (
    <section
      className="reports-section vacancy-performance performance-clear"
      aria-label="ვაკანსიების შედეგები"
    >
      <div className="performance-toolbar">
        <fieldset className="admin-chips">
          <legend className="sr-only">სტატისტიკის პერიოდი</legend>
          {(
            [
              ['7', '7 დღე'],
              ['30', '30 დღე'],
              ['all', 'მთელი პერიოდი'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className="ds-chip"
              aria-pressed={period === value}
              onClick={() => {
                setPeriod(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setVersion((n) => n + 1);
          }}
        >
          <RefreshCw size={15} />
          განახლება
        </button>
      </div>
      <p className="performance-scope">
        JOBX-ზე დამატებული და ერთხელ მაინც გამოქვეყნებული ბოლო 200 განცხადება.
        ტესტები გამორიცხულია.{' '}
        {period === 'all'
          ? 'მონაცემები ტრეკინგის დაწყებიდან.'
          : 'თბილისის კალენდარული დღეები, დღევანდელის ჩათვლით.'}
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && !rows && (
        <SkeletonRows rows={4} block label="შედეგები იტვირთება" />
      )}
      {rows && (
        <>
          <dl className="vacancy-performance-kpis">
            <div>
              <dt>ვაკანსიები</dt>
              <dd>{whole.format(sorted.length)}</dd>
              <small>
                {sorted.filter((r) => r.status === 'published').length}{' '}
                გამოქვეყნებულია
              </small>
            </div>
            <div>
              <dt>ნახვები</dt>
              <dd>{whole.format(totals.view)}</dd>
              <small>არჩეულ პერიოდში</small>
            </div>
            <div>
              <dt>დაკავშირების ღილაკზე დაჭერა</dt>
              <dd>{whole.format(reached)}</dd>
              <small>გაგზავნილ განაცხადს არ ნიშნავს</small>
            </div>
            <div>
              <dt>შენახვა</dt>
              <dd>{whole.format(totals.save)}</dd>
              <small>ვაკანსიის შენახვის მოქმედებები</small>
            </div>
          </dl>
          <div className="performance-filters">
            <label>
              <span className="sr-only">ვაკანსიის ან კომპანიის ძიება</span>
              <input
                className="ds-input"
                type="search"
                placeholder="ვაკანსია ან კომპანია"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              <span className="sr-only">სტატუსი</span>
              <select
                className="ds-input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">ყველა სტატუსი</option>
                <option value="published">გამოქვეყნებული</option>
                <option value="archived">არქივში</option>
              </select>
            </label>
          </div>
          {sorted.length ? (
            <div className="vacancy-performance-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">ვაკანსია</th>
                    <SortHeader by="view" sortBy={sortBy} onSort={setSortBy} />
                    <SortHeader
                      by="contact"
                      sortBy={sortBy}
                      onSort={setSortBy}
                    />
                    <SortHeader by="rate" sortBy={sortBy} onSort={setSortBy} />
                    <th scope="col" className="num">
                      შენახვა
                    </th>
                    <th scope="col">
                      <span className="sr-only">დეტალები</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {showing.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onOpen(row.id)}
                        >
                          {row.title || 'ვაკანსია'}
                        </button>
                        <span className="vacancy-row-meta">
                          <small>{row.company}</small>
                          <span className={`status status-${row.status}`}>
                            {statusNames[row.status] ?? row.status}
                          </span>
                          {row.status === 'published' &&
                            row.tier !== 'standard' && (
                              <span className="ds-badge ds-badge--violet">
                                {placementLabels[row.tier]}
                              </span>
                            )}
                        </span>
                      </th>
                      <td data-label="ნახვები" className="num">
                        {whole.format(row.total.view)}
                      </td>
                      <td data-label="დაჭერები" className="num">
                        {whole.format(contacts(row.total))}
                      </td>
                      <td
                        data-label="დაჭერა / ნახვა"
                        className="num"
                        title={`დაკავშირების ღილაკებზე დაჭერები / ნახვები × 100. მინიმუმ ${enoughViews} ნახვა.`}
                      >
                        {conversion(row.total.view, contacts(row.total)) ?? '—'}
                      </td>
                      <td data-label="შენახვა" className="num">
                        {whole.format(row.total.save)}
                      </td>
                      <td className="performance-details">
                        <button
                          type="button"
                          className="ds-btn ds-btn--ghost ds-btn--sm"
                          onClick={() => onOpen(row.id)}
                          aria-label={`${row.title} — დეტალები`}
                        >
                          ნახვა
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <h3>
                {query || status !== 'all'
                  ? 'შედეგი ვერ მოიძებნა'
                  : 'ჯერ მონაცემი არ არის'}
              </h3>
              <p>
                შედეგები გამოქვეყნებული ვაკანსიების ნახვის შემდეგ გამოჩნდება.
              </p>
            </div>
          )}
          {sorted.length > 20 && (
            <div className="admin-pagination">
              <span>
                {(visiblePage - 1) * 20 + 1}–
                {Math.min(visiblePage * 20, sorted.length)} / {sorted.length}
              </span>
              <button
                type="button"
                className="ds-btn ds-btn--secondary ds-btn--sm"
                disabled={visiblePage === 1}
                onClick={() => setPage(visiblePage - 1)}
              >
                წინა
              </button>
              <span>
                {visiblePage} / {pages}
              </span>
              <button
                type="button"
                className="ds-btn ds-btn--secondary ds-btn--sm"
                disabled={visiblePage === pages}
                onClick={() => setPage(visiblePage + 1)}
              >
                შემდეგი
              </button>
            </div>
          )}
          <details className="performance-contact-details">
            <summary>
              <ChevronDown size={17} />
              დაკავშირების გზები და მაჩვენებლების განმარტება
            </summary>
            {reached > 0 && <ContactMix counts={totals} legend />}
            <p>
              დაჭერა არის ტელეფონის, ელფოსტის, რეზიუმეს, განაცხადის ან
              პირველწყაროს ბმულის გახსნა. დასრულებულ ზარსა და გაგზავნილ წერილს
              აქ ვერ ვადასტურებთ. „დაჭერა / ნახვა“ ამ მოქმედებების რაოდენობისა
              და ნახვების შეფარდებაა; ერთმა ადამიანმა შეიძლება რამდენჯერმე
              დააჭიროს. უნიკალური ადამიანები და დასაქმების შედეგი ამ რიცხვებით
              არ იზომება.
            </p>
            <p>
              ვაკანსიის „ნახვა“ ხსნის მის დეტალებს, სადაც ხელმისაწვდომია სრული
              ისტორია, ყოველდღიური ნახვები და დაკავშირების გზები.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
