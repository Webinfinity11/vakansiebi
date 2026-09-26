'use client';
import { Download, FileText, Mail, Phone, X } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import { useEffect, useState } from 'react';
import { adminTime } from '@/lib/admin-format';
import { downloadCv, type Cv } from '@/lib/cv';
import { CvSheet } from '../cv/cv-builder';
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
  apply: 'განაცხადის ღილაკი',
  save: 'შენახვა',
};
const whole = new Intl.NumberFormat('ka-GE');
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
      setOpen({ id, cv: body.cv });
    } catch (e) {
      setOpen({
        id,
        error: e instanceof Error ? e.message : 'რეზიუმე ვერ ჩაიტვირთა',
      });
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
      {open && (
        <div className="resumes-preview ds-appear">
          <div className="resumes-preview-actions">
            {open.cv && (
              <button
                type="button"
                className="ds-btn ds-btn--primary ds-btn--sm"
                onClick={() => open.cv && downloadCv(open.cv.fullName)}
              >
                <Download size={16} aria-hidden="true" />
                PDF-ად ჩამოტვირთვა
              </button>
            )}
            <button
              type="button"
              className="ds-btn ds-btn--secondary ds-btn--sm"
              onClick={() => setOpen(null)}
            >
              <X size={16} aria-hidden="true" />
              დახურვა
            </button>
          </div>
          {open.error ? (
            <p role="alert">{open.error}</p>
          ) : !open.cv ? (
            <SkeletonRows rows={4} block label="რეზიუმე იტვირთება" />
          ) : (
            <div className="resumes-sheet">
              <CvSheet cv={open.cv} />
            </div>
          )}
        </div>
      )}
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
          <dl className="vacancy-funnel">
            {(['view', ...contactKinds, 'save'] as const).map((kind) => {
              const count = data.total[kind];
              const share = data.total.view
                ? Math.min(100, (count / data.total.view) * 100)
                : 0;
              return (
                <div key={kind}>
                  <dt>{labels[kind]}</dt>
                  <dd>
                    <i
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

function Sparkline({ days }: { days: VacancyDay[] }) {
  const values = days.map((d) => d.view);
  const top = Math.max(1, ...values);
  if (!values.some(Boolean)) return <span className="muted">—</span>;
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * 72).toFixed(1)},${(19 - (v / top) * 17).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg
      className="vacancy-spark"
      viewBox="0 0 72 20"
      width="72"
      height="20"
      /* The totals beside it are the readable form; the line only shows the shape. */
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        style={{ stroke: 'var(--ds-accent)' }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
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
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [version]);
  const sorted = [...(rows ?? [])].sort(
    (a, b) =>
      Number(b.status === 'published') - Number(a.status === 'published') ||
      b.total.view - a.total.view,
  );
  const views = sorted.reduce((total, r) => total + r.total.view, 0);
  const reached = sorted.reduce((total, r) => total + contacts(r.total), 0);
  const active = sorted.filter((r) => r.status === 'published').length;
  const week = sorted.reduce((total, r) => total + r.last7.view, 0);
  return (
    <section
      className="reports-section vacancy-performance"
      aria-label="ჩვენი ვაკანსიების ეფექტურობა"
    >
      <div className="reports-heading">
        <h2>ეფექტურობა</h2>
        <span className="vacancy-performance-note">
          მხოლოდ ნამდვილი, საიტზე გამოქვეყნებული განცხადებები — ტესტები არ
          ითვლება
        </span>
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          onClick={() => setVersion((n) => n + 1)}
        >
          განახლება
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && (
        <SkeletonRows rows={2} block label="სტატისტიკა იტვირთება" />
      )}
      {rows && !rows.length && <p>ფორმით გაგზავნილი ვაკანსია ჯერ არ არის.</p>}
      {!!sorted.length && (
        <>
          <dl className="vacancy-performance-kpis">
            <div>
              <dt>აქტიური ახლა</dt>
              <dd>{whole.format(active)}</dd>
            </div>
            <div>
              <dt>ნახვები</dt>
              <dd>{whole.format(views)}</dd>
              <small>7 დღე: {whole.format(week)}</small>
            </div>
            <div>
              <dt>კონტაქტის მცდელობა</dt>
              <dd>{whole.format(reached)}</dd>
            </div>
            <div>
              <dt>კონვერსია</dt>
              <dd>{conversion(views, reached) ?? '—'}</dd>
              {!conversion(views, reached) && (
                <small>{enoughViews} ნახვამდე არ ითვლება</small>
              )}
            </div>
          </dl>
          <div className="vacancy-performance-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">ვაკანსია</th>
                  <th scope="col">სტატუსი</th>
                  <th scope="col" className="num">
                    ნახვები
                  </th>
                  <th scope="col" className="spark-col">
                    30 დღე
                  </th>
                  <th scope="col" className="num">
                    კონტაქტი
                  </th>
                  <th scope="col" className="num">
                    კონვერსია
                  </th>
                  <th scope="col" className="num">
                    შენახვა
                  </th>
                  <th
                    scope="col"
                    className="num"
                    title="JOBX-ზე შექმნილი CV-ით დაკავშირებული ადამიანები"
                  >
                    CV
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const reach = contacts(r.total);
                  const rate = conversion(r.total.view, reach);
                  return (
                    <tr key={r.id}>
                      <th scope="row">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onOpen(r.id)}
                        >
                          {r.title || 'ვაკანსია'}
                        </button>
                        <small>{r.company}</small>
                      </th>
                      <td data-label="სტატუსი">
                        <span className={`status status-${r.status}`}>
                          {statusNames[r.status] ?? r.status}
                        </span>
                        {r.status === 'published' && r.tier !== 'standard' && (
                          <span className="ds-badge ds-badge--violet">
                            {placementLabels[r.tier]}
                          </span>
                        )}
                      </td>
                      <td data-label="ნახვები" className="num">
                        {whole.format(r.total.view)}
                      </td>
                      <td data-label="30 დღე" className="spark-col">
                        <Sparkline days={r.series} />
                      </td>
                      <td
                        data-label="კონტაქტი"
                        className="num"
                        title={contactKinds
                          .map((k) => `${labels[k]}: ${r.total[k]}`)
                          .join('\n')}
                      >
                        {whole.format(reach)}
                      </td>
                      <td
                        data-label="კონვერსია"
                        className={`num${rate ? '' : ' muted'}`}
                        title={
                          rate
                            ? undefined
                            : `${enoughViews} ნახვამდე პროცენტი ჯერ არაფერს ამბობს`
                        }
                      >
                        {rate ?? '—'}
                      </td>
                      <td data-label="შენახვა" className="num">
                        {whole.format(r.total.save)}
                      </td>
                      <td data-label="CV" className="num">
                        {whole.format(r.people)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
