'use client';
import { SkeletonRows } from '../skeleton';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
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
   surface: worst adjacent CVD ΔE 9.2, normal-vision ΔE 27.6. The chart draws one
   of them at a time, named by the selected tab, so identity is never colour
   alone; each keeps its hue whichever tab is open. */
const measures = [
  { key: 'search', name: 'ძებნა', short: 'ძებნა', colour: '#2a78d6' },
  { key: 'view', name: 'ვაკანსიის ნახვა', short: 'ნახვა', colour: '#eb6834' },
  {
    key: 'outbound',
    name: 'გადასვლა დამსაქმებელთან',
    short: 'გადასვლა',
    colour: '#1baf7a',
  },
] as const;
type Measure = (typeof measures)[number];

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

/* A vacancy is stored by id; a title that carries that id (an imported title, a test
   row) reads as noise, so the id is taken out, and a row with nothing left is named by
   the first characters of its id instead of the whole of it. */
const uuidPattern = /[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}/gi;
const withoutIds = (text?: string) =>
  (text ?? '').replace(uuidPattern, '').replace(/\s+/g, ' ').trim();
function vacancyName(row: Ranked) {
  return withoutIds(row.title) || `ვაკანსია ${row.value.slice(0, 6)}`;
}

/** Share of the busiest row, 0 to 1. */
const ofHighest = (rows: Ranked[]) => {
  const highest = rows[0]?.count || 1;
  return (count: number) => count / highest;
};

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
        <Report data={data!} />
      )}
      <p className="admin-analytics-note">
        მოვლენების რაოდენობები: ინახება ტიპი, მნიშვნელობა და დრო — IP მისამართი,
        cookie და სესია არა.
      </p>
    </section>
  );
}

type Section = { title: string; empty?: string; node?: ReactNode };

function Report({ data }: { data: AnalyticsSummary }) {
  const totals = data.totals;
  const vacancyRows = (rows: Ranked[]): Row[] => {
    const bar = ofHighest(rows);
    return rows.map((row) => {
      const name = row.title ? vacancyName(row) : '';
      const company = withoutIds(row.company);
      return {
        key: row.value,
        title: name ? `${name}${company ? ` — ${company}` : ''}` : undefined,
        label: name ? (
          <a href={`/vacancies/${row.value}`} target="_blank" rel="noreferrer">
            {name}
            {company && <span className="aa-muted"> · {company}</span>}
          </a>
        ) : (
          <span className="aa-muted">წაშლილი ვაკანსია</span>
        ),
        bar: bar(row.count),
        value: whole.format(row.count),
      };
    });
  };
  const plainRows = (
    rows: Ranked[],
    name = (value: string) => value,
  ): Row[] => {
    const bar = ofHighest(rows);
    return rows.map((row) => ({
      key: row.value,
      label: name(row.value),
      title: name(row.value),
      bar: bar(row.count),
      value: whole.format(row.count),
    }));
  };
  const post = buildFunnel(data.steps, postLadder, postLabels);
  const resume = buildFunnel(data.resume, resumeLadder, resumeLabels);
  /* A funnel whose every step is zero, with nothing else to tell, is one line in the
     quiet list rather than a card of empty bars. */
  const told = (
    report: ReturnType<typeof buildFunnel>,
    rows: Ranked[],
    extra: (value: string) => boolean,
  ) =>
    report.steps.some((step) => step.count > 0) ||
    report.left.length > 0 ||
    report.refused.length > 0 ||
    rows.some((row) => extra(row.value));
  const postTold = told(post, data.steps, (value) => value in postExtraLabels);
  const resumeTold = told(
    resume,
    data.resume,
    (value) =>
      /^(template_|style_|photo_|language_)/.test(value) ||
      value === 'preview' ||
      value === 'cleared',
  );
  const sections: Section[] = [
    {
      title: 'დაკავშირება და ჩართულობა',
      node: <Contacts totals={totals} />,
    },
    {
      title: 'ძიების შედეგიანობა',
      empty: 'ძებნა არ დაფიქსირებულა',
      node: data.searchPerformance.length > 0 && (
        <Card
          title="ძიების შედეგიანობა"
          hint="უშედეგო ძებნები პირველ რიგში; შედეგზე არჩეული ფილტრებიც მოქმედებს."
        >
          <Rows
            unit="ძებნა"
            rows={data.searchPerformance.map((row) => {
              const whole_ = row.empty <= row.searches;
              return {
                key: row.value,
                label: row.value,
                title: row.value,
                bar: whole_ && row.searches ? row.empty / row.searches : 0,
                value: whole.format(row.searches),
                note: whole_
                  ? `უშედეგო ${share(row.empty, row.searches)}`
                  : `უშედეგო ${whole.format(row.empty)} · არასრული`,
              };
            })}
          />
        </Card>
      ),
    },
    {
      title: 'ყველაზე ხშირი ძებნა',
      node: data.searches.length > 0 && (
        <Card title="ყველაზე ხშირი ძებნა">
          <Rows rows={plainRows(data.searches)} unit="ძებნა" />
        </Card>
      ),
    },
    {
      title: 'ძებნა, რომელიც არაფერს პოულობს',
      node: data.emptySearches.length > 0 && (
        <Card
          title="ძებნა, რომელიც არაფერს პოულობს"
          hint="შედეგის გარეშე დარჩა არჩეული ფილტრებით."
        >
          <Rows rows={plainRows(data.emptySearches)} unit="ძებნა" />
        </Card>
      ),
    },
    {
      title: 'ყველაზე ნანახი ვაკანსიები',
      node: data.views.length > 0 && (
        <Card title="ყველაზე ნანახი ვაკანსიები">
          <Rows rows={vacancyRows(data.views)} unit="ნახვა" />
        </Card>
      ),
    },
    {
      title: 'ყველაზე ხშირი გადასვლა დამსაქმებელთან',
      node: data.outbound.length > 0 && (
        <Card title="ყველაზე ხშირი გადასვლა დამსაქმებელთან">
          <Rows rows={vacancyRows(data.outbound)} unit="გადასვლა" />
        </Card>
      ),
    },
    {
      title: 'გამოყენებული ფილტრები',
      node: data.filters.length > 0 && (
        <Card title="გამოყენებული ფილტრები">
          <Rows
            rows={plainRows(
              data.filters,
              (value) => filterNames[value] || value,
            )}
            unit="გამოყენება"
          />
        </Card>
      ),
    },
    {
      title: 'განცხადების დამატება',
      empty: 'ფორმა არ გაუხსნიათ',
      node: postTold && (
        <Funnel
          title="განცხადების დამატება"
          report={post}
          fieldLabels={postFieldLabels}
          extras={<PostExtras rows={data.steps} />}
        />
      ),
    },
    {
      title: 'CV კონსტრუქტორი',
      empty: 'კონსტრუქტორი არ გაუხსნიათ',
      node: resumeTold && (
        <Funnel
          title="CV კონსტრუქტორი"
          report={resume}
          extras={<ResumeExtras rows={data.resume} />}
        />
      ),
    },
  ];
  const quiet = sections.filter((section) => !section.node);
  return (
    <>
      <Activity data={data} />
      <div className="aa-grid">
        {sections.map(
          (section) =>
            section.node && (
              <div key={section.title} className="aa-cell">
                {section.node}
              </div>
            ),
        )}
      </div>
      {quiet.length > 0 && (
        <p className="aa-quiet-line">
          <span>ამ პერიოდში მონაცემი არ არის:</span>{' '}
          {quiet.map((section, index) => (
            <span key={section.title}>
              {index > 0 && ' · '}
              <b>{section.title}</b>
              {section.empty && ` — ${section.empty}`}
            </span>
          ))}
        </p>
      )}
      <Diagnostics rows={data.actions} />
    </>
  );
}

function Card({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="aa-card">
      <header>
        <h3>{title}</h3>
        {aside}
      </header>
      {hint && <p className="aa-hint">{hint}</p>}
      {children}
    </section>
  );
}

type Row = {
  key: string;
  label: ReactNode;
  /** The whole label, for a row cut short by the card's width. */
  title?: string;
  /** Length of the bar behind the row, 0 to 1. */
  bar: number;
  value: string;
  note?: string;
};

/* A ranked list: the bar behind each row ranks it before a number is read. Long
   lists show their top rows and open the rest in place. */
function Rows({
  rows,
  unit,
  limit = 5,
  tone,
}: {
  rows: Row[];
  unit: string;
  limit?: number;
  tone?: 'danger';
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? rows : rows.slice(0, limit);
  return (
    <>
      <ol className={`aa-rows${tone ? ` aa-rows--${tone}` : ''}`}>
        {shown.map((row) => (
          <li key={row.key}>
            <span
              className="aa-row-bar"
              style={{
                width: `${row.bar > 0 ? Math.max(2, Math.min(100, row.bar * 100)) : 0}%`,
              }}
              aria-hidden="true"
            />
            <span className="aa-row-label" title={row.title}>
              {row.label}
            </span>
            <span className="aa-row-value">
              {row.note && <span className="aa-row-note">{row.note}</span>}
              <b>
                {row.value}
                <span className="sr-only"> {unit}</span>
              </b>
            </span>
          </li>
        ))}
      </ol>
      {rows.length > limit && (
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm aa-more"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'ნაკლების ჩვენება' : `ყველას ჩვენება · ${rows.length}`}
        </button>
      )}
    </>
  );
}

/* Contacts and engagement are counted presses, each read against the views of the
   same window. A control nobody pressed stays listed, quieter. */
function Contacts({ totals }: { totals: AnalyticsSummary['totals'] }) {
  /* Only what was pressed gets a row; the rest are named on one line below. */
  const group = (items: readonly (readonly [string, number])[]) => {
    const used = items.filter(([, count]) => count > 0);
    const idle = items.filter(([, count]) => !count);
    return (
      <>
        {used.length > 0 && (
          <Rows
            unit="ჯერ"
            limit={8}
            rows={used.map(([label, count]) => ({
              key: label,
              label,
              bar: totals.view ? count / totals.view : 0,
              value: whole.format(count),
              note: share(count, totals.view),
            }))}
          />
        )}
        {idle.length > 0 && (
          <p className="aa-hint">
            0: {idle.map(([label]) => label).join(' · ')}
          </p>
        )}
      </>
    );
  };
  const engaged = totals.save + totals.saved_search + totals.application;
  return (
    <Card
      title="დაკავშირება და ჩართულობა"
      hint="რამდენჯერ დააჭირეს — არა ვინ. წილი ნახვებთან."
    >
      {group([
        ['პირველწყაროზე გადასვლა', totals.outbound],
        ['დარეკვა', totals.call],
        ['CV-ის გაგზავნა', totals.cv],
        ['განაცხადი კომპანიის საიტზე', totals.apply],
      ])}
      <h4 className="aa-subhead">
        ჩართულობა <b>{whole.format(engaged)}</b>
      </h4>
      {group([
        ['შენახული ვაკანსია', totals.save],
        ['შენახული ძებნა', totals.saved_search],
        ['განაცხადი', totals.application],
      ])}
    </Card>
  );
}

/** The plotted top: the highest count rounded up to something a person reads,
    and no further — a curve that peaks at 57 is drawn against 60, not 100. */
function ceiling(highest: number) {
  if (highest <= 4) return 4;
  const size = Math.pow(10, Math.floor(Math.log10(highest)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10])
    if (highest <= size * step) return size * step;
  return size * 10;
}

/* The headline: three counts as tabs, and the one chart below drawing the chosen one.
   The chart is drawn at the width it is shown, so its labels keep their real size on
   a phone and on a wide screen alike. */
function Activity({ data }: { data: AnalyticsSummary }) {
  const { activity: points, unit, totals } = data;
  const [selected, setSelected] = useState<Measure['key']>('search');
  const measure = measures.find((m) => m.key === selected)!;
  const notes: Record<Measure['key'], string> = {
    search: totals.search
      ? `უშედეგო ${whole.format(totals.search_empty)} · ${share(totals.search_empty, totals.search)}`
      : 'ძებნა არ ყოფილა',
    view: 'გახსნილი ვაკანსიის გვერდები',
    outbound: totals.view
      ? `ნახვის ${share(totals.outbound, totals.view)}`
      : 'პირველწყაროზე გადასვლა',
  };
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + measures.length) % measures.length;
    setSelected(measures[next].key);
    tabs.current[next]?.focus();
  };
  return (
    <section className="aa-chart">
      <div role="tablist" aria-label="მაჩვენებელი" className="aa-tabs">
        {measures.map((m, index) => (
          <button
            key={m.key}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`aa-tab-${m.key}`}
            aria-selected={m.key === selected}
            aria-controls="aa-chart-panel"
            tabIndex={m.key === selected ? 0 : -1}
            className="aa-tab"
            onClick={() => setSelected(m.key)}
            onKeyDown={(event) => move(event, index)}
          >
            <span className="aa-tab-label">
              <span className="aa-long">{m.name}</span>
              <span className="aa-short" aria-hidden="true">
                {m.short}
              </span>
            </span>
            <span className="aa-tab-value">{whole.format(totals[m.key])}</span>
            <span className="aa-tab-note">{notes[m.key]}</span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="aa-chart-panel"
        aria-labelledby={`aa-tab-${measure.key}`}
      >
        <Plot points={points} unit={unit} measure={measure} />
      </div>
    </section>
  );
}

function Plot({
  points,
  unit,
  measure,
}: {
  points: ActivityPoint[];
  unit: AnalyticsSummary['unit'];
  measure: Measure;
}) {
  const [at, setAt] = useState<number | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const box = {
    width,
    height: width < 480 ? 180 : 220,
    top: 12,
    right: 8,
    bottom: 26,
    left: 44,
  };
  const plot = {
    width: box.width - box.left - box.right,
    height: box.height - box.top - box.bottom,
  };
  const top = useMemo(
    () => ceiling(Math.max(1, ...points.map((p) => p[measure.key]))),
    [points, measure],
  );
  const busy = points.some((p) => p[measure.key] > 0);
  const x = (index: number) =>
    box.left +
    (points.length < 2
      ? plot.width / 2
      : (index / (points.length - 1)) * plot.width);
  const y = (value: number) =>
    box.top + plot.height - (value / top) * plot.height;
  const ticks = points.length
    ? [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
        (index, position, all) => all.indexOf(index) === position,
      )
    : [];
  const line = points
    .map(
      (point, index) =>
        `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point[measure.key]).toFixed(1)}`,
    )
    .join(' ');
  const area = points.length
    ? `${line} L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
    : '';
  const hovered = at === null ? null : points[at];
  return (
    <figure className="admin-activity aa-plot" ref={holder}>
      <figcaption className="sr-only">
        {measure.name} პერიოდის მიხედვით
      </figcaption>
      {!busy ? (
        <p className="aa-hint aa-plot-empty">
          ამ პერიოდში „{measure.name}“ არ დაფიქსირებულა.
        </p>
      ) : (
        <div className="admin-activity-plot">
          <svg
            viewBox={`0 0 ${box.width} ${box.height}`}
            width={box.width}
            height={box.height}
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
            <path d={area} fill={measure.colour} fillOpacity="0.08" />
            {hovered && (
              <line
                className="admin-activity-guide"
                x1={x(at!)}
                x2={x(at!)}
                y1={box.top}
                y2={box.top + plot.height}
              />
            )}
            <path
              fill="none"
              stroke={measure.colour}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d={line}
            />
            {hovered && (
              <circle
                cx={x(at!)}
                cy={y(hovered[measure.key])}
                r="4"
                fill={measure.colour}
                style={{ stroke: 'var(--ds-surface)' }}
                strokeWidth="2"
              />
            )}
          </svg>
          {hovered && (
            <div
              className="admin-activity-readout aa-readout"
              style={{
                left: `${Math.min(88, Math.max(12, (x(at!) / box.width) * 100))}%`,
              }}
            >
              <b>{bucketLabel(hovered.bucket, unit)}</b>
              {measures.map((m) => (
                <span
                  key={m.key}
                  className={m.key === measure.key ? undefined : 'aa-muted'}
                >
                  <i style={{ background: m.colour }} aria-hidden="true" />
                  {m.name}
                  <b>{whole.format(hovered[m.key])}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {/* A table ignores the 1px box of .sr-only and widened the phone layout to 565px;
          the wrapper is what gets clipped. */}
      <div className="sr-only">
        <table>
          <caption>აქტივობა პერიოდის მიხედვით</caption>
          <thead>
            <tr>
              <th scope="col">დრო</th>
              {measures.map((m) => (
                <th key={m.key} scope="col">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.bucket}>
                <th scope="row">{point.bucket}</th>
                {measures.map((m) => (
                  <td key={m.key}>{point[m.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Funnel({
  title,
  report,
  fieldLabels = {},
  extras,
}: {
  title: string;
  report: ReturnType<typeof buildFunnel>;
  /** Readable names for the fields in "ფორმამ არ მიიღო". */
  fieldLabels?: Record<string, string>;
  extras?: ReactNode;
}) {
  return (
    <Card
      title={title}
      hint="წილი გახსნებთან, კლება — წინა საფეხურთან. ითვლება საფეხურები, არა ადამიანები."
    >
      <Rows
        unit="ჯერ"
        limit={8}
        rows={report.steps.map((step, index) => ({
          key: step.name,
          label: step.label,
          bar: step.share / 100,
          value: whole.format(step.count),
          note:
            index > 0 && step.drop > 0
              ? `${step.share}% · −${step.drop}%`
              : `${step.share}%`,
        }))}
      />
      {extras}
      {!!report.left.length && (
        <p className="aa-hint">
          შეწყვიტა:{' '}
          {report.left
            .map((step) => `${step.label} — ${whole.format(step.count)}`)
            .join(' · ')}
        </p>
      )}
      {!!report.refused.length && (
        <p className="aa-hint">
          ფორმამ არ მიიღო:{' '}
          {report.refused
            .map(
              (step) =>
                `${fieldLabels[step.name] ?? step.name} — ${whole.format(step.count)}`,
            )
            .join(' · ')}
        </p>
      )}
    </Card>
  );
}

function PostExtras({ rows }: { rows: Ranked[] }) {
  const extras = rows
    .filter(({ value }) => value in postExtraLabels)
    .sort((a, b) => b.count - a.count);
  if (!extras.length) return null;
  return (
    <p className="aa-hint">
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
        <p className="aa-hint">შაბლონი: {describe(templates)}</p>
      )}
      {!!styles.length && <p className="aa-hint">სტილი: {describe(styles)}</p>}
      {cleared && <p className="aa-hint">{describe([cleared])}</p>}
    </>
  );
}

/* Public controls and the errors readers meet, by group, folded away: they answer
   "does anyone use this?" when asked, not on every visit. Each row is a count of
   presses — one reader pressing twice is two, and nobody is recognised between
   presses. A control nobody used is still named, because that is a finding too. */
function Diagnostics({ rows }: { rows: Ranked[] }) {
  const groups = groupActions(
    rows,
    (filter) => `ფილტრის მოხსნა უშედეგოდან: ${filterNames[filter] ?? filter}`,
  );
  const errors = groups.find((group) => group.title === 'შეცდომები');
  const used = groups
    .filter((group) => group !== errors)
    .reduce((sum, group) => sum + group.total, 0);
  return (
    <details className="aa-diag">
      <summary>
        <ChevronDown className="admin-summary-mark" aria-hidden="true" />
        <span className="aa-diag-title">დიაგნოსტიკა</span>
        <span className="aa-diag-meta">
          ღილაკები და ნავიგაცია {whole.format(used)}
          {errors && (
            <>
              {' · '}
              <span className={errors.total ? 'aa-danger' : undefined}>
                შეცდომა {whole.format(errors.total)}
              </span>
            </>
          )}
        </span>
      </summary>
      <p className="aa-hint">
        რამდენჯერ დააჭირეს ან შეხვდა — არა რამდენმა ადამიანმა.
      </p>
      <div className="aa-groups">
        {groups.map((group) => {
          const isErrors = group === errors;
          const active = group.rows.filter((row) => row.count > 0);
          const idle = group.rows.filter((row) => !row.count);
          const highest = active[0]?.count || 1;
          return (
            <section key={group.title} className="aa-card aa-group">
              <header>
                <h4>{group.title}</h4>
                <b
                  className={isErrors && group.total ? 'aa-danger' : undefined}
                >
                  {whole.format(group.total)}
                </b>
              </header>
              {active.length > 0 && (
                <Rows
                  unit="ჯერ"
                  tone={isErrors ? 'danger' : undefined}
                  rows={active.map((row) => ({
                    key: row.code,
                    label: row.label,
                    title: row.label,
                    bar: row.count / highest,
                    value: whole.format(row.count),
                  }))}
                />
              )}
              {idle.length > 0 && (
                <p className="aa-hint">
                  {isErrors ? 'არ დაფიქსირებულა' : 'არ გამოუყენებიათ'}:{' '}
                  {idle.map((row) => row.label).join(' · ')}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </details>
  );
}
