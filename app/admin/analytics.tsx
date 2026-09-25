'use client';
import { SkeletonRows } from '../skeleton';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import './analytics.css';
import {
  buildFunnel,
  postExtraLabels,
  postFieldLabels,
  postLadder,
  postLabels,
  resumeLadder,
  resumeLabels,
} from '@/lib/analytics-funnel';
import { groupActions } from '@/lib/analytics-actions';
import type {
  ActivityPoint,
  AnalyticsSummary,
  Ranked,
} from '@/lib/server/analytics';

const windows = [
  { days: 1, label: '24 საათი' },
  { days: 7, label: '7 დღე' },
  { days: 30, label: '30 დღე' },
  { days: 90, label: '3 თვე' },
  { days: 365, label: 'წელი' },
] as const;
type Window = (typeof windows)[number]['days'];

/* Three hues in the documented order, validated against this panel's white
   surface: worst adjacent CVD ΔE 9.2, normal-vision ΔE 27.6. Identity is never
   colour alone — every line carries its name at its end and in the legend, and
   the same numbers are in the table below the chart. */
const measures = [
  { key: 'search', name: 'ძებნა', colour: '#2a78d6' },
  { key: 'view', name: 'ნახვა', colour: '#eb6834' },
  { key: 'outbound', name: 'გადასვლა', colour: '#1baf7a' },
] as const;

const filterNames: Record<string, string> = {
  query: 'საძიებო სიტყვა',
  city: 'ქალაქი',
  category: 'მიმართულება',
  subcategory: 'ქვემიმართულება',
  source: 'წყარო',
  paid: 'ხელფასი მითითებულია',
  remote: 'დისტანციური',
  sort: 'დალაგება',
  salaryPeriod: 'ანაზღაურების პერიოდი',
  salaryFrom: 'მინიმალური ხელფასი',
  salaryTo: 'მაქსიმალური ხელფასი',
  employment: 'განაკვეთი',
  entryLevel: 'გამოცდილების გარეშე',
  deep: 'აღწერაშიც ძებნა',
  postedWithin: 'გამოქვეყნების თარიღი',
};
const whole = new Intl.NumberFormat('ka-GE');
const share = (part: number, whole_: number) =>
  whole_ > 0 ? `${Math.round((part / whole_) * 1000) / 10}%` : '—';
const months = 'იან,თებ,მარ,აპრ,მაი,ივნ,ივლ,აგვ,სექ,ოქტ,ნოე,დეკ'.split(',');
/** A bucket as a person reads it: an hour inside a day, a date across days. */
function bucketLabel(bucket: string, unit: AnalyticsSummary['unit']) {
  const [date, time] = bucket.split('T');
  const [, month, day] = date.split('-');
  const short = `${Number(day)} ${months[Number(month) - 1]}`;
  return unit === 'hour' ? time : short;
}
function rangeLabel(summary: AnalyticsSummary) {
  if (!summary.from || !summary.to) return '';
  const day = (bucket: string) => bucketLabel(bucket, 'day');
  const hour = (bucket: string) => bucket.split('T')[1];
  return summary.unit === 'hour'
    ? `${day(summary.from)} ${hour(summary.from)} — ${day(summary.to)} ${hour(summary.to)}`
    : `${day(summary.from)} — ${day(summary.to)}`;
}

/* Loads only when the tab is opened, so the vacancy list never waits on these counts. */
export function AnalyticsPanel() {
  const [days, setDays] = useState<Window>(7);
  const [state, setState] = useState<{
    days: number;
    data?: AnalyticsSummary;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/analytics?days=${days}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'ანალიტიკა ვერ ჩაიტვირთა');
        return body as AnalyticsSummary;
      })
      .then((data) => setState({ days, data }))
      .catch((error) => {
        if (error.name !== 'AbortError')
          setState({ days, error: String(error.message || error) });
      });
    return () => controller.abort();
  }, [days]);
  const current = state?.days === days ? state : null;
  const data = current?.data;
  const totals = data?.totals;
  return (
    <section className="admin-analytics">
      <div className="admin-analytics-bar">
        <fieldset className="admin-chips">
          <legend className="sr-only">პერიოდი</legend>
          {windows.map((w) => (
            <button
              key={w.days}
              type="button"
              className="ds-chip"
              aria-pressed={days === w.days}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </button>
          ))}
        </fieldset>
        {data && <p className="admin-analytics-range">{rangeLabel(data)}</p>}
      </div>
      {!current ? (
        <SkeletonRows rows={3} block label="ანალიტიკა იტვირთება" />
      ) : current.error ? (
        <p role="alert" className="admin-error">
          {current.error}
        </p>
      ) : (
        <>
          <dl className="admin-analytics-totals">
            <Tile
              label="ძებნა"
              value={totals!.search}
              note={
                totals!.search
                  ? `უშედეგო ${whole.format(totals!.search_empty)} · ${share(totals!.search_empty, totals!.search)}`
                  : 'ამ პერიოდში ძებნა არ ყოფილა'
              }
            />
            <Tile
              label="ვაკანსიის ნახვა"
              value={totals!.view}
              note="გახსნილი ვაკანსიის გვერდები, მათ შორის პირდაპირი ვიზიტები"
            />
            <Tile
              label="გადასვლა დამსაქმებელთან"
              value={totals!.outbound}
              note={
                totals!.view
                  ? `ნახვის ${share(totals!.outbound, totals!.view)}`
                  : 'პირველწყაროზე გადასვლა'
              }
            />
            <Tile
              label="ჩართულობა"
              value={totals!.save + totals!.saved_search + totals!.application}
              note={`შენახული ვაკანსია ${whole.format(totals!.save)} · შენახული ძებნა ${whole.format(totals!.saved_search)} · განაცხადი ${whole.format(totals!.application)}`}
            />
          </dl>
          <Activity points={data!.activity} unit={data!.unit} />
          <div className="admin-analytics-lists admin-analytics-funnels">
            <section className="admin-analytics-list">
              <h3>დაკავშირება</h3>
              <p className="admin-analytics-hint">
                რამდენჯერ დააჭირეს — არა ვინ. წილი ნახვებთან.
              </p>
              <dl className="admin-analytics-steps">
                {(
                  [
                    ['დარეკვა', totals!.call],
                    ['CV-ის გაგზავნა', totals!.cv],
                    ['განაცხადი კომპანიის საიტზე', totals!.apply],
                    ['პირველწყაროზე გადასვლა', totals!.outbound],
                  ] as const
                ).map(([label, count]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <span
                        style={{
                          width: `${Math.min(100, totals!.view ? (count / totals!.view) * 100 : 0)}%`,
                        }}
                        aria-hidden="true"
                      />
                      <b>{whole.format(count)}</b>
                      <small>{share(count, totals!.view)}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <Funnel
              title="განცხადების დამატება"
              rows={data!.steps}
              ladder={postLadder}
              labels={postLabels}
              fieldLabels={postFieldLabels}
              empty="ამ პერიოდში ფორმა არ გაუხსნიათ."
              extras={<PostExtras rows={data!.steps} />}
            />
            <Funnel
              title="CV კონსტრუქტორი"
              rows={data!.resume}
              ladder={resumeLadder}
              labels={resumeLabels}
              empty="ამ პერიოდში კონსტრუქტორი არ გაუხსნიათ."
              extras={<ResumeExtras rows={data!.resume} />}
            />
          </div>
          <section className="admin-analytics-list">
            <h3>ძიების შედეგიანობა</h3>
            <p className="admin-analytics-hint">
              უშედეგო ძებნები პირველ რიგში. შედეგზე არჩეული ფილტრებიც მოქმედებს;
              ეს მომხმარებლების რაოდენობა არ არის.
            </p>
            <div className="admin-table-scroll">
              <table className="admin-search-performance">
                <thead>
                  <tr>
                    <th scope="col">საძიებო სიტყვა</th>
                    <th scope="col">ძებნა</th>
                    <th scope="col">უშედეგო</th>
                    <th scope="col">უშედეგო წილი</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.searchPerformance.map((row) => (
                    <tr key={row.value}>
                      <th scope="row">{row.value}</th>
                      <td>{whole.format(row.searches)}</td>
                      <td>{whole.format(row.empty)}</td>
                      <td>
                        {row.empty <= row.searches
                          ? share(row.empty, row.searches)
                          : 'არასრული მონაცემი'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data!.searchPerformance.length && (
                <p className="admin-analytics-empty admin-table-empty">
                  ამ პერიოდში ძებნა არ დაფიქსირებულა.
                </p>
              )}
            </div>
          </section>
          <Actions rows={data!.actions} />
          <div className="admin-analytics-lists">
            <RankedList
              title="გამოყენებული ფილტრები"
              rows={data!.filters.map((row) => ({
                ...row,
                value: filterNames[row.value] || row.value,
              }))}
              unit="გამოყენება"
            />
            <RankedList
              title="ყველაზე ხშირი ძებნა"
              rows={data!.searches}
              unit="ძებნა"
            />
            <RankedList
              title="ძებნა, რომელიც არაფერს პოულობს"
              hint="რომელი ძებნა დარჩა შედეგის გარეშე არჩეული ფილტრებით."
              rows={data!.emptySearches}
              unit="ძებნა"
            />
            <RankedList
              title="ყველაზე ნანახი ვაკანსიები"
              rows={data!.views}
              unit="ნახვა"
              vacancy
            />
            <RankedList
              title="ყველაზე ხშირი გადასვლა დამსაქმებელთან"
              rows={data!.outbound}
              unit="გადასვლა"
              vacancy
            />
          </div>
        </>
      )}
      <p className="admin-analytics-note">
        მოვლენების რაოდენობები: ინახება ტიპი, მნიშვნელობა და დრო — IP მისამართი,
        cookie და სესია არა.
      </p>
    </section>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{whole.format(value)}</dd>
      <p>{note}</p>
    </div>
  );
}

const box = {
  width: 760,
  height: 190,
  top: 14,
  right: 16,
  bottom: 24,
  left: 38,
};
/** The plotted top: the highest count rounded up to something a person reads,
    and no further — a curve that peaks at 57 is drawn against 60, not 100. */
function ceiling(highest: number) {
  if (highest <= 4) return 4;
  const size = Math.pow(10, Math.floor(Math.log10(highest)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10])
    if (highest <= size * step) return size * step;
  return size * 10;
}
function Activity({
  points,
  unit,
}: {
  points: ActivityPoint[];
  unit: AnalyticsSummary['unit'];
}) {
  const [at, setAt] = useState<number | null>(null);
  const plot = {
    width: box.width - box.left - box.right,
    height: box.height - box.top - box.bottom,
  };
  const top = useMemo(
    () =>
      ceiling(
        Math.max(1, ...points.flatMap((p) => measures.map((m) => p[m.key]))),
      ),
    [points],
  );
  const busy = points.some((p) => p.search + p.view + p.outbound > 0);
  const x = (index: number) =>
    box.left +
    (points.length < 2
      ? plot.width / 2
      : (index / (points.length - 1)) * plot.width);
  const y = (value: number) =>
    box.top + plot.height - (value / top) * plot.height;
  /* A name sits at the end of its own line, but only where it can be read: when
     two lines finish together the legend and the crosshair say which is which,
     and stacked labels over the curve would say it worse. */
  const finishes = measures
    .map((measure) => ({ measure, y: y(points.at(-1)?.[measure.key] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  const ends = finishes.filter((end, index) =>
    finishes.every(
      (other, position) =>
        position === index || Math.abs(other.y - end.y) >= 16,
    ),
  );
  const ticks = points.length
    ? [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
        (index, position, all) => all.indexOf(index) === position,
      )
    : [];
  const hovered = at === null ? null : points[at];
  return (
    <figure className="admin-activity">
      <figcaption>
        აქტივობა
        <span className="admin-activity-legend">
          {measures.map((measure) => (
            <span key={measure.key}>
              <i style={{ background: measure.colour }} aria-hidden="true" />
              {measure.name}
            </span>
          ))}
        </span>
      </figcaption>
      {!busy ? (
        <p className="admin-analytics-empty">ამ პერიოდში მოვლენა არ ყოფილა.</p>
      ) : (
        <div className="admin-activity-plot">
          <svg
            viewBox={`0 0 ${box.width} ${box.height}`}
            /* The same numbers are in the table below, where a screen reader
               reads them one by one instead of guessing at a shape. */
            aria-hidden="true"
            onPointerLeave={() => setAt(null)}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const inside =
                ((event.clientX - bounds.left) / bounds.width) * box.width;
              const step =
                points.length < 2
                  ? plot.width
                  : plot.width / (points.length - 1);
              setAt(
                Math.max(
                  0,
                  Math.min(
                    points.length - 1,
                    Math.round((inside - box.left) / step),
                  ),
                ),
              );
            }}
          >
            {[0, top / 2, top].map((value) => (
              <g key={value}>
                <line
                  x1={box.left}
                  x2={box.width - box.right}
                  y1={y(value)}
                  y2={y(value)}
                  style={{ stroke: 'var(--ds-line)' }}
                />
                <text x={box.left - 8} y={y(value) + 4} textAnchor="end">
                  {whole.format(value)}
                </text>
              </g>
            ))}
            {ticks.map((index) => (
              <text
                key={index}
                x={x(index)}
                y={box.height - 6}
                textAnchor={
                  index === 0
                    ? 'start'
                    : index === points.length - 1
                      ? 'end'
                      : 'middle'
                }
              >
                {bucketLabel(points[index].bucket, unit)}
              </text>
            ))}
            {hovered && (
              <line
                className="admin-activity-guide"
                x1={x(at!)}
                x2={x(at!)}
                y1={box.top}
                y2={box.top + plot.height}
              />
            )}
            {measures.map((measure) => (
              <path
                key={measure.key}
                fill="none"
                stroke={measure.colour}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d={points
                  .map(
                    (point, index) =>
                      `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point[measure.key]).toFixed(1)}`,
                  )
                  .join(' ')}
              />
            ))}
            {hovered &&
              measures.map((measure) => (
                <circle
                  key={measure.key}
                  cx={x(at!)}
                  cy={y(hovered[measure.key])}
                  r="4"
                  fill={measure.colour}
                  style={{ stroke: 'var(--ds-surface)' }}
                  strokeWidth="2"
                />
              ))}
            {points.length > 1 &&
              ends.map((end) => (
                <text
                  key={end.measure.key}
                  className="admin-activity-name"
                  x={box.width - box.right}
                  y={end.y - 6}
                  textAnchor="end"
                >
                  {end.measure.name}
                </text>
              ))}
          </svg>
          {hovered && (
            <div
              className="admin-activity-readout"
              style={{
                left: `${(x(at!) / box.width) * 100}%`,
              }}
            >
              <b>{bucketLabel(hovered.bucket, unit)}</b>
              {measures.map((measure) => (
                <span key={measure.key}>
                  <i
                    style={{ background: measure.colour }}
                    aria-hidden="true"
                  />
                  {measure.name}
                  <b>{whole.format(hovered[measure.key])}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <table className="sr-only">
        <caption>აქტივობა პერიოდის მიხედვით</caption>
        <thead>
          <tr>
            <th scope="col">დრო</th>
            {measures.map((measure) => (
              <th key={measure.key} scope="col">
                {measure.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.bucket}>
              <th scope="row">{point.bucket}</th>
              {measures.map((measure) => (
                <td key={measure.key}>{point[measure.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Funnel({
  title,
  rows,
  ladder,
  labels,
  fieldLabels = {},
  empty,
  extras,
}: {
  title: string;
  rows: Ranked[];
  ladder: readonly (readonly [string, string])[];
  labels: Record<string, string>;
  /** Readable names for the fields in "ფორმამ არ მიიღო". */
  fieldLabels?: Record<string, string>;
  empty: string;
  extras?: ReactNode;
}) {
  const report = buildFunnel(rows, ladder, labels);
  return (
    <section className="admin-analytics-list">
      <h3>{title}</h3>
      <p className="admin-analytics-hint">
        წილი გახსნებთან; დაკარგვა — წინა საფეხურთან. მხოლოდ საფეხურები ითვლება,
        არა ადამიანები.
      </p>
      {!rows.length ? (
        <p className="admin-analytics-empty">{empty}</p>
      ) : (
        <>
          <dl className="admin-analytics-steps">
            {report.steps.map((step, index) => (
              <div key={step.name}>
                <dt>{step.label}</dt>
                <dd>
                  <span
                    style={{ width: `${Math.min(100, step.share)}%` }}
                    aria-hidden="true"
                  />
                  <b>{whole.format(step.count)}</b>
                  <small>{step.share}%</small>
                  {index > 0 && step.drop > 0 && (
                    <small className="admin-analytics-drop">
                      −{step.drop}%
                    </small>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {extras}
          {!!report.left.length && (
            <p className="admin-analytics-hint">
              შეწყვიტა:{' '}
              {report.left
                .map((step) => `${step.label} — ${whole.format(step.count)}`)
                .join(' · ')}
            </p>
          )}
          {!!report.refused.length && (
            <p className="admin-analytics-hint">
              ფორმამ არ მიიღო:{' '}
              {report.refused
                .map(
                  (step) =>
                    `${fieldLabels[step.name] ?? step.name} — ${whole.format(step.count)}`,
                )
                .join(' · ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function PostExtras({ rows }: { rows: Ranked[] }) {
  const extras = rows
    .filter(({ value }) => value in postExtraLabels)
    .sort((a, b) => b.count - a.count);
  if (!extras.length) return null;
  return (
    <p className="admin-analytics-hint">
      სხვა:{' '}
      {extras
        .map(
          ({ value, count }) =>
            `${postExtraLabels[value]} — ${whole.format(count)}`,
        )
        .join(' · ')}
    </p>
  );
}

/* Public controls and the errors readers meet, by group. Each row is a count of presses:
   one reader pressing twice is two, and nobody is recognised between presses. */
function Actions({ rows }: { rows: Ranked[] }) {
  const groups = groupActions(
    rows,
    (filter) => `ფილტრის მოხსნა უშედეგოდან: ${filterNames[filter] ?? filter}`,
  );
  return (
    <section className="admin-analytics-list aa-actions">
      <h3>ღილაკები, ნავიგაცია და შეცდომები</h3>
      <p className="admin-analytics-hint">
        რამდენჯერ დააჭირეს ან შეხვდა — არა რამდენმა ადამიანმა. 0 ნიშნავს, რომ ამ
        პერიოდში ეს არავის გამოუყენებია.
      </p>
      <div className="aa-groups">
        {groups.map((group) => {
          const highest = group.rows[0]?.count || 1;
          const errors = group.title === 'შეცდომები';
          return (
            <section
              key={group.title}
              className={`aa-group${errors ? ' aa-errors' : ''}`}
            >
              <h4>
                {group.title}
                <span>{whole.format(group.total)}</span>
              </h4>
              <ol>
                {group.rows.map((row) => (
                  <li key={row.code} className={row.count ? '' : 'aa-zero'}>
                    <span
                      className="aa-bar"
                      style={{ width: `${(row.count / highest) * 100}%` }}
                      aria-hidden="true"
                    />
                    <span className="aa-label">{row.label}</span>
                    <b>{whole.format(row.count)}</b>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function ResumeExtras({ rows }: { rows: Ranked[] }) {
  const templates = rows
    .filter(({ value }) => value.startsWith('template_'))
    .sort((a, b) => b.count - a.count);
  const styles = rows
    .filter(
      ({ value }) =>
        value.startsWith('style_') ||
        value.startsWith('photo_') ||
        value.startsWith('language_') ||
        value === 'preview',
    )
    .sort((a, b) => b.count - a.count);
  const cleared = rows.find(({ value }) => value === 'cleared');
  const describe = (items: Ranked[]) =>
    items
      .map(
        ({ value, count }) =>
          `${resumeLabels[value] ?? value} — ${whole.format(count)}`,
      )
      .join(' · ');
  return (
    <>
      {!!templates.length && (
        <p className="admin-analytics-hint">შაბლონი: {describe(templates)}</p>
      )}
      {!!styles.length && (
        <p className="admin-analytics-hint">სტილი: {describe(styles)}</p>
      )}
      {cleared && <p className="admin-analytics-hint">{describe([cleared])}</p>}
    </>
  );
}

function RankedList({
  title,
  hint,
  rows,
  unit,
  vacancy = false,
}: {
  title: string;
  hint?: string;
  rows: Ranked[];
  unit: string;
  vacancy?: boolean;
}) {
  const highest = rows[0]?.count || 1;
  return (
    <section className="admin-analytics-list">
      <h3>{title}</h3>
      {hint && <p className="admin-analytics-hint">{hint}</p>}
      {!rows.length ? (
        <p className="admin-analytics-empty">ამ პერიოდში მონაცემი არ არის.</p>
      ) : (
        <ol>
          {rows.map((row) => (
            <li key={row.value}>
              {/* The bar is the row's share of the busiest one, so the eye ranks
                  them before it reads a single number. */}
              <span
                className="admin-analytics-bar"
                style={{
                  width: `${Math.max(2, (row.count / highest) * 100)}%`,
                }}
                aria-hidden="true"
              />
              <span className="admin-analytics-label">
                {vacancy ? (
                  row.title ? (
                    <a
                      href={`/vacancies/${row.value}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.title}
                      {row.company ? ` — ${row.company}` : ''}
                    </a>
                  ) : (
                    <span className="admin-analytics-gone">
                      წაშლილი ვაკანსია
                    </span>
                  )
                ) : (
                  row.value
                )}
              </span>
              <b>
                {whole.format(row.count)}
                <span className="sr-only"> {unit}</span>
              </b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
