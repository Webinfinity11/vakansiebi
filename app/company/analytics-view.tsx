'use client';
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Lightbulb } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  actionLabels,
  contactRate,
  contacts,
  emptyCounts,
  sumCounts,
  sumSeries,
  windowCounts,
  type CompanyJobStats,
} from '@/lib/company-analytics';
import { seriesDays, type VacancyDay } from '@/lib/vacancy-analytics';
import { candidateSources, candidateHireTime } from '@/lib/company-analytics-extra';
import './analytics-extra.css';
import { StatusMark } from './status-mark';
import type { Candidate } from '@/lib/company-candidates';
import { daysLeft, type CompanyJob } from './company-api';

type Measure = 'view' | 'contact';
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
const shortDay = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${months[m - 1]}`;
};
const nf = new Intl.NumberFormat('en-US');
const num = (n: number) => nf.format(n).replace(/,/g, ' ');
const pct = (r: number | null) =>
  r === null ? '—' : `${(r * 100).toFixed(r > 0 && r < 0.1 ? 1 : 0)}%`;
const dayValue = (d: VacancyDay, m: Measure) =>
  m === 'view' ? d.view : contacts(d);

/** Change of the last seven days against the seven before them; null when there is no base. */
function trend(series: VacancyDay[], m: Measure) {
  const now = windowCounts(series, 7);
  const before = windowCounts(series, 7, 7);
  const a = m === 'view' ? now.view : contacts(now);
  const b = m === 'view' ? before.view : contacts(before);
  return b ? (a - b) / b : null;
}

function Trend({ value }: { value: number | null }) {
  if (value === null)
    return <span className="an-trend">წინა კვირასთან შედარება ჯერ არ არის</span>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="an-trend" data-dir={up ? 'up' : 'down'}>
      <Icon size={14} aria-hidden />
      {up ? '+' : '−'}
      {Math.abs(Math.round(value * 100))}% წინა კვირასთან </span>
  );
}

export function AnalyticsView({
  stats,
  loaded,
  jobs,
  candidates,
  onOpenJob,
  canEdit = true,
}: {
  stats: CompanyJobStats[];
  loaded: boolean;
  jobs: CompanyJob[];
  candidates: Candidate[];
  onOpenJob: (job: CompanyJob) => void;
  canEdit?: boolean;
}) {
  const [job, setJob] = useState<string>('all');
  const [measure, setMeasure] = useState<Measure>('view');
  const [hover, setHover] = useState<number | null>(null);
  const titles = useMemo(
    () => new Map(jobs.map((j) => [j.id, j] as const)),
    [jobs],
  );
  const scope = job === 'all' ? stats : stats.filter((s) => s.id === job);
  const series = useMemo(() => sumSeries(scope.map((s) => s.series)), [scope]);
  const month = useMemo(() => sumCounts(series), [series]);
  const total = useMemo(
    () => (scope.length ? sumCounts(scope.map((s) => s.total)) : emptyCounts()),
    [scope],
  );
  const since = series[0]?.day;
  const today = new Date().toISOString().slice(0, 10);
  const period = {
    first: since ?? new Date(Date.parse(today) - (seriesDays - 1) * 864e5).toISOString().slice(0, 10),
    last: series.at(-1)?.day ?? today,
    jobId: job === 'all' ? undefined : job,
  };
  const sources = candidateSources(candidates, period);
  const hireTime = candidateHireTime(candidates, period);
  const sourceLabels = {
    applied: 'ვაკანსიაზე გამოგზავნილი',
    upload: 'თქვენ მიერ ატვირთული',
    cv_box: 'CV ყუთი',
  };
  const applied = candidates.filter(
    (c) =>
      (job === 'all' || c.jobId === job) &&
      since &&
      c.appliedAt.slice(0, 10) >= since,
  ).length;
  const perJob = useMemo(() => {
    const byJob = new Map<string, number>();
    for (const c of candidates)
      if (c.jobId && (!since || c.appliedAt.slice(0, 10) >= since))
        byJob.set(c.jobId, (byJob.get(c.jobId) ?? 0) + 1);
    return stats
      .map((s) => ({
        stats: s,
        job: titles.get(s.id),
        month: sumCounts(s.series),
        week: windowCounts(s.series, 7),
        candidates: byJob.get(s.id) ?? 0,
      }))
      .filter((r) => r.job)
      .sort((a, b) => b.month.view - a.month.view);
  }, [stats, candidates, titles, since]);
  const average = contactRate(month);
  const tips = useMemo(() => {
    const all = contactRate(sumCounts(perJob.map((r) => r.month)));
    const out: { id: string; text: string; job: CompanyJob }[] = [];
    for (const r of perJob) {
      const j = r.job!;
      if (j.status !== 'published') continue;
      const rate = contactRate(r.month);
      const left = daysLeft(j.form.deadline);
      if (r.month.view >= 20 && rate !== null && all && rate < all / 2)
        out.push({
          id: j.id + 'rate',
          job: j,
          text: `„${j.title}“ ბევრი ნახულობს, მაგრამ ცოტა გიკავშირდებათ. გადახედეთ ხელფასს, მოთხოვნებს და იმას, რამდენად ნათლად წერია, რას აკეთებს თანამშრომელი.`,
        });
      if (!j.imported && !j.form.salaryFrom && !j.form.salaryTo)
        out.push({
          id: j.id + 'salary',
          job: j,
          text: `„${j.title}“: ხელფასი მითითებული არ არის. ანაზღაურების დიაპაზონი კანდიდატს გადაწყვეტილებას უადვილებს.`,
        });
      if (left !== null && left >= 0 && left <= 3)
        out.push({
          id: j.id + 'deadline',
          job: j,
          text: `„${j.title}“: ვადა ${left === 0 ? 'დღეს' : `${left} დღეში`} იწურება. თუ კანდიდატი ჯერ არ შეგირჩევიათ, ვადა გააგრძელეთ.`,
        });
      const age = (Date.now() - Date.parse(r.stats.publishedAt)) / 864e5;
      if (age >= 7 && r.week.view === 0)
        out.push({
          id: j.id + 'quiet',
          job: j,
          text: `„${j.title}“ ბოლო კვირაში არავის უნახავს. სცადეთ უფრო მარტივი, ხშირად მოძებნილი დასახელება.`,
        });
    }
    return out.slice(0, 5);
  }, [perJob]);

  const values = series.map((d) => dayValue(d, measure));
  const max = Math.max(1, ...values);
  const step = max <= 5 ? 1 : Math.ceil(max / 4 / 5) * 5;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) =>
    Math.round(i * step),
  ).reverse();
  const actions = (
    ['cv', 'call', 'email', 'apply', 'outbound', 'save'] as const
  ).map((k) => ({ kind: k, label: actionLabels[k], n: month[k] }));
  const actionMax = Math.max(1, ...actions.map((a) => a.n));
  const selectedTitle =
    job === 'all' ? 'ყველა ვაკანსია' : (titles.get(job)?.title ?? 'ვაკანსია');
  const shown = hover ?? series.length - 1;

  const extraCards = (
        <div className="an-extra">
          <section className="an-card" aria-labelledby="an-hire-heading">
            <div className="an-card-head">
              <div>
                <h2 id="an-hire-heading"><StatusMark kind="hired">საშუალო დრო განაცხადიდან აყვანამდე</StatusMark></h2>
                <p>ბოლო 30 დღე · {selectedTitle}</p>
              </div>
            </div>
            {hireTime.averageDays === null ? (
              <p className="an-none">მონაცემი დაგროვდება პირველი აყვანის შემდეგ.</p>
            ) : <>
              <p className="an-hire-value">{Number(hireTime.averageDays.toFixed(1))}  დღე</p>
              <p className="an-none">{num(hireTime.measuredHires)}  აყვანილი კანდიდატის მიხედვით</p>
            </>}
          </section>
          <section className="an-card" aria-labelledby="an-sources-heading">
            <div className="an-card-head">
              <div>
                <h2 id="an-sources-heading">კანდიდატები წყაროს მიხედვით</h2>
                <p>ბოლო 30 დღეში მიღებული განაცხადები და ატვირთული რეზიუმეები</p>
              </div>
            </div>
            {sources.some((source) => source.count > 0) ? (
              <ul className="an-source-list">
                {sources.map((source) => (
                  <li key={source.source}>
                    <div><span>{sourceLabels[source.source]}</span><b>{num(source.count)} · {pct(source.share)}</b></div>
                    <span className="an-track" aria-hidden="true">
                      <i style={{ width: `${source.share * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="an-none">ამ პერიოდში კანდიდატები არ არის.</p>}
          </section>
        </div>
  );

  return (
    <>
      <header className="cp-head">
        <div className="cp-head-title">
          <h1>ანალიტიკა</h1>
          <span>ბოლო 30 დღე</span>
        </div>
        <div className="cp-head-actions">
          <DropdownMenu>
            <DropdownMenuTrigger className="cp-btn cp-btn--primary an-filter">
              {selectedTitle}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-64">
              <DropdownMenuItem onClick={() => setJob('all')}>
                 ყველა ვაკანსია </DropdownMenuItem>
              {perJob.map((r) => (
                <DropdownMenuItem
                  key={r.stats.id}
                  onClick={() => setJob(r.stats.id)}
                >
                  {r.job!.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!loaded ? (
        <div className="cc-empty">იტვირთება…</div>
      ) : !stats.length ? (
        <>
        <div className="cp-empty">
          <h2>მონაცემები ჯერ არ არის</h2>
          <p>
             ანალიტიკა ვაკანსიის გამოქვეყნებისთანავე დაიწყება: ნახავთ, რამდენმა ნახა, შეინახა და დაგიკავშირდათ. </p>
        </div>
        {extraCards}
        </>
      ) : (
        <>
          <div className="an-kpis">
            <div>
              <span className="cp-metric-label">ნახვა</span>
              <strong>{num(month.view)}</strong>
              <Trend value={trend(series, 'view')} />
            </div>
            <div>
              <span className="cp-metric-label">დაკავშირების მცდელობა</span>
              <strong>{num(contacts(month))}</strong>
              <Trend value={trend(series, 'contact')} />
            </div>
            <div>
              <span className="cp-metric-label">კონვერსია</span>
              <strong>{pct(average)}</strong>
              <span className="an-trend">ნახვიდან დაკავშირებამდე</span>
            </div>
            <div>
              <span className="cp-metric-label">განაცხადი პანელში</span>
              <strong>{num(applied)}</strong>
              <span className="an-trend">
                {month.view
                  ? `${pct(applied / month.view)} ნახვიდან განაცხადამდე`
                  : 'ნახვები ჯერ არ არის'}
              </span>
            </div>
          </div>

          <section className="an-card">
            <div className="an-card-head">
              <div>
                <h2>
                  {measure === 'view'
                    ? 'ნახვები დღეების მიხედვით'
                    : 'დაკავშირების მცდელობები დღეების მიხედვით'}
                </h2>
                <p>
                  {series[shown] && (
                    <>
                      {shortDay(series[shown].day)}:{' '}
                      <b>{num(values[shown])}</b>{' '}
                      {measure === 'view' ? 'ნახვა' : 'მცდელობა'}
                    </>
                  )}
                </p>
              </div>
              <div className="cc-switch" role="group" aria-label="მაჩვენებელი">
                <button
                  type="button"
                  aria-pressed={measure === 'view'}
                  onClick={() => setMeasure('view')}
                >
                   ნახვა </button>
                <button
                  type="button"
                  aria-pressed={measure === 'contact'}
                  onClick={() => setMeasure('contact')}
                >
                   დაკავშირება </button>
              </div>
            </div>
            <div className="an-chart" onMouseLeave={() => setHover(null)}>
              <div className="an-axis" aria-hidden>
                {ticks.map((t) => (
                  <span key={t}>{num(t)}</span>
                ))}
              </div>
              <div className="an-plot">
                <div className="an-grid" aria-hidden>
                  {ticks.map((t) => (
                    <span key={t} />
                  ))}
                </div>
                <div
                  className="an-bars"
                  role="list"
                  aria-label={
                    measure === 'view' ? 'ნახვები დღეებად' : 'დაკავშირება დღეებად'
                  }
                >
                  {series.map((d, i) => {
                    const v = values[i];
                    return (
                      <div
                        key={d.day}
                        role="listitem"
                        className="an-bar"
                        data-active={hover === i || undefined}
                        aria-label={`${shortDay(d.day)}: ${v}`}
                        onMouseEnter={() => setHover(i)}
                      >
                        <i style={{ height: `${(v / top) * 100}%` }} />
                        {hover === i && (
                          <div
                            className="an-tip"
                            data-side={i > series.length - 8 ? 'left' : undefined}
                          >
                            <strong>{shortDay(d.day)}</strong>
                            <span>
                               ნახვა <b>{num(d.view)}</b>
                            </span>
                            <span>
                               დაკავშირება <b>{num(contacts(d))}</b>
                            </span>
                            <span>
                               შენახვა <b>{num(d.save)}</b>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="an-xaxis" aria-hidden>
                  {series.map((d, i) => (
                    <span key={d.day}>
                      {(i % 7 === 0 && i < series.length - 4) || i === series.length - 1
                        ? shortDay(d.day)
                        : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {extraCards}

          <div className="an-split">
            <section className="an-card">
              <div className="an-card-head">
                <div>
                  <h2>რას აკეთებენ ნახვის შემდეგ</h2>
                  <p>ბოლო 30 დღე, {selectedTitle.toLowerCase()}</p>
                </div>
              </div>
              <ul className="an-actions">
                {actions.map((a) => (
                  <li key={a.kind}>
                    <span>{a.label}</span>
                    <span className="an-track">
                      <i style={{ width: `${(a.n / actionMax) * 100}%` }} />
                    </span>
                    <b>{num(a.n)}</b>
                  </li>
                ))}
              </ul>
            </section>
            <section className="an-card">
              <div className="an-card-head">
                <div>
                  <h2>რჩევები</h2>
                  <p>თქვენი ვაკანსიების მონაცემებიდან</p>
                </div>
              </div>
              {tips.length ? (
                <ul className="an-tips">
                  {tips.map((t) => (
                    <li key={t.id}>
                      {t.id.endsWith('deadline') ? <StatusMark kind="expiring">{null}</StatusMark> : <Lightbulb size={16} aria-hidden />}
                      <div>
                        <p>{t.text}</p>
                        {canEdit && (
                          <button type="button" onClick={() => onOpenJob(t.job)}>
                             ვაკანსიის რედაქტირება </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="an-none">
                   ყველაფერი რიგზეა: საყურადღებო ვაკანსია ახლა არ გაქვთ. </p>
              )}
            </section>
          </div>

          <section className="an-card an-card--table">
            <div className="an-card-head">
              <div>
                <h2>ვაკანსიების მიხედვით</h2>
                <p>დააჭირეთ მწკრივს, რომ მხოლოდ ის ვაკანსია ნახოთ</p>
              </div>
            </div>
            <div className="cp-table an-table" role="table">
              <div className="cp-row cp-row--head" role="row">
                <span role="columnheader">ვაკანსია</span>
                <span role="columnheader">ნახვა (30 დღე)</span>
                <span role="columnheader">ბოლო 7 დღე</span>
                <span role="columnheader">დაკავშირება</span>
                <span role="columnheader">დაკავშირების %</span>
                <span role="columnheader">განაცხადი</span>
              </div>
              {perJob.map((r) => (
                <div
                  key={r.stats.id}
                  className="cp-row"
                  role="row"
                  aria-selected={job === r.stats.id}
                  tabIndex={0}
                  onClick={() =>
                    setJob(job === r.stats.id ? 'all' : r.stats.id)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      setJob(job === r.stats.id ? 'all' : r.stats.id);
                  }}
                >
                  <span className="cp-cell-title" role="cell">
                    <strong>{r.job!.title}</strong>
                    <span>
                       სულ {num(r.stats.total.view)}  ნახვა გამოქვეყნებიდან </span>
                  </span>
                  <span role="cell" className="an-num">
                    {num(r.month.view)}
                  </span>
                  <span role="cell" className="an-num">
                    {num(r.week.view)}
                  </span>
                  <span role="cell" className="an-num">
                    {num(contacts(r.month))}
                  </span>
                  <span role="cell" className="an-num">
                    {pct(contactRate(r.month))}
                  </span>
                  <span role="cell" className="an-num">
                    {num(r.candidates)}
                    {r.month.view > 0 && (
                      <small> · {pct(r.candidates / r.month.view)}</small>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <p className="an-foot">
             მონაცემები ანონიმურია: ვითვლით ქმედებებს და არა ადამიანებს. ერთმა ადამიანმა რამდენჯერმე ნახვა შეიძლება ცალკე ჩაითვალოს. სულ{' '}
            {num(total.view)}  ნახვა გამოქვეყნებიდან. </p>
        </>
      )}
    </>
  );
}
