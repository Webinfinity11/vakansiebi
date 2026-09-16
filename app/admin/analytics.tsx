'use client';
import { useEffect, useMemo, useState } from 'react';
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
        <fieldset className="admin-analytics-windows">
          <legend className="sr-only">პერიოდი</legend>
          {windows.map((w) => (
            <button
              key={w.days}
              type="button"
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
        <p className="admin-analytics-empty">იტვირთება…</p>
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
              note={
                totals!.search
                  ? `ერთ ძებნაზე ${(totals!.view / totals!.search).toFixed(1)}`
                  : 'გახსნილი ვაკანსიის გვერდი'
              }
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
          <div className="admin-analytics-lists">
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
            <Funnel steps={data!.steps} />
          </div>
          <div className="admin-analytics-lists">
            <RankedList
              title="ყველაზე ხშირი ძებნა"
              rows={data!.searches}
              unit="ძებნა"
            />
            <RankedList
              title="ძებნა, რომელიც არაფერს პოულობს"
              hint="რას ეძებენ და რა არ გვაქვს — აქედან იწყება ახალი წყარო."
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
        ანონიმური რაოდენობები: ინახება მხოლოდ მოვლენის ტიპი, მნიშვნელობა და დრო
        — IP მისამართი, cookie და სესია არა.
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
                  stroke="#eceef1"
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
                  stroke="#fff"
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

/* The posting form, step by step. The share is of the people who opened it, so
   the row where the number falls away is the step that loses them; what the form
   refused and where they left it are listed under their own headings, because
   those are not stages of the same ladder. */
const stepLabels: Record<string, string> = {
  opened: 'ფორმა გაიხსნა',
  started: 'შევსება დაიწყო',
  details: 'დეტალებამდე მივიდა',
  plans: 'განთავსების არჩევამდე',
  submitted: 'გაგზავნას დააჭირა',
  done: 'გაიგზავნა',
};
function Funnel({ steps }: { steps: Ranked[] }) {
  const count = (name: string) =>
    steps.find((step) => step.value === name)?.count || 0;
  const opened = count('opened') || 1;
  const left = steps.filter((step) => step.value.startsWith('left_'));
  const refused = steps.filter((step) => step.value.startsWith('invalid_'));
  return (
    <section className="admin-analytics-list">
      <h3>განცხადების დამატება</h3>
      {!steps.length ? (
        <p className="admin-analytics-empty">ამ პერიოდში ფორმა არ გაუხსნიათ.</p>
      ) : (
        <>
          <dl className="admin-analytics-steps">
            {Object.entries(stepLabels).map(([name, label]) => (
              <div key={name}>
                <dt>{label}</dt>
                <dd>
                  <span
                    style={{ width: `${(count(name) / opened) * 100}%` }}
                    aria-hidden="true"
                  />
                  <b>{whole.format(count(name))}</b>
                  <small>{share(count(name), opened)}</small>
                </dd>
              </div>
            ))}
          </dl>
          {!!left.length && (
            <p className="admin-analytics-hint">
              შეწყვიტა:{' '}
              {left
                .map(
                  (step) =>
                    `${stepLabels[step.value.slice(5)] || step.value.slice(5)} — ${whole.format(step.count)}`,
                )
                .join(' · ')}
            </p>
          )}
          {!!refused.length && (
            <p className="admin-analytics-hint">
              ფორმამ არ მიიღო:{' '}
              {refused
                .map(
                  (step) =>
                    `${step.value.slice(8)} — ${whole.format(step.count)}`,
                )
                .join(' · ')}
            </p>
          )}
        </>
      )}
    </section>
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
