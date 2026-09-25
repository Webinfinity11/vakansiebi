'use client';
import { trackAction } from '@/lib/analytics-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Footprints,
  LoaderCircle,
  MapPin,
  Navigation,
  Search,
  TrainFront,
  X,
} from 'lucide-react';
import { CompanyLogo } from '../company-logo';
import { MetroMap } from './metro-map';
import { compactSalary } from '@/lib/vacancy-presentation';
import { vacancySegment } from '@/lib/vacancy-navigation';
import { distanceMeters, formatDistance, formatWalk } from '@/lib/geo';
import {
  metroDefaultWalk,
  metroLines,
  metroPath,
  metroStations,
  metroWalkChoices,
  stationBySlug,
  type MetroLine,
  type MetroStation,
} from '@/lib/tbilisi-metro';
import type { MetroVacancy } from '@/lib/server/metro-jobs';

type Counts = Record<string, number> | null;
const whole = new Intl.NumberFormat('ka-GE');
const lines: MetroLine[] = [1, 2];
const vacancyWord = (n: number) => `${whole.format(n)} ვაკანსია`;
const href = (v: MetroVacancy) =>
  `/vacancies/${encodeURIComponent(vacancySegment(v))}`;
/* Georgian search: case folding is a no-op for Mkhedruli, so trimming and lowercasing the Latin
   remainder is enough; "მოედანი" finds both interchange platforms. */
const matches = (s: MetroStation, q: string) =>
  !q || s.name.toLowerCase().includes(q) || s.slug.includes(q);

/* ── "Nearest station": the position is used here, in the browser, and never sent anywhere. */
const farAway = 5000;
function useNearest() {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: 'idle' | 'locating' }
    | { kind: 'error'; text: string }
    | { kind: 'far'; station: MetroStation; meters: number }
  >({ kind: 'idle' });
  const locate = useCallback(() => {
    trackAction('metro_nearest');
    if (!('geolocation' in navigator)) {
      setState({ kind: 'error', text: 'ბრაუზერი მდებარეობას ვერ გვიზიარებს.' });
      return;
    }
    setState({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        let best = metroStations[0];
        let meters = Infinity;
        for (const s of metroStations) {
          const d = distanceMeters(
            coords.latitude,
            coords.longitude,
            s.lat,
            s.lon,
          );
          if (d < meters) [best, meters] = [s, d];
        }
        if (meters > farAway) setState({ kind: 'far', station: best, meters });
        else {
          setState({ kind: 'idle' });
          router.push(metroPath(best));
        }
      },
      (e) =>
        setState({
          kind: 'error',
          text:
            e.code === e.PERMISSION_DENIED
              ? 'მდებარეობაზე წვდომა დაბლოკილია — აირჩიე სადგური სიიდან.'
              : 'მდებარეობა ვერ დადგინდა — აირჩიე სადგური სიიდან.',
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [router]);
  return { state, locate };
}

function NearestButton({
  nearest,
  compact = false,
}: {
  nearest: ReturnType<typeof useNearest>;
  compact?: boolean;
}) {
  const busy = nearest.state.kind === 'locating';
  return (
    <button
      type="button"
      className={`ds-btn ${compact ? 'ds-btn--secondary' : 'ds-btn--primary'}`}
      onClick={nearest.locate}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? (
        <LoaderCircle className="metro-spin" aria-hidden="true" />
      ) : (
        <Navigation aria-hidden="true" />
      )}
      {compact ? 'ჩემთან ახლოს' : 'ჩემთან უახლოესი სადგური'}
    </button>
  );
}

function NearestNote({ nearest }: { nearest: ReturnType<typeof useNearest> }) {
  const { state } = nearest;
  if (state.kind === 'error')
    return (
      <p className="metro-note" aria-live="polite">
        {state.text}
      </p>
    );
  if (state.kind === 'far')
    return (
      <p className="metro-note" aria-live="polite">
        უახლოესი სადგური —{' '}
        <Link href={metroPath(state.station)}>{state.station.name}</Link>,{' '}
        {formatDistance(state.meters)}. ფეხით მისასვლელად შორსაა, მაგრამ
        შეგიძლია მისი ვაკანსიები ნახო.
      </p>
    );
  return null;
}

function LineDot({ line }: { line: MetroLine }) {
  return <span className="metro-dot" data-line={line} aria-hidden="true" />;
}

/* ── Every station, by line in travel order, or by how many vacancies it has. */
function StationDirectory({
  counts,
  current,
  query,
  byCount,
  onPick,
}: {
  counts: Counts;
  current?: string;
  query: string;
  byCount: boolean;
  onPick?: () => void;
}) {
  const q = query.trim().toLowerCase();
  const row = (s: MetroStation, showLine: boolean) => {
    const n = counts?.[s.slug];
    return (
      <li key={s.slug}>
        <Link
          href={metroPath(s)}
          className="metro-station"
          data-line={s.line}
          aria-current={s.slug === current ? 'page' : undefined}
          onClick={onPick}
        >
          {showLine ? (
            <LineDot line={s.line} />
          ) : (
            <span className="metro-stop" aria-hidden="true" />
          )}
          <span className="metro-station-name">{s.name}</span>
          {n !== undefined && (
            <span className={`ds-badge${n ? ' ds-badge--accent' : ''}`}>
              {vacancyWord(n)}
            </span>
          )}
        </Link>
      </li>
    );
  };
  const found = metroStations.filter((s) => matches(s, q));
  if (!found.length)
    return <p className="metro-note">ასეთი სადგური ვერ ვიპოვეთ.</p>;
  if (byCount)
    return (
      <ul className="metro-stations metro-stations--flat">
        {[...found]
          .sort(
            (a, b) =>
              (counts?.[b.slug] ?? 0) - (counts?.[a.slug] ?? 0) ||
              a.name.localeCompare(b.name, 'ka'),
          )
          .map((s) => row(s, true))}
      </ul>
    );
  return (
    <div className="metro-lines">
      {lines.map((line) => {
        const list = found.filter((s) => s.line === line);
        if (!list.length) return null;
        const total = list.reduce((sum, s) => sum + (counts?.[s.slug] ?? 0), 0);
        return (
          <section key={line} className="metro-line" data-line={line}>
            <h2>
              <LineDot line={line} />
              <span>
                {metroLines[line].name}
                <small>
                  {list.length} სადგური
                  {counts && ` · ${vacancyWord(total)}`}
                </small>
              </span>
            </h2>
            <ul className="metro-stations">{list.map((s) => row(s, false))}</ul>
          </section>
        );
      })}
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  focusOnOpen = false,
}: {
  value: string;
  onChange: (v: string) => void;
  focusOnOpen?: boolean;
}) {
  // A picker opened on purpose is for typing in — with a keyboard. On a touch screen the
  // on-screen keyboard would cover the list the reader is about to tap.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnOpen && matchMedia('(pointer: fine)').matches)
      input.current?.focus();
  }, [focusOnOpen]);
  return (
    <label className="metro-search">
      <Search aria-hidden="true" />
      <input
        type="search"
        value={value}
        ref={input}
        placeholder="სადგურის ძებნა"
        aria-label="სადგურის ძებნა"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ── The overview: no station chosen yet. */
function Overview({ counts }: { counts: Counts }) {
  const nearest = useNearest();
  const [query, setQuery] = useState('');
  const [byCount, setByCount] = useState(false);
  return (
    <main className="metro metro--overview">
      <header className="metro-hero">
        <span className="metro-hero-mark" aria-hidden="true">
          <TrainFront />
        </span>
        <div>
          <h1>ვაკანსიები მეტროს სადგურთან</h1>
          <p>
            აირჩიე სადგური და ნახე, რა სამსახურია {metroDefaultWalk} წუთის
            სავალზე — მანძილით და ფეხით სავალი დროით.
          </p>
        </div>
        <NearestButton nearest={nearest} />
        <NearestNote nearest={nearest} />
      </header>
      <div className="metro-tools">
        <SearchBox value={query} onChange={setQuery} />
        <fieldset className="metro-chips" aria-label="დალაგება">
          <button
            type="button"
            className="ds-chip"
            aria-pressed={!byCount}
            onClick={() => setByCount(false)}
          >
            ხაზების მიხედვით
          </button>
          <button
            type="button"
            className="ds-chip"
            aria-pressed={byCount}
            onClick={() => setByCount(true)}
          >
            ვაკანსიების რაოდენობით
          </button>
        </fieldset>
      </div>
      {counts === null && (
        <p className="metro-note" role="alert">
          ვაკანსიების რაოდენობა ახლა ვერ ჩაიტვირთა — სადგურის არჩევა მაინც
          შეიძლება.
        </p>
      )}
      <StationDirectory counts={counts} query={query} byCount={byCount} />
      <p className="metro-foot">
        <Footprints aria-hidden="true" />
        რაოდენობაში ის ვაკანსიებია, რომელთა სამუშაო ადგილი სადგურიდან{' '}
        {metroDefaultWalk} წუთის სავალზეა; ერთი ვაკანსია ორ ახლო სადგურთანაც
        შეიძლება ჩანდეს. ფეხით სავალი დრო მიახლოებითია: პირდაპირი მანძილი + 25%
        ქუჩების გამო, 80 მ წუთში.
      </p>
    </main>
  );
}

/* ── The station switcher: a searchable list in a popover. */
function StationPicker({
  station,
  counts,
}: {
  station: MetroStation;
  counts: Counts;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panel = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === 'Escape'
          : !root.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open]);
  return (
    <div className="metro-picker" ref={root}>
      <button
        type="button"
        className="ds-btn ds-btn--secondary metro-picker-trigger"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
      >
        <Search aria-hidden="true" />
        სადგურის შეცვლა
      </button>
      {open && (
        <div
          className="metro-picker-scrim"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <div className="metro-picker-panel" id={panel}>
          <div className="metro-picker-head">
            <SearchBox value={query} onChange={setQuery} focusOnOpen />
            <button
              type="button"
              className="ds-btn ds-btn--ghost ds-btn--icon"
              aria-label="დახურვა"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <StationDirectory
            counts={counts}
            current={station.slug}
            query={query}
            byCount={false}
            onPick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

/* ── One station: the walk switch, the list and the map. */
function StationView({
  station,
  vacancies,
  counts,
  neighbours,
  initialWalk,
}: {
  station: MetroStation;
  vacancies: MetroVacancy[] | null;
  counts: Counts;
  neighbours: string[];
  initialWalk: number;
}) {
  const nearest = useNearest();
  const [walk, setWalk] = useState(initialWalk);
  const [hovered, setHovered] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const all = useMemo(() => vacancies ?? [], [vacancies]);
  const shown = useMemo(
    () => all.filter((v) => v.minutes <= walk),
    [all, walk],
  );
  const within = (m: number) => all.filter((v) => v.minutes <= m).length;

  const chooseWalk = (m: number) => {
    trackAction('metro_walk');
    setWalk(m);
    // The walk is kept in the address so a shared link opens the same list; the canonical
    // address stays the station alone.
    const url = new URL(location.href);
    if (m === metroDefaultWalk) url.searchParams.delete('walk');
    else url.searchParams.set('walk', String(m));
    history.replaceState(history.state, '', url);
  };
  const pick = useCallback((id: string) => {
    setActive(id);
    document
      .getElementById(`metro-job-${id}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const twin = metroStations.find(
    (s) =>
      s.slug !== station.slug &&
      s.name.split('-')[0] === station.name.split('-')[0],
  );
  const nextWalk = metroWalkChoices.find((m) => m > walk && within(m) > 0);

  return (
    <main className="metro metro--station">
      <div className="metro-bar">
        <Link
          href="/metro"
          className="ds-btn ds-btn--ghost ds-btn--sm metro-back"
        >
          <TrainFront aria-hidden="true" />
          ყველა სადგური
        </Link>
        <div className="metro-title">
          <h1>
            <LineDot line={station.line} />
            მეტრო {station.name}
          </h1>
          <p>
            <span className="metro-line-name" data-line={station.line}>
              {metroLines[station.line].short}
            </span>
            {vacancies && (
              <>
                {' · '}
                {vacancyWord(shown.length)} {walk} წუთის სავალზე
              </>
            )}
            {twin && (
              <>
                {' · '}
                გადასასვლელი:{' '}
                <Link href={metroPath(twin)}>
                  {metroLines[twin.line].short}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="metro-controls">
          <fieldset className="metro-chips" aria-label="ფეხით სავალი დრო">
            {metroWalkChoices.map((m) => (
              <button
                key={m}
                type="button"
                className="ds-chip"
                aria-pressed={walk === m}
                onClick={() => chooseWalk(m)}
              >
                <Footprints aria-hidden="true" />
                {m} წთ
              </button>
            ))}
          </fieldset>
          <StationPicker station={station} counts={counts} />
          <NearestButton nearest={nearest} compact />
        </div>
        <NearestNote nearest={nearest} />
      </div>

      <div className="metro-body">
        <div className="metro-canvas">
          <MetroMap
            station={station}
            vacancies={shown}
            walk={walk}
            lit={hovered ?? active}
            onPick={pick}
          />
        </div>
        <section className="metro-list" aria-label="ვაკანსიები">
          {vacancies === null && (
            <p className="metro-note" role="alert">
              ვაკანსიები ახლა ვერ ჩაიტვირთა. სცადე ცოტა ხანში.
            </p>
          )}
          {vacancies && !shown.length && (
            <div className="metro-empty">
              <span className="metro-empty-mark" aria-hidden="true">
                <Footprints />
              </span>
              <strong>{walk} წუთის სავალზე ვაკანსია ჯერ არ ჩანს</strong>
              <p>
                აქ მხოლოდ ის ვაკანსიებია, რომელთა მისამართიც შენობამდე დადგინდა.
              </p>
              {nextWalk && (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary"
                  onClick={() => chooseWalk(nextWalk)}
                >
                  <Footprints aria-hidden="true" />
                  {nextWalk} წუთის სავალზე — {vacancyWord(within(nextWalk))}
                </button>
              )}
              {!!neighbours.length && (
                <div className="metro-empty-near">
                  <span>ახლომახლო სადგურები</span>
                  <ul>
                    {neighbours.map((slug) => {
                      const s = stationBySlug(slug);
                      if (!s) return null;
                      const n = counts?.[slug];
                      return (
                        <li key={slug}>
                          <Link href={metroPath(s)} className="ds-chip">
                            <LineDot line={s.line} />
                            {s.name}
                            {n !== undefined && <b>{whole.format(n)}</b>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
          {!!shown.length && (
            <ul className="metro-jobs">
              {shown.map((v) => (
                <li key={v.id} id={`metro-job-${v.id}`}>
                  <a
                    href={href(v)}
                    onClick={() => trackAction('metro_open')}
                    className="metro-job"
                    data-active={active === v.id}
                    onMouseEnter={() => setHovered(v.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(v.id)}
                    onBlur={() => setHovered(null)}
                  >
                    <CompanyLogo company={v.company} url={v.logoUrl} />
                    <span className="metro-job-text">
                      <span className="metro-job-walk">
                        <span className="ds-badge ds-badge--accent">
                          <Footprints aria-hidden="true" />
                          {formatWalk(v.minutes)}
                        </span>
                        <span className="metro-job-meters">
                          {formatDistance(v.meters)}
                        </span>
                        {v.premium && (
                          <span className="ds-badge ds-badge--warning">
                            პრემიუმი
                          </span>
                        )}
                      </span>
                      <strong>{v.title}</strong>
                      {v.company && <span>{v.company}</span>}
                      {v.salary && (
                        <b>{compactSalary(v.salary, v.salaryPeriod)}</b>
                      )}
                      {v.place[2] && (
                        <small>
                          <MapPin aria-hidden="true" />
                          {v.place[2]}
                        </small>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="metro-foot">
            <Footprints aria-hidden="true" />
            დრო მიახლოებითია: პირდაპირი მანძილი სადგურიდან + 25% ქუჩების გამო,
            80 მ წუთში. სიაში მხოლოდ ზუსტი მისამართის მქონე ვაკანსიებია.
          </p>
        </section>
      </div>
    </main>
  );
}

export function MetroJobs({
  station,
  vacancies,
  counts,
  neighbours,
  initialWalk,
}: {
  station: MetroStation | null;
  vacancies: MetroVacancy[] | null;
  counts: Counts;
  neighbours: string[];
  initialWalk: number;
}) {
  // One count per page shown: the overview, or a station.
  const slug = station?.slug;
  useEffect(() => trackAction(slug ? 'metro_station' : 'metro_page'), [slug]);
  if (!station) return <Overview counts={counts} />;
  return (
    <StationView
      station={station}
      vacancies={vacancies}
      counts={counts}
      neighbours={neighbours}
      initialWalk={initialWalk}
    />
  );
}
