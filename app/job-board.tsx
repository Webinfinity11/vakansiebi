'use client';
import './board-features.css';
import { VacancyStatus } from './vacancy-status';
import { useSwipe } from './use-swipe';
import { RecentVacancies } from './recent-vacancies';
import { SearchSuggest } from './search-suggest';
import { nearestCity } from '@/lib/nearest-city';
import type { Application } from '@/lib/personal-space';
import { compactSalary } from '@/lib/vacancy-presentation';
import Link from 'next/link';
import AdvancedFilterControls, {
  advancedDefaults,
  employmentLabels,
  type AdvancedFilters,
} from './advanced-filters';
import type { SearchMeta, FilterKey } from '@/lib/server/search-plan';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';
export { Brand } from './brand';
import { formatDate } from './vacancy-text';
import {
  vacancyPath,
  searchReturnPath,
  rememberSearch,
  restoreSearch,
} from '@/lib/vacancy-navigation';
import { readSearch, searchParams } from '@/lib/search-state';
import { shareLink } from '@/lib/share';
import { track } from '@/lib/analytics-client';
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  SlidersHorizontal,
  MapPin,
  BriefcaseBusiness,
  Bookmark,
  Check,
  X,
  Share2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Laptop,
  ShieldCheck,
  Wallet,
  GraduationCap,
  Code2,
  Megaphone,
  Truck,
  Calculator,
  Headphones,
  Stethoscope,
  LocateFixed,
  EyeOff,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { CompanyLogo } from './company-logo';
import { useVacancyActivity } from './use-vacancy-activity';
import { PersonalSpace, usePersonalSpace } from './personal-space';
import type { SearchFilters } from '@/lib/personal-space';
import type { PublicJob as Job } from '@/lib/types';
import { categories, sourceNames } from '@/lib/types';
import { cityOptions } from '@/lib/cities';

export function Choice({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id?: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v || 'ყველა')}>
      <SelectTrigger id={id} aria-label={label} className="choice">
        <SelectValue>{value === 'ყველა' ? label : value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {['ყველა', ...options].map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
// Shared with the search plan, so "სხვა" means a city outside this very list.
const cities: string[] = [...cityOptions];
const dayMs = 86400000;
function daysUntil(date: string) {
  const at = Date.parse(date);
  return Number.isFinite(at) ? Math.ceil((at - Date.now()) / dayMs) : NaN;
}
function isNew(datePosted?: string) {
  if (!datePosted) return false;
  const at = Date.parse(datePosted);
  if (!Number.isFinite(at)) return false;
  const age = Date.now() - at;
  return age >= 0 && age <= 2 * dayMs;
}

/* One vacancy in the list. On a touch screen the card slides: right saves, left hides; the
   reveal layers behind it name the action before the finger lifts. */
function JobCard({
  job: j,
  demo,
  saved,
  seen,
  status,
  resultsPending,
  returnPath,
  onToggleSave,
  onOpen,
  onHide,
}: {
  job: Job;
  demo: boolean;
  saved: boolean;
  seen: boolean;
  status?: Application['status'];
  resultsPending: boolean;
  returnPath: string;
  onToggleSave: () => void;
  onOpen: () => void;
  onHide: () => void;
}) {
  const swipe = useSwipe({
    onRight: onToggleSave,
    onLeft: demo ? undefined : onHide,
  });
  const left = j.deadline ? daysUntil(j.deadline) : NaN;
  const urgent = left >= 0 && left <= 3;
  const when = j.deadline
    ? `${urgent ? 'იწურება' : 'ვადა:'} ${formatDate(j.deadline)}`
    : j.datePosted
      ? formatDate(j.datePosted)
      : '';
  const style: CSSProperties | undefined = swipe.dx
    ? { transform: `translateX(${swipe.dx}px)` }
    : undefined;
  return (
    <div
      className="swipe-shell"
      data-dir={swipe.dx > 0 ? 'right' : swipe.dx < 0 ? 'left' : undefined}
    >
      <div className="swipe-reveal swipe-reveal-right" aria-hidden="true">
        <Bookmark size={18} /> {saved ? 'მოხსნა' : 'შენახვა'}
      </div>
      {!demo && (
        <div className="swipe-reveal swipe-reveal-left" aria-hidden="true">
          <EyeOff size={18} /> დამალვა
        </div>
      )}
      <article
        className="job-card swipe-card"
        style={style}
        data-swiping={swipe.dragging || undefined}
        {...swipe.handlers}
      >
        <CompanyLogo company={j.company} url={j.logoUrl} />
        <div className="job-info">
          <div className="job-company">
            <span>{j.company || 'კომპანია'}</span>
            {!demo && <VacancyStatus seen={seen} status={status} />}
          </div>
          <Link
            className="job-title"
            data-vacancy-id={j.id}
            href={
              resultsPending
                ? '#'
                : vacancyPath(j.id, { preview: demo, from: returnPath })
            }
            prefetch={false}
            aria-disabled={resultsPending}
            tabIndex={resultsPending ? -1 : undefined}
            onClick={(event) => {
              if (resultsPending || swipe.dragging) event.preventDefault();
            }}
            onNavigate={(event) => {
              if (resultsPending || swipe.dragging) event.preventDefault();
              else onOpen();
            }}
          >
            {j.title}
          </Link>
          <div className="job-meta">
            {j.city && (
              <span>
                <MapPin size={13} />
                <span className="location-text" title={j.city}>
                  {j.city}
                </span>
              </span>
            )}
            {j.employmentType && (
              <span>
                <BriefcaseBusiness size={13} />
                {j.employmentType}
              </span>
            )}
            {j.mode && (
              <span>
                <Laptop size={13} />
                {j.mode}
              </span>
            )}
          </div>
          <div className="card-bottom">
            {j.salary && (
              <span className="salary">{compactSalary(j.salary)}</span>
            )}
            {j.category !== 'სხვა' && (
              <span className="category-tag">{j.category}</span>
            )}
            {isNew(j.datePosted) && <span className="job-new">ახალი</span>}
            {when && (
              <span className={`job-when${urgent ? ' is-urgent' : ''}`}>
                {when}
              </span>
            )}
          </div>
        </div>
        <div className="job-side">
          <button
            className={`save-button ${saved ? 'is-saved' : ''}`}
            aria-label={
              saved ? `${j.title} — შენახულიდან წაშლა` : `${j.title} — შენახვა`
            }
            aria-pressed={saved}
            onClick={onToggleSave}
          >
            <Bookmark size={19} />
          </button>
          <span className="job-date">
            {j.deadline
              ? `ვადა: ${formatDate(j.deadline)}`
              : j.datePosted
                ? `გამოქვეყნდა ${formatDate(j.datePosted)}`
                : ''}
          </span>
          <span className="card-open" aria-hidden="true">
            <span>ნახვა</span>
            <ArrowUpRight size={16} />
          </span>
        </div>
      </article>
    </div>
  );
}
export default function JobBoard() {
  const params = useSearchParams();
  const demo = params.get('preview') === '1';
  const activity = useVacancyActivity();
  const excluded = demo ? '' : activity.hidden.map((item) => item.id).join(',');
  const personal = usePersonalSpace();
  const applicationsById = new Map(
    personal.records
      .filter((r): r is Application => r.kind === 'application')
      .map((r) => [r.id, r.status]),
  );
  const [personalOpen, setPersonalOpen] = useState(false);
  const [loadedResult, setLoadedResult] = useState({ key: '', page: 0 });
  const [jobs, setJobs] = useState<Job[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [initialSearch] = useState(() =>
    readSearch(new URLSearchParams(params.toString())),
  );
  const lastRequestedQuery = useRef(initialSearch.query);
  const [query, setQuery] = useState(initialSearch.query),
    [city, setCity] = useState(initialSearch.city),
    [category, setCategory] = useState(initialSearch.category),
    [source, setSource] = useState(initialSearch.source),
    [paid, setPaid] = useState(initialSearch.paid),
    [remote, setRemote] = useState(initialSearch.remote),
    [sort, setSort] = useState(initialSearch.sort);
  const [advanced, setAdvanced] = useState<AdvancedFilters>(
    () =>
      Object.fromEntries(
        Object.keys(advancedDefaults).map((key) => [
          key,
          initialSearch[key as keyof AdvancedFilters],
        ]),
      ) as AdvancedFilters,
  );
  const currentSearch: SearchFilters = {
    query,
    city,
    category,
    source,
    paid,
    remote,
    sort,
    ...advanced,
  };
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [mobileMeta, setMobileMeta] = useState<{
    key: string;
    data: SearchMeta;
    total: number;
  } | null>(null);

  const [catalogue, setCatalogue] = useState<{
    total: number;
    categories: { name: string; count: number }[];
    sources: { name: string; count: number }[];
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/catalogue', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && data) setCatalogue(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [filtersOpen, setFiltersOpen] = useState(false),
    [savedOnly, setSavedOnly] = useState(params.get('saved') === '1'),
    [saved, setSaved] = useState<string[]>([]),
    [storageReady, setStorageReady] = useState(false),
    [feedback, setFeedback] = useState(''),
    [retry, setRetry] = useState(0);
  const [mobileDraft, setMobileDraft] = useState<SearchFilters | null>(null);
  const mobileKey = mobileDraft ? searchParams(mobileDraft).toString() : '';
  useEffect(() => {
    if (!filtersOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const p = new URLSearchParams(mobileKey);
      p.set('countsOnly', '1');
      if (demo) p.set('preview', '1');
      if (savedOnly) p.set('ids', saved.join(','));
      if (excluded) p.set('exclude', excluded);
      void fetch('/api/jobs?' + p, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && !controller.signal.aborted)
            setMobileMeta({ key: mobileKey, data: d.search, total: d.total });
        })
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filtersOpen, mobileKey, demo, savedOnly, saved, excluded]);
  const [pageState, setPageState] = useState(() => ({
      key: JSON.stringify([
        initialSearch.query,
        initialSearch.city,
        initialSearch.category,
        initialSearch.source,
        initialSearch.paid,
        initialSearch.remote,
        initialSearch.sort,
        advanced,
        false,
        [],
        '',
      ]),
      page: Math.max(
        1,
        Math.min(10000, Math.floor(Number(params.get('page'))) || 1),
      ),
    })),
    [total, setTotal] = useState(0),
    [pages, setPages] = useState(0);
  /* "მეტის ჩვენება" appends pages after the one in the URL; `through` is the last one shown. */
  const [loadedState, setLoadedState] = useState({ key: '', through: 0 });
  const [appendPage, setAppendPage] = useState<{
    key: string;
    page: number;
  } | null>(null);
  const [appendError, setAppendError] = useState('');
  const filterKey = JSON.stringify([
    query,
    city,
    category,
    source,
    paid,
    remote,
    sort,
    advanced,
    savedOnly,
    savedOnly ? saved : [],
    excluded,
  ]);
  const page = pageState.key === filterKey ? pageState.page : 1;
  const loadedThrough =
    loadedState.key === filterKey ? Math.max(page, loadedState.through) : page;
  const appending = appendPage?.key === filterKey;
  const resultsPending =
    !error &&
    (loading || loadedResult.key !== filterKey || loadedResult.page !== page);
  const savedFilter = savedOnly ? saved.join(',') : '';
  const activeCount = [
    query,
    city === 'ყველა' ? '' : city,
    category === 'ყველა' ? '' : category,
    source === 'ყველა' ? '' : source,
    paid,
    remote,
    advanced.salaryPeriod === 'day' ||
      advanced.salaryFrom !== null ||
      advanced.salaryTo !== null,
    advanced.employment !== 'all',
    advanced.entryLevel,
    advanced.postedWithin,
  ].filter(Boolean).length;
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const value = JSON.parse(localStorage.getItem('ertad-saved') || '[]');
        if (Array.isArray(value))
          setSaved(
            value
              .filter((v) => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v))
              .slice(0, 100),
          );
      } catch {}
      setStorageReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (filtersOpen || !activity.ready || (savedOnly && !storageReady)) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        lastRequestedQuery.current = query;
        setLoading(true);
        setError('');
        const p = searchParams({
          query,
          city,
          category,
          source,
          paid,
          remote,
          sort,
          ...advanced,
        });
        p.set('page', String(page));
        p.set('summary', '1');
        p.set('preview', demo ? '1' : '0');
        if (savedOnly) p.set('ids', savedFilter);
        if (excluded) p.set('exclude', excluded);
        const address = searchParams({
          query,
          city,
          category,
          source,
          paid,
          remote,
          sort,
          ...advanced,
        });
        if (demo) address.set('preview', '1');
        if (savedOnly) address.set('saved', '1');
        if (page > 1) address.set('page', String(page));
        window.history.replaceState(
          null,
          '',
          '/' + (address.size ? '?' + address.toString() : ''),
        );
        void fetch('/api/jobs?' + p, { signal: controller.signal })
          .then(async (r) => {
            const d = await r.json();
            if (!r.ok) throw Error(d.error || 'ვაკანსიები ვერ ჩაიტვირთა');
            return d;
          })
          .then((d) => {
            if (!controller.signal.aborted) {
              setJobs(d.jobs);
              setSearchMeta(d.search);
              setLoadedResult({ key: filterKey, page });
              setLoadedState({ key: filterKey, through: page });
              setAppendPage(null);
              setAppendError('');
              setTotal(d.total);
              setPages(d.pages);
            }
          })
          .catch((e) => {
            if (e.name !== 'AbortError') setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      lastRequestedQuery.current === query ? 0 : 400,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    query,
    city,
    category,
    source,
    paid,
    remote,
    sort,
    advanced,
    page,
    demo,
    savedOnly,
    savedFilter,
    storageReady,
    filtersOpen,
    filterKey,
    retry,
    excluded,
    activity.ready,
  ]);
  useEffect(() => {
    if (!appendPage || appendPage.key !== filterKey || resultsPending) return;
    const controller = new AbortController();
    const p = searchParams({
      query,
      city,
      category,
      source,
      paid,
      remote,
      sort,
      ...advanced,
    });
    p.set('page', String(appendPage.page));
    p.set('summary', '1');
    p.set('preview', demo ? '1' : '0');
    if (savedOnly) p.set('ids', savedFilter);
    if (excluded) p.set('exclude', excluded);
    void fetch('/api/jobs?' + p, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || 'ვაკანსიები ვერ ჩაიტვირთა');
        return d;
      })
      .then((d) => {
        if (controller.signal.aborted) return;
        setJobs((prev) => [
          ...prev,
          ...(d.jobs as Job[]).filter((j) => !prev.some((x) => x.id === j.id)),
        ]);
        setTotal(d.total);
        setPages(d.pages);
        setLoadedState({ key: filterKey, through: appendPage.page });
        setAppendPage(null);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setAppendError(e.message);
        setAppendPage(null);
      });
    return () => controller.abort();
  }, [
    appendPage,
    filterKey,
    resultsPending,
    query,
    city,
    category,
    source,
    paid,
    remote,
    sort,
    advanced,
    demo,
    savedOnly,
    savedFilter,
    excluded,
  ]);
  const loadMore = () => {
    if (appending || resultsPending || loadedThrough >= pages) return;
    setAppendError('');
    setAppendPage({ key: filterKey, page: loadedThrough + 1 });
  };
  const applySearch = (filters: SearchFilters) => {
    setPageState({ key: '', page: 1 });
    setQuery(filters.query);
    setCity(filters.city);
    setCategory(filters.category);
    setSource(filters.source);
    setPaid(filters.paid);
    setRemote(filters.remote);
    setSort(filters.sort);
    setAdvanced({
      salaryPeriod: filters.salaryPeriod,
      salaryFrom: filters.salaryFrom,
      salaryTo: filters.salaryTo,
      employment: filters.employment,
      entryLevel: filters.entryLevel,
      postedWithin: filters.postedWithin,
    });
    setSavedOnly(false);
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
  };
  const reset = () => {
    setQuery('');
    setCity('ყველა');
    setCategory('ყველა');
    setSource('ყველა');
    setPaid(false);
    setRemote(false);
    setAdvanced(advancedDefaults);
  };
  const relaxFilter = (key: FilterKey) => {
    if (key === 'query') setQuery('');
    if (key === 'city') setCity('ყველა');
    if (key === 'category') setCategory('ყველა');
    if (key === 'source') setSource('ყველა');
    if (key === 'paid') setPaid(false);
    if (key === 'remote') setRemote(false);
    if (key === 'salary')
      setAdvanced({
        ...advanced,
        salaryPeriod: 'month',
        salaryFrom: null,
        salaryTo: null,
      });
    if (key === 'employment') setAdvanced({ ...advanced, employment: 'all' });
    if (key === 'entryLevel') setAdvanced({ ...advanced, entryLevel: false });
    if (key === 'postedWithin') setAdvanced({ ...advanced, postedWithin: 0 });
  };
  function toggleSave(id: string) {
    const next = saved.includes(id)
      ? saved.filter((v) => v !== id)
      : [...saved, id].slice(-100);
    try {
      localStorage.setItem('ertad-saved', JSON.stringify(next));
      setSaved(next);
    } catch {
      setFeedback('ბრაუზერმა შენახვა ვერ შეძლო.');
    }
  }
  function paginate(next: number) {
    setPageState({ key: filterKey, page: next });
    document
      .getElementById('results')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  /* A search counts once the reader has stopped typing it and its results are on screen, so
     "გა", "გაყ" and "გაყი" on the way to a word are not three searches. Each distinct query is
     counted once per page load, and a search that found nothing is also counted as such. */
  const trackedSearches = useRef(new Set<string>());
  useEffect(() => {
    const settled = query.trim();
    if (demo || resultsPending || settled.length < 2) return;
    const timer = setTimeout(() => {
      const key = settled.toLowerCase();
      if (trackedSearches.current.has(key)) return;
      trackedSearches.current.add(key);
      track('search', settled);
      if (total === 0) track('search_empty', settled);
    }, 1500);
    return () => clearTimeout(timer);
  }, [query, total, resultsPending, demo]);
  const initialPageRestored = useRef(false);
  useEffect(() => {
    if (!storageReady || !activity.ready || initialPageRestored.current) return;
    const timer = setTimeout(() => {
      initialPageRestored.current = true;
      const initialPage = Math.max(
        1,
        Math.min(10000, Math.floor(Number(params.get('page'))) || 1),
      );
      if (initialPage > 1) setPageState({ key: filterKey, page: initialPage });
    }, 0);
    return () => clearTimeout(timer);
  }, [storageReady, activity.ready, filterKey, params]);
  const returnPath = searchReturnPath(currentSearch, page, savedOnly, demo);
  const searchRestored = useRef(false);
  useEffect(() => {
    if (resultsPending || !storageReady || searchRestored.current) return;
    const position = restoreSearch(returnPath);
    if (!position) return;
    if (position.page !== page) return;
    // Pages appended with "load more" before leaving are fetched again, one at a time, first.
    if (position.loadedThrough > loadedThrough && !appendError) {
      if (appending) return;
      const next = loadedThrough + 1;
      const timer = setTimeout(
        () => setAppendPage({ key: filterKey, page: next }),
        0,
      );
      return () => clearTimeout(timer);
    }
    if (appending) return;
    searchRestored.current = true;
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, position.top);
      document
        .querySelector<HTMLAnchorElement>(`[data-vacancy-id="${position.id}"]`)
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    resultsPending,
    storageReady,
    returnPath,
    page,
    filterKey,
    loadedThrough,
    appending,
    appendError,
  ]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [canLocate, setCanLocate] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setCanLocate('geolocation' in navigator), 0);
    return () => clearTimeout(timer);
  }, []);
  /* Only ever runs from a tap on the button; the permission prompt is never shown on load. */
  const locate = () => {
    if (locating || !('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = nearestCity(
          position.coords.latitude,
          position.coords.longitude,
        );
        const km = Math.round(nearest.km);
        setCity(nearest.city);
        setFeedback(
          km > 80
            ? `უახლოესი ქალაქი სიაში: ${nearest.city} (${km} კმ)`
            : `ქალაქი: ${nearest.city} · ${km} კმ`,
        );
        setLocating(false);
      },
      () => {
        setFeedback('მდებარეობა მიუწვდომელია. აირჩიე ქალაქი ხელით.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  const renderFilters = (prefix: string) => {
    const draft =
      prefix === 'mobile' && mobileDraft ? mobileDraft : currentSearch;
    const facets =
      prefix === 'mobile'
        ? mobileMeta?.key === mobileKey
          ? mobileMeta.data
          : null
        : !resultsPending
          ? searchMeta
          : null;
    const changeCategory = (value: string) =>
      prefix === 'mobile'
        ? setMobileDraft({ ...draft, category: value })
        : setCategory(value);
    const changeCity = (value: string) =>
      prefix === 'mobile'
        ? setMobileDraft({ ...draft, city: value })
        : setCity(value);
    const changeSource = (value: string) =>
      prefix === 'mobile'
        ? setMobileDraft({ ...draft, source: value })
        : setSource(value);
    const changePaid = (value: boolean) =>
      prefix === 'mobile'
        ? setMobileDraft({ ...draft, paid: value })
        : setPaid(value);
    const changeRemote = (value: boolean) =>
      prefix === 'mobile'
        ? setMobileDraft({ ...draft, remote: value })
        : setRemote(value);
    return (
      <>
        <div className="filter-head">
          <h2>
            <SlidersHorizontal size={17} /> ფილტრები
          </h2>
          <button
            onClick={() =>
              prefix === 'mobile'
                ? setMobileDraft(readSearch(new URLSearchParams()))
                : reset()
            }
            disabled={prefix === 'mobile' ? !mobileKey : !activeCount}
          >
            გასუფთავება
          </button>
        </div>
        <h3>
          მიმართულება <small>· არჩეული პირობებით</small>
        </h3>
        <div className="category-options">
          {['ყველა', ...categories].map((c) => (
            <label className="check-row" key={c} htmlFor={`${prefix}-${c}`}>
              <input
                type="radio"
                name={`${prefix}-category`}
                id={`${prefix}-${c}`}
                checked={draft.category === c}
                onChange={() => changeCategory(c)}
              />
              <span>{c === 'ყველა' ? 'ყველა მიმართულება' : c}</span>
              {facets && (
                <small className="facet-count">
                  {c === 'ყველა'
                    ? facets.categoryTotal
                    : facets.categories.find((item) => item.name === c)
                        ?.count || 0}
                </small>
              )}
            </label>
          ))}
        </div>
        <div className="filter-divider" />
        <h3>სამუშაო პირობები</h3>
        <label className="check-row" htmlFor={`${prefix}-remote`}>
          <Checkbox
            id={`${prefix}-remote`}
            checked={draft.remote}
            onCheckedChange={changeRemote}
          />
          დისტანციური
        </label>
        <label className="check-row" htmlFor={`${prefix}-paid`}>
          <Checkbox
            id={`${prefix}-paid`}
            checked={draft.paid}
            onCheckedChange={changePaid}
          />
          ხელფასი მითითებულია
        </label>
        <AdvancedFilterControls
          prefix={prefix}
          value={draft}
          onChange={(next) =>
            prefix === 'mobile'
              ? setMobileDraft({ ...draft, ...next })
              : setAdvanced(next)
          }
        />
        <div className="filter-divider" />
        <h3>ქალაქი</h3>
        <Choice
          label="ყველა ქალაქი"
          value={draft.city}
          onChange={changeCity}
          options={cities}
        />
        <div className="filter-divider" />
        <h3>პირველწყარო</h3>
        <Choice
          label="ყველა წყარო"
          value={draft.source}
          onChange={changeSource}
          options={Object.values(sourceNames)}
        />
        <div className="source-note">
          <ShieldCheck size={21} />
          <p>იპოვე აქ. დეტალები გადაამოწმე პირველწყაროზე.</p>
        </div>
      </>
    );
  };
  return (
    <div className="board-shell">
      <a className="skip-link" href="#results">
        ვაკანსიებზე გადასვლა
      </a>
      <header className="topbar">
        <div className="header-inner">
          <Brand />
          <nav aria-label="მთავარი ნავიგაცია">
            <button
              className={!savedOnly ? 'nav-active' : ''}
              onClick={() => setSavedOnly(false)}
            >
              ვაკანსიები
            </button>
            <button onClick={() => setPersonalOpen(true)}>ჩემი სივრცე</button>
            <a href="#how-it-works">როგორ მუშაობს</a>
          </nav>
          <ThemeToggle />
          <button
            className={`saved-nav ${savedOnly ? 'is-active' : ''}`}
            aria-label="შენახული ვაკანსიები"
            onClick={() => {
              setSavedOnly(!savedOnly);
              document
                .getElementById('results')
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Bookmark size={17} />
            <span>შენახული</span>
            <b>{saved.length}</b>
          </button>
        </div>
      </header>
      {demo && (
        <div className="preview-banner">
          <ShieldCheck size={16} />
          <span>
            ადმინის წინასწარი ნახვა — გამოუქვეყნებელი ვაკანსიებიც ჩანს
          </span>
          <Link href="/admin">
            ადმინში დაბრუნება <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <main>
        <section
          className="hero discovery-hero"
          aria-labelledby="search-heading"
        >
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> სხვადასხვა წყარო · ერთი სივრცე
              </div>
              <h1 id="search-heading">
                იპოვე შენი შემდეგი <em>სამსახური.</em>
              </h1>
              <p>
                შენთვის მნიშვნელოვანი პირობები. მეტი შესაძლებლობა ერთ ძებნაში.
              </p>
            </div>
          </div>
          <div className="hero-search-wrap">
            <div className="search-panel">
              <div className="search-modes" aria-label="სამუშაოს ტიპი">
                {[
                  ['all', 'ყველა განაკვეთი'],
                  ['daily', 'ერთდღიანი / ერთჯერადი'],
                  ['part-time', 'ნახევარი განაკვეთი'],
                  ['internship', 'სტაჟირება'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={label}
                    aria-pressed={advanced.employment === value}
                    onClick={() => {
                      if (advanced.employment !== value)
                        setAdvanced({
                          ...advanced,
                          employment: value as AdvancedFilters['employment'],
                        });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <search aria-label="ვაკანსიის ძებნა">
                <form
                  className="searchbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    (document.activeElement as HTMLElement | null)?.blur();
                    document.getElementById('results')?.scrollIntoView({
                      behavior: window.matchMedia(
                        '(prefers-reduced-motion: reduce)',
                      ).matches
                        ? 'auto'
                        : 'smooth',
                    });
                  }}
                >
                  <Search size={22} />
                  <input
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="მოძებნე ვაკანსია ან კომპანია"
                    maxLength={200}
                    placeholder="პოზიცია, კომპანია ან საკვანძო სიტყვა"
                    value={query}
                    ref={searchInputRef}
                    aria-autocomplete="list"
                    aria-controls="search-suggest"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <SearchSuggest
                    query={query}
                    inputRef={searchInputRef}
                    listId="search-suggest"
                    onPick={(value) => {
                      setQuery(value);
                      searchInputRef.current?.blur();
                      document.getElementById('results')?.scrollIntoView({
                        behavior: window.matchMedia(
                          '(prefers-reduced-motion: reduce)',
                        ).matches
                          ? 'auto'
                          : 'smooth',
                      });
                    }}
                  />
                  <div className="search-city">
                    <MapPin size={18} />
                    <Choice
                      label="ყველა ქალაქი"
                      value={city}
                      onChange={setCity}
                      options={cities}
                    />
                    {canLocate && (
                      <button
                        type="button"
                        className="near-me"
                        aria-label="ჩემთან ახლოს მდებარე ქალაქის არჩევა"
                        title="ჩემთან ახლოს"
                        aria-busy={locating}
                        disabled={locating}
                        onClick={locate}
                      >
                        <LocateFixed size={16} />
                      </button>
                    )}
                  </div>
                  <button
                    className="primary"
                    type="submit"
                    aria-label="მოძებნე ვაკანსია"
                  >
                    <span className="search-label-full">მოძებნე ვაკანსია</span>
                    <span className="search-label-short" aria-hidden="true">
                      ძებნა
                    </span>
                    <ArrowRight size={18} />
                  </button>
                </form>
              </search>
            </div>
            <div className="hero-assurance">
              <span>
                <Check size={14} /> რეგისტრაციის გარეშე
              </span>
              <span>
                <Check size={14} /> პირდაპირ დამსაქმებელთან
              </span>
              <span>
                <Globe2 size={14} />
                {catalogue
                  ? `${catalogue.sources.length} წყარო ერთ სივრცეში`
                  : 'სხვადასხვა წყაროდან'}
              </span>
            </div>
          </div>
        </section>
        <section className="discovery-shortcuts" aria-label="სწრაფი არჩევანი">
          <button
            className="discovery-shortcut"
            aria-pressed={advanced.salaryPeriod === 'day'}
            onClick={() =>
              setAdvanced({
                ...advanced,
                salaryPeriod: advanced.salaryPeriod === 'day' ? 'month' : 'day',
                salaryFrom: null,
                salaryTo: null,
              })
            }
          >
            <span className="shortcut-icon">
              <Wallet size={24} />
            </span>
            <span>
              <strong>ანაზღაურება დღეში</strong>
              <small>იპოვე დღიური ანაზღაურებით</small>
            </span>
            <ArrowUpRight className="shortcut-arrow" size={16} />
          </button>
          <button
            className="discovery-shortcut"
            aria-pressed={remote}
            onClick={() => setRemote(!remote)}
          >
            <span className="shortcut-icon">
              <Laptop size={24} />
            </span>
            <span>
              <strong>დისტანციური</strong>
              <small>იმუშავე შენთვის კომფორტულად</small>
            </span>
            <ArrowUpRight className="shortcut-arrow" size={16} />
          </button>
          <button
            className="discovery-shortcut"
            aria-pressed={advanced.entryLevel}
            onClick={() =>
              setAdvanced({ ...advanced, entryLevel: !advanced.entryLevel })
            }
          >
            <span className="shortcut-icon">
              <GraduationCap size={24} />
            </span>
            <span>
              <strong>გამოცდილების გარეშე</strong>
              <small>გადადგი პირველი ნაბიჯი</small>
            </span>
            <ArrowUpRight className="shortcut-arrow" size={16} />
          </button>
          <button
            className="discovery-shortcut"
            aria-pressed={paid}
            onClick={() => setPaid(!paid)}
          >
            <span className="shortcut-icon">
              <BriefcaseBusiness size={24} />
            </span>
            <span>
              <strong>ხელფასი მითითებულია</strong>
              <small>გაიგე პირობები წინასწარ</small>
            </span>
            <ArrowUpRight className="shortcut-arrow" size={16} />
          </button>
        </section>
        <section
          className="discovery-categories"
          aria-labelledby="category-heading"
        >
          <div className="discovery-section-heading">
            <h2 id="category-heading">რომელი მიმართულება გაინტერესებს?</h2>
            <button
              onClick={() => {
                if (window.innerWidth > 760)
                  document
                    .querySelector('.desktop-filters')
                    ?.scrollIntoView({ block: 'start' });
                if (window.innerWidth <= 760) {
                  setMobileDraft(currentSearch);
                  setFiltersOpen(true);
                }
              }}
            >
              ყველა მიმართულება <ArrowRight size={16} />
            </button>
          </div>
          <div className="category-gallery">
            {[
              { name: 'ტექნოლოგიები', Icon: Code2 },
              { name: 'გაყიდვები', Icon: BriefcaseBusiness },
              { name: 'მარკეტინგი', Icon: Megaphone },
              { name: 'ლოჯისტიკა', Icon: Truck },
              { name: 'ფინანსები', Icon: Calculator },
              { name: 'მომსახურება', Icon: Headphones },
              { name: 'განათლება', Icon: GraduationCap },
              { name: 'სამედიცინო', Icon: Stethoscope },
            ].map(({ name, Icon }) => (
              <button
                key={name}
                aria-pressed={category === name}
                onClick={() => setCategory(category === name ? 'ყველა' : name)}
              >
                <Icon size={23} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </section>
        <div className="page board-page">
          <div className="workspace">
            <aside className="filters desktop-filters">
              {renderFilters('desktop')}
            </aside>
            <section
              id="results"
              className="results"
              aria-busy={resultsPending}
            >
              {!demo &&
                !savedOnly &&
                !activeCount &&
                activity.recent.length > 0 && (
                  <RecentVacancies
                    items={activity.recent}
                    returnPath={returnPath}
                    onClear={() => {
                      if (!activity.clearRecent())
                        setFeedback('ბრაუზერმა გასუფთავება ვერ შეძლო.');
                    }}
                  />
                )}
              <div className="results-head">
                <div>
                  <h2>
                    {savedOnly ? 'შენახული ვაკანსიები' : 'ვაკანსიები'}
                    <span className="result-count">
                      {resultsPending ? '…' : total}
                    </span>
                  </h2>
                  <p aria-live="polite">
                    {resultsPending
                      ? 'ვაკანსიებს ვეძებთ…'
                      : savedOnly
                        ? 'შენახულია ამ ბრაუზერში · აქტიური ვაკანსიები'
                        : activeCount
                          ? 'შედეგები შენ მიერ არჩეული პირობებით'
                          : 'იპოვე პოზიცია, რომელიც შენს გეგმებს ერგება'}
                  </p>
                </div>
                <Choice
                  label="დალაგება"
                  value={sort}
                  onChange={(v) => setSort(v === 'ყველა' ? 'უახლესი' : v)}
                  options={[
                    'შესაბამისობა',
                    'უახლესი',
                    'მაღალი ხელფასი',
                    'ვადა იწურება',
                  ]}
                />
              </div>
              <div className="results-tools">
                <PersonalSpace
                  space={personal}
                  filters={currentSearch}
                  active={activeCount > 0}
                  disabled={demo}
                  onApply={applySearch}
                  open={personalOpen}
                  setOpen={setPersonalOpen}
                />
                <button
                  className="mobile-filter-toggle secondary-button"
                  onClick={() => {
                    setMobileDraft(currentSearch);
                    setFiltersOpen(true);
                  }}
                >
                  <SlidersHorizontal size={16} />
                  ფილტრები {activeCount > 0 && <b>{activeCount}</b>}
                </button>
                {activeCount > 0 && (
                  <button
                    className="share-search"
                    aria-label="ძიების გაზიარება"
                    onClick={async () => {
                      const outcome = await shareLink(
                        window.location.origin +
                          '/?' +
                          searchParams(currentSearch),
                        'ერთად — ვაკანსიების ძებნა',
                      );
                      setFeedback(
                        outcome === 'shared'
                          ? 'ძიება გაზიარებულია'
                          : outcome === 'copied'
                            ? 'ძიების ბმული დაკოპირებულია'
                            : 'ბმულის კოპირება ვერ მოხერხდა',
                      );
                    }}
                  >
                    <Share2 size={14} />{' '}
                    <span className="share-label">ძიების გაზიარება</span>
                  </button>
                )}
              </div>
              {!!activeCount && (
                <div className="active-filters">
                  {query && (
                    <button onClick={() => setQuery('')}>
                      {query}
                      <X size={12} />
                    </button>
                  )}
                  {city !== 'ყველა' && (
                    <button onClick={() => setCity('ყველა')}>
                      {city}
                      <X size={12} />
                    </button>
                  )}
                  {category !== 'ყველა' && (
                    <button onClick={() => setCategory('ყველა')}>
                      {category}
                      <X size={12} />
                    </button>
                  )}
                  {source !== 'ყველა' && (
                    <button onClick={() => setSource('ყველა')}>
                      {source}
                      <X size={12} />
                    </button>
                  )}
                  {paid && (
                    <button onClick={() => setPaid(false)}>
                      ხელფასით
                      <X size={12} />
                    </button>
                  )}
                  {remote && (
                    <button onClick={() => setRemote(false)}>
                      დისტანციური
                      <X size={12} />
                    </button>
                  )}
                  {(advanced.salaryPeriod === 'day' ||
                    advanced.salaryFrom !== null ||
                    advanced.salaryTo !== null) && (
                    <button onClick={() => relaxFilter('salary')}>
                      {advanced.salaryFrom ?? 0}–{advanced.salaryTo ?? '∞'} ₾ /{' '}
                      {advanced.salaryPeriod === 'day' ? 'დღე' : 'თვე'}
                      <X size={12} />
                    </button>
                  )}
                  {advanced.employment !== 'all' && (
                    <button onClick={() => relaxFilter('employment')}>
                      {employmentLabels[advanced.employment]}
                      <X size={12} />
                    </button>
                  )}
                  {advanced.entryLevel && (
                    <button onClick={() => relaxFilter('entryLevel')}>
                      გამოცდილების გარეშე
                      <X size={12} />
                    </button>
                  )}
                  {!!advanced.postedWithin && (
                    <button onClick={() => relaxFilter('postedWithin')}>
                      {advanced.postedWithin === 1
                        ? 'დღეს'
                        : `ბოლო ${advanced.postedWithin} დღეში`}
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
              {!demo && activity.hidden.length > 0 && (
                <details className="hidden-vacancies">
                  <summary>
                    დამალული ვაკანსიები ({activity.hidden.length})
                  </summary>
                  <p>
                    შენახულია ამ ბრაუზერში. სურვილისამებრ დააბრუნე ძებნის
                    შედეგებში.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (!activity.restore())
                        setFeedback('ბრაუზერმა აღდგენა ვერ შეძლო.');
                    }}
                  >
                    ყველას აღდგენა
                  </button>
                  <ul>
                    {activity.hidden.map((item) => (
                      <li key={item.id}>
                        <span>{item.title}</span>
                        <button
                          className="secondary-button"
                          aria-label={`${item.title} — აღდგენა`}
                          onClick={() => {
                            if (!activity.restore(item.id))
                              setFeedback('ბრაუზერმა აღდგენა ვერ შეძლო.');
                          }}
                        >
                          აღდგენა
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {error ? (
                <div className="empty" role="alert">
                  <Globe2 size={30} />
                  <h3>ვაკანსიები ვერ ჩაიტვირთა</h3>
                  <p>{error}</p>
                  <button
                    className="secondary-button"
                    onClick={() => setRetry((v) => v + 1)}
                  >
                    ხელახლა ცდა
                  </button>
                </div>
              ) : (
                <div className="job-list">
                  {resultsPending && jobs.length === 0
                    ? Array.from({ length: 4 }, (_, i) => (
                        <div
                          className="job-skeleton"
                          key={i}
                          aria-hidden="true"
                        >
                          <span />
                          <div>
                            <i />
                            <i />
                            <i />
                          </div>
                        </div>
                      ))
                    : jobs.map((j) => (
                        <JobCard
                          key={j.id}
                          job={j}
                          demo={demo}
                          saved={saved.includes(j.id)}
                          seen={activity.seen.includes(j.id)}
                          status={applicationsById.get(j.id)}
                          resultsPending={resultsPending}
                          returnPath={returnPath}
                          onToggleSave={() => toggleSave(j.id)}
                          onOpen={() => {
                            rememberSearch(
                              returnPath,
                              j.id,
                              page,
                              loadedThrough,
                            );
                            activity.markSeen(j.id, {
                              title: j.title,
                              company: j.company,
                            });
                          }}
                          onHide={() => {
                            setFeedback(
                              activity.hide(j.id, j.title)
                                ? 'ვაკანსია დამალულია · აღდგენა სიის თავში'
                                : 'ბრაუზერმა დამალვა ვერ შეძლო.',
                            );
                          }}
                        />
                      ))}
                </div>
              )}
              {!resultsPending && !error && !jobs.length && (
                <div className="empty">
                  <div className="empty-icon">
                    {savedOnly ? <Bookmark size={28} /> : <Search size={28} />}
                  </div>
                  <h3>
                    {savedOnly && !saved.length
                      ? 'საინტერესო ვაკანსია შეინახე'
                      : 'ამ პირობებით ვაკანსია ვერ მოიძებნა'}
                  </h3>
                  <p>
                    {savedOnly && !saved.length
                      ? 'დააჭირე ბარათზე შენახვის ნიშანს და მოგვიანებით აქ დაბრუნდი.'
                      : 'შეცვალე საძიებო სიტყვა ან შეამცირე ფილტრების რაოდენობა.'}
                  </p>
                  {searchMeta?.suggestion && (
                    <button
                      className="secondary-button"
                      onClick={() => setQuery(searchMeta.suggestion!.query)}
                    >
                      ხომ არ გულისხმობდი „{searchMeta.suggestion.query}“? (
                      {searchMeta.suggestion.count})
                    </button>
                  )}
                  {!!searchMeta?.relaxations.length && (
                    <div className="search-recovery">
                      <p>სხვა პირობების შენარჩუნებით:</p>
                      {searchMeta.relaxations.map((item) => (
                        <button
                          className="secondary-button"
                          key={item.key}
                          onClick={() => relaxFilter(item.key)}
                        >
                          მოხსენი „{item.label}“ — {item.count} შედეგი
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    className="primary"
                    onClick={() => {
                      reset();
                      if (savedOnly) setSavedOnly(false);
                    }}
                  >
                    ყველა ვაკანსია <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {!error && !resultsPending && loadedThrough < pages && (
                <div className="load-more-row">
                  <button
                    type="button"
                    className="load-more secondary-button"
                    disabled={appending}
                    onClick={loadMore}
                  >
                    {appending
                      ? 'იტვირთება…'
                      : `მეტის ჩვენება · კიდევ ${Math.min(20, Math.max(0, total - jobs.length))}`}
                  </button>
                  {appendError && (
                    <p className="load-more-error" role="alert">
                      {appendError}
                    </p>
                  )}
                </div>
              )}
              {pages > 1 && (
                <div className="board-pagination">
                  <span>
                    {loadedThrough > page ? `${page}–${loadedThrough}` : page} /{' '}
                    {pages} გვერდი
                  </span>
                  <button
                    aria-label="წინა გვერდი"
                    disabled={page === 1 || resultsPending}
                    onClick={() => paginate(page - 1)}
                  >
                    <ChevronLeft size={18} />
                    <span className="page-prev-label">წინა</span>
                  </button>
                  <button
                    aria-label="შემდეგი გვერდი"
                    disabled={loadedThrough >= pages || resultsPending}
                    onClick={() => paginate(loadedThrough + 1)}
                  >
                    <span className="page-next-label">შემდეგი</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
              <div className="results-foot">
                <ShieldCheck size={16} />
                <span>ყოველ ვაკანსიას ახლავს პირველწყაროს ბმული</span>
              </div>
            </section>
          </div>
          <section id="how-it-works" className="how-section">
            <div>
              <span className="section-kicker">
                ნაკლები ძებნა. მეტი არჩევანი.
              </span>
              <h2>შემდეგი ნაბიჯი — მარტივად.</h2>
            </div>
            <div className="how-grid">
              {[
                [
                  '01',
                  'იპოვე შენი პოზიცია',
                  'მოძებნე სხვადასხვა წყაროს ვაკანსიები შენთვის სასურველი პირობებით.',
                ],
                [
                  '02',
                  'შეადარე დეტალები',
                  'ნახე ანაზღაურება, სამუშაო რეჟიმი და დამსაქმებლის მოთხოვნები.',
                ],
                [
                  '03',
                  'გადადი პირველწყაროზე',
                  'გადაამოწმე აქტუალურობა და მიჰყევი დამსაქმებლის განაცხადის ინსტრუქციას.',
                ],
              ].map(([n, title, text]) => (
                <div key={n}>
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <footer className="site-footer">
        <Brand />
        <span>შესაძლებლობები, რომლებიც გაერთიანებს.</span>
        <div>
          <Link href="/admin">
            ადმინის სივრცე <ArrowUpRight size={13} />
          </Link>
          <span>© {new Date().getFullYear()} ერთად</span>
        </div>
      </footer>
      {feedback && (
        <output className="feedback-toast">
          <Check size={17} />
          {feedback}
          <button
            aria-label="შეტყობინების დახურვა"
            onClick={() => setFeedback('')}
          >
            <X size={16} />
          </button>
        </output>
      )}
      <Sheet
        open={filtersOpen}
        onOpenChange={(open) => {
          setFiltersOpen(open);
          if (!open) setMobileDraft(null);
        }}
      >
        <SheetContent side="bottom" className="mobile-filters-sheet">
          <SheetHeader>
            <SheetTitle>ფილტრები</SheetTitle>
            <SheetDescription>
              აირჩიე მიმართულება და სამუშაო პირობები.
            </SheetDescription>
          </SheetHeader>
          <div className="filters">{renderFilters('mobile')}</div>
          <button
            className="primary filters-apply"
            onClick={() => {
              if (mobileDraft) applySearch(mobileDraft);
              setFiltersOpen(false);
              setMobileDraft(null);
            }}
          >
            {mobileMeta?.key === mobileKey ? (
              mobileMeta.total === 0 ? (
                'ვაკანსია ვერ მოიძებნა'
              ) : (
                `ნახე ${mobileMeta.total} ვაკანსია`
              )
            ) : (
              <>
                ფილტრების გამოყენება <ArrowRight size={16} />
              </>
            )}
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
