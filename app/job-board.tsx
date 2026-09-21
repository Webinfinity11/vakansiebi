'use client';
import './board-features.css';
import { VacancySections } from './vacancy-sections';
import { VacancyStatus } from './vacancy-status';
import { useSwipe } from './use-swipe';
import { useAutoLoad } from './use-auto-load';
import { RecentVacancies } from './recent-vacancies';
import { SearchSuggest } from './search-suggest';
import { rememberRecentSearch } from '@/lib/recent-searches';
import {
  landingCopy,
  landingHeading,
  landingOf,
  relatedLandings,
} from '@/lib/seo-landing';
import { nearestCity } from '@/lib/nearest-city';
import type { Application } from '@/lib/personal-space';
import {
  vacancyCardTitle,
  vacancyCardSalary,
  vacancyCardLocation,
} from '@/lib/vacancy-card-labels';
import Link from 'next/link';
import { SearchDirectoryGroups } from './search-directory-groups';
import {
  rememberBoard,
  takeBoard,
  type BoardInitial,
} from '@/lib/board-return-cache';
import { subcategories, subcategoryFor } from '@/lib/subcategories';
import { SalaryFilter } from './salary-filter';
import AdvancedFilterControls, {
  advancedDefaults,
  employmentLabels,
  type AdvancedFilters,
} from './advanced-filters';
import type { SearchMeta, FilterKey } from '@/lib/server/search-plan';
import { useSearchParams } from 'next/navigation';
import {
  memo,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Brand } from './brand';
import { PublicHeader } from './public-header';
export { Brand } from './brand';
import { formatDate } from './vacancy-text';
import {
  vacancyPath,
  searchReturnPath,
  rememberSearch,
  restoreSearch,
} from '@/lib/vacancy-navigation';
import {
  boardSearchKey,
  readSearch,
  readSearchPage,
  searchParams,
  listPageSize,
} from '@/lib/search-state';
import { track } from '@/lib/analytics-client';
import {
  ArrowUpRight,
  ArrowRight,
  Crown,
  Gem,
  Search,
  SlidersHorizontal,
  MapPin,
  BriefcaseBusiness,
  ClipboardList,
  Bookmark,
  Check,
  X,
  Globe2,
  Laptop,
  ShieldCheck,
  LocateFixed,
  Calculator,
  GraduationCap,
  CircleHelp,
  EyeOff,
  LayoutGrid,
  Handshake,
  Megaphone,
  Truck,
  HandPlatter,
  Stethoscope,
  HardHat,
  Factory,
  Scale,
  Scissors,
  Ellipsis,
  FileText,
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
import { CompanyIdentity } from './company-identity';
import { ShortcutMark } from './shortcut-mark';
import { useVacancyActivity } from './use-vacancy-activity';
import { PersonalSpace, usePersonalSpace } from './personal-space';
import type { SearchFilters } from '@/lib/personal-space';
import type { PublicJob as Job } from '@/lib/types';
import { categories, listingSourceNames } from '@/lib/types';
import { cityOptions } from '@/lib/cities';

const categoryIcons = {
  ყველა: LayoutGrid,
  ტექნოლოგიები: Laptop,
  გაყიდვები: Handshake,
  მარკეტინგი: Megaphone,
  ადმინისტრაცია: ClipboardList,
  ფინანსები: Calculator,
  ლოჯისტიკა: Truck,
  მომსახურება: HandPlatter,
  სამედიცინო: Stethoscope,
  განათლება: GraduationCap,
  მშენებლობა: HardHat,
  დაცვა: ShieldCheck,
  წარმოება: Factory,
  იურიდიული: Scale,
  სილამაზე: Scissors,
  სხვა: Ellipsis,
};

export function Choice({
  label,
  id,
  value,
  onChange,
  options,
  onLocate,
  locating = false,
  mobile = false,
}: {
  label: string;
  id?: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
  onLocate?: () => void;
  locating?: boolean;
  mobile?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === '__near_me__') onLocate?.();
        else onChange(v || 'ყველა');
      }}
    >
      <SelectTrigger id={id} aria-label={label} className="choice">
        <SelectValue>
          {locating ? 'ქალაქს ვადგენთ…' : value === 'ყველა' ? label : value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className={`job-choice-options${mobile ? ' mobile-filter-options' : ''}`}
        alignItemWithTrigger={false}
        align="start"
        sideOffset={8}
      >
        {onLocate && (
          <SelectItem value="__near_me__" disabled={locating}>
            <LocateFixed size={16} aria-hidden="true" /> ჩემთან ახლოს
          </SelectItem>
        )}
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
/* "ახალი" has to mean new to this board, not merely dated today. A classified
   site lets an advertiser lift an old posting back to the top, and its date
   moves with it; 82 vacancies we had been carrying for over three days wore the
   badge on that strength alone. A vacancy is new when the source dates it
   within two days AND it reached us within two days. */
function within(value: string | undefined, days: number) {
  if (!value) return false;
  const at = Date.parse(value);
  const age = Date.now() - at;
  return Number.isFinite(at) && age >= -dayMs && age <= days * dayMs;
}
function isNew(job: { datePosted?: string; createdAt?: string }) {
  return within(job.datePosted, 2) && within(job.createdAt, 2);
}

/* One vacancy in the list. On a touch screen the card slides: right saves, left hides; the
   reveal layers behind it name the action before the finger lifts. */
const JobCard = memo(function JobCard({
  job: j,
  index,
  demo,
  saved,
  seen,
  status,
  returnPath,
  onToggleSave,
  onOpen,
  onHide,
}: {
  job: Job;
  index: number;
  demo: boolean;
  saved: boolean;
  seen: boolean;
  status?: Application['status'];
  returnPath: string;
  onToggleSave: (id: string) => void;
  onOpen: (job: Job) => void;
  onHide: (job: Job) => void;
}) {
  const swipe = useSwipe({
    onRight: () => onToggleSave(j.id),
    onLeft: demo ? undefined : () => onHide(j),
  });
  const salary = vacancyCardSalary(j.salary, j.salaryPeriod, j.source);
  const cardTitle = vacancyCardTitle(j.title, j.source);
  const left = j.deadline ? daysUntil(j.deadline) : NaN;
  const urgent = left >= 0 && left <= 3;
  const style: CSSProperties | undefined = swipe.dx
    ? { transform: `translateX(${swipe.dx}px)` }
    : undefined;
  // A promoted card leading the list names its own placement; its section has no heading.
  const featured = j.placement?.priority ? j.placement.tier : undefined;
  const openHref = vacancyPath(j, { preview: demo, from: returnPath });
  return (
    <div
      className="swipe-shell"
      style={
        {
          '--vacancy-delay': `${index < 8 ? index * 40 : 0}ms`,
        } as CSSProperties
      }
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
        className={`job-card swipe-card${j.placement ? ` placement-${j.placement.tier}` : ''}`}
        data-featured={featured}
        data-long-pay={salary.length > 80 || undefined}
        data-has-pay={Boolean(salary) || undefined}
        style={style}
        data-swiping={swipe.dragging || undefined}
        {...swipe.handlers}
      >
        <div className="job-info">
          {featured === 'premium' && (
            <span className="featured-label">
              <Gem size={13} aria-hidden="true" />
              პრემიუმ ვაკანსია
            </span>
          )}
          <div className="job-title-row">
            <Link
              className="job-title"
              title={j.title}
              data-vacancy-id={j.id}
              href={openHref}
              prefetch={false}
              onClick={(event) => {
                if (swipe.suppressClick()) event.preventDefault();
              }}
              onNavigate={(event) => {
                if (swipe.suppressClick()) event.preventDefault();
                else onOpen(j);
              }}
            >
              {cardTitle}
            </Link>
            {j.placement && !j.placement.priority && (
              <span
                className={`placement-badge placement-badge-${j.placement.tier}`}
                title="გამორჩეული განთავსება"
              >
                {j.placement.tier === 'premium' ? 'პრემიუმი' : 'VIP'}
              </span>
            )}
            {featured === 'vip' && (
              <span className="featured-label featured-label-vip">
                <Crown size={12} aria-hidden="true" />
                VIP
              </span>
            )}
            {isNew(j) && <span className="job-new">ახალი</span>}
          </div>
          <div className="job-company">
            <CompanyIdentity
              company={j.company}
              logoUrl={j.logoUrl}
              category={j.category}
              href={j.companyPath}
              onOpen={() => onOpen(j)}
              disabled={swipe.dragging}
              fallback={j.placement?.priority ? 'initial' : 'illustration'}
            />
            {!demo && <VacancyStatus seen={seen} status={status} />}
          </div>
          {salary && (
            <span className="salary card-pay-inline" title={salary}>
              {salary}
            </span>
          )}
          <div className="job-meta">
            {j.category !== 'სხვა' && (
              <span className="category-tag">{j.category}</span>
            )}
            {j.city && (
              <span>
                <MapPin size={13} />
                <span className="location-text" title={j.city}>
                  {vacancyCardLocation(j.city)}
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
        </div>
        <div className="job-conditions">
          {salary && (
            <span className="salary card-pay-column" title={salary}>
              {salary}
            </span>
          )}
          {j.datePosted && (
            <time className="job-when" dateTime={j.datePosted}>
              გამოქვეყნდა: {formatDate(j.datePosted)}
            </time>
          )}
          {j.deadline && (
            <time
              className={`job-when${urgent ? ' is-urgent' : ''}`}
              dateTime={j.deadline}
            >
              ბოლო ვადა: {formatDate(j.deadline)}
            </time>
          )}
        </div>
        <div className="job-side">
          <div className="job-actions">
            {featured === 'premium' && (
              <Link
                className="featured-cta"
                href={openHref}
                prefetch={false}
                aria-label={`${j.title} — ვაკანსიის ნახვა`}
                onClick={(event) => {
                  if (swipe.suppressClick()) event.preventDefault();
                }}
                onNavigate={(event) => {
                  if (swipe.suppressClick()) event.preventDefault();
                  else onOpen(j);
                }}
              >
                ვაკანსიის ნახვა <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
            <button
              className={`save-button ${saved ? 'is-saved' : ''}`}
              aria-label={
                saved
                  ? `${j.title} — შენახულიდან წაშლა`
                  : `${j.title} — შენახვა`
              }
              aria-pressed={saved}
              onClick={() => onToggleSave(j.id)}
            >
              <Bookmark size={19} />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
});
function VacancySkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div className="job-skeleton" key={i} aria-hidden="true">
      <span />
      <div>
        <i />
        <i />
        <i />
      </div>
    </div>
  ));
}

export default function JobBoard({
  initial,
  pendingInitial = false,
}: {
  initial?: BoardInitial;
  pendingInitial?: boolean;
} = {}) {
  const [allCategoriesVisible, setAllCategoriesVisible] = useState(false);
  const params = useSearchParams();
  const demo = params.get('preview') === '1';
  const [initialSearch] = useState(() =>
    readSearch(new URLSearchParams(params.toString())),
  );
  const [seed] = useState(() =>
    initial?.key ===
      boardSearchKey(initialSearch, {
        preview: demo,
        savedOnly: params.get('saved') === '1',
      }) && initial.page === readSearchPage(params)
      ? initial
      : null,
  );
  const activity = useVacancyActivity();
  const excluded = demo ? '' : activity.hidden.map((item) => item.id).join(',');
  const personal = usePersonalSpace();
  const [personalOpen, setPersonalOpen] = useState(false);
  const searchBeforeSaved = useRef<SearchFilters | null>(null);
  const applicationsById = useMemo(
    () =>
      new Map(
        personal.records
          .filter((r): r is Application => r.kind === 'application')
          .map((r) => [r.id, r.status]),
      ),
    [personal.records],
  );
  const [loadedResult, setLoadedResult] = useState({
    key: seed?.key || '',
    page: seed?.page || 0,
    path: seed ? searchReturnPath(initialSearch, seed.page) : '',
  });
  const [jobs, setJobs] = useState<Job[]>(seed?.jobs || []),
    [loading, setLoading] = useState(!seed),
    [error, setError] = useState('');
  const settledRequest = useRef(
    seed ? JSON.stringify([seed.key, seed.page, 0]) : '',
  );
  const [restoreReady, setRestoreReady] = useState(false);
  const [restoredSnapshot, setRestoredSnapshot] = useState(false);
  const visibleJobs = useMemo(() => {
    const hidden = new Set(excluded.split(','));
    return excluded ? jobs.filter((job) => !hidden.has(job.id)) : jobs;
  }, [jobs, excluded]);
  const lastRequestedQuery = useRef(initialSearch.query);
  const [query, setQuery] = useState(initialSearch.query),
    [city, setCity] = useState(initialSearch.city),
    [category, setCategoryValue] = useState(initialSearch.category),
    [source, setSource] = useState(initialSearch.source),
    [paid, setPaid] = useState(initialSearch.paid),
    [remote, setRemote] = useState(initialSearch.remote),
    [sort, setSort] = useState(initialSearch.sort);
  const [subcategory, setSubcategory] = useState(
    initialSearch.subcategory || '',
  );
  const setCategory = (value: string) => {
    setCategoryValue(value);
    setSubcategory('');
  };
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
    subcategory,
    source,
    paid,
    remote,
    sort,
    ...advanced,
  };
  /* A list of one category, one city or remote work is a page in its own right —
     it is what a reader searched for on Google — so it says its own name where
     the site's tagline otherwise stands. */
  const landing = landingOf(currentSearch);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(
    seed?.search || null,
  );
  const [companyLinksPending, setCompanyLinksPending] = useState(
    seed?.companyLinksPending || false,
  );
  const [filtersOpen, setFiltersOpen] = useState(false),
    [savedOnly, setSavedOnly] = useState(params.get('saved') === '1'),
    [saved, setSaved] = useState<string[]>([]),
    [storageReady, setStorageReady] = useState(false),
    [feedback, setFeedback] = useState(''),
    [retry, setRetry] = useState(0);
  const [unavailable, setUnavailable] = useState<
    { id: string; title: string; company: string; expired: boolean }[]
  >([]);
  const [mobileDraft, setMobileDraft] = useState<SearchFilters | null>(null);
  const mobileKey = mobileDraft ? searchParams(mobileDraft).toString() : '';
  const [pageState, setPageState] = useState(() => ({
      key: boardSearchKey(initialSearch, { savedOnly, preview: demo }),
      page: readSearchPage(params),
    })),
    [total, setTotal] = useState(seed?.total || 0),
    [pages, setPages] = useState(seed?.pages || 0);
  /* "მეტის ჩვენება" appends pages after the one in the URL; `through` is the last one shown. */
  const [loadedState, setLoadedState] = useState({
    key: seed?.key || '',
    through: seed?.page || 0,
  });
  const [appendPage, setAppendPage] = useState<{
    key: string;
    page: number;
  } | null>(null);
  const [appendError, setAppendError] = useState('');
  const filterKey = `${boardSearchKey(currentSearch, {
    savedOnly,
    saved,
    excluded,
    preview: demo,
  })}`;
  const page = pageState.key === filterKey ? pageState.page : 1;
  const loadedThrough =
    loadedState.key === filterKey ? Math.max(page, loadedState.through) : page;
  const appending = appendPage?.key === filterKey;
  const resultsPending =
    !error &&
    (loading || loadedResult.key !== filterKey || loadedResult.page !== page);
  const savedSet = useMemo(() => new Set(saved), [saved]);
  const seenSet = useMemo(() => new Set(activity.seen), [activity.seen]);
  const savedFilter = savedOnly ? saved.join(',') : '';
  const activeCount = [
    query,
    city === 'ყველა' ? '' : city,
    category === 'ყველა' ? '' : category,
    subcategory,
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
    if (pendingInitial || !activity.ready || (savedOnly && !storageReady))
      return;
    const controller = new AbortController();
    const requestKey = JSON.stringify([filterKey, page, retry]);
    const timer = setTimeout(
      () => {
        setRestoreReady(true);
        lastRequestedQuery.current = query;
        setLoading(true);
        setError('');
        const p = searchParams({
          query,
          city,
          category,
          subcategory,
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
          subcategory,
          source,
          paid,
          remote,
          sort,
          ...advanced,
        });
        if (demo) address.set('preview', '1');
        if (savedOnly) address.set('saved', '1');
        if (page > 1) address.set('page', String(page));
        /* Keep the entry's state: it holds the router's own record of this
           history position. Replacing it with null left the entry looking like
           a foreign page, so returning to it by the phone's back gesture forced
           a full reload and cost the reader their place in the back stack —
           one more press and the site was gone. Only the address changes here. */
        window.history.replaceState(
          window.history.state,
          '',
          '/' + (address.size ? '?' + address.toString() : ''),
        );
        const cached =
          retry === 0 && !savedOnly && !demo
            ? takeBoard(filterKey, page)
            : null;
        if (cached) {
          setRestoredSnapshot(true);
          settledRequest.current = requestKey;
          setJobs(cached.jobs);
          setCompanyLinksPending(
            cached.companyLinksPending ??
              cached.jobs.some((job) => !job.companyPath),
          );
          setTotal(cached.total);
          setPages(cached.pages);
          setSearchMeta(cached.search);
          setLoadedResult({ key: filterKey, page, path: cached.path });
          setLoadedState({ key: filterKey, through: cached.through });
          setAppendPage(null);
          setAppendError('');
          setLoading(false);
          return;
        }
        // Storage readiness can rerun this effect. A matching SSR seed (or a
        // completed request) already supplies this page; hidden IDs change the key.
        if (settledRequest.current === requestKey) {
          setLoading(false);
          return;
        }
        void fetch('/api/jobs?' + p, { signal: controller.signal })
          .then(async (r) => {
            const d = await r.json();
            if (!r.ok) throw Error(d.error || 'ვაკანსიები ვერ ჩაიტვირთა');
            return d;
          })
          .then((d) => {
            if (!controller.signal.aborted) {
              setRestoredSnapshot(false);
              settledRequest.current = requestKey;
              setJobs(d.jobs);
              setCompanyLinksPending(d.companyLinksPending === true);
              setSearchMeta(d.search);
              setLoadedResult({
                key: filterKey,
                page,
                path: searchReturnPath(
                  {
                    query,
                    city,
                    category,
                    subcategory,
                    source,
                    paid,
                    remote,
                    sort,
                    ...advanced,
                  },
                  page,
                  savedOnly,
                  demo,
                ),
              });
              setLoadedState({ key: filterKey, through: page });
              setAppendPage(null);
              setAppendError('');
              setTotal(d.total);
              setPages(d.pages);
              setUnavailable(Array.isArray(d.unavailable) ? d.unavailable : []);
              /* A shared or remembered link can name a page the list no longer has, once vacancies
                 have expired. Asking for page 500 of 441 answered "no vacancies found" over 8,806
                 of them; the board moves to the last page that exists instead. */
              if (d.pages > 0 && page > d.pages)
                setPageState({ key: filterKey, page: d.pages });
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
    subcategory,
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
    filterKey,
    retry,
    excluded,
    activity.ready,
    pendingInitial,
  ]);
  useEffect(() => {
    if (!appendPage || appendPage.key !== filterKey || resultsPending) return;
    const controller = new AbortController();
    const p = searchParams({
      query,
      city,
      category,
      subcategory,
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
        setJobs((prev) => {
          const ids = new Set(prev.map((job) => job.id));
          return [
            ...prev,
            ...(d.jobs as Job[]).filter((job) => {
              if (ids.has(job.id)) return false;
              ids.add(job.id);
              return true;
            }),
          ];
        });
        setCompanyLinksPending(
          (previous) => previous || d.companyLinksPending === true,
        );
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
    subcategory,
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
  useEffect(() => {
    if (!companyLinksPending || resultsPending || demo || !jobs.length) return;
    const missing = jobs.filter((job) => !job.companyPath).map((job) => job.id);
    if (!missing.length) return;
    const controller = new AbortController();
    const batches: string[][] = [];
    for (let i = 0; i < missing.length; i += 100)
      batches.push(missing.slice(i, i + 100));
    void Promise.all(
      batches.map(async (ids) => {
        const response = await fetch(
          '/api/company-links?ids=' + ids.join(','),
          { signal: controller.signal },
        );
        if (!response.ok) throw Error('company-links');
        return (await response.json()).links as Record<string, string | null>;
      }),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        const links = Object.assign({}, ...results) as Record<
          string,
          string | null
        >;
        setJobs((current) =>
          current.map((job) =>
            links[job.id] ? { ...job, companyPath: links[job.id]! } : job,
          ),
        );
        setCompanyLinksPending(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCompanyLinksPending(false);
      });
    return () => controller.abort();
  }, [companyLinksPending, resultsPending, demo, jobs]);
  const loadMore = useCallback(() => {
    if (appending || resultsPending || loadedThrough >= pages) return;
    if (loadedThrough - page >= 49) {
      setPageState({ key: filterKey, page: loadedThrough + 1 });
      document
        .getElementById('results')
        ?.scrollIntoView({ behavior: 'instant' });
      return;
    }
    setAppendError('');
    setAppendPage({ key: filterKey, page: loadedThrough + 1 });
  }, [appending, resultsPending, loadedThrough, pages, filterKey, page]);
  const nextPageTarget = useRef<HTMLDivElement>(null);
  useAutoLoad(
    nextPageTarget,
    restoreReady &&
      !appending &&
      !resultsPending &&
      !error &&
      !appendError &&
      !filtersOpen &&
      loadedThrough - page < 49 &&
      loadedThrough < pages,
    loadMore,
  );
  const applySearch = (filters: SearchFilters) => {
    setPageState({ key: '', page: 1 });
    setQuery(filters.query);
    setCity(filters.city);
    setCategory(filters.category);
    setSubcategory(filters.subcategory || '');
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
      deep: filters.deep,
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
  const openSaved = () => {
    if (!savedOnly) {
      searchBeforeSaved.current = currentSearch;
      reset();
      setSort('უახლესი');
      setPageState({ key: '', page: 1 });
      setSavedOnly(true);
    }
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
  };
  const openVacancies = () => {
    if (savedOnly && searchBeforeSaved.current) {
      applySearch(searchBeforeSaved.current);
      searchBeforeSaved.current = null;
    } else {
      setSavedOnly(false);
      document
        .getElementById('results')
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  const relaxFilter = (key: FilterKey) => {
    if (key === 'query') setQuery('');
    if (key === 'city') setCity('ყველა');
    if (key === 'category') setCategory('ყველა');
    if (key === 'subcategory') setSubcategory('');
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
  const [saveNotice, setSaveNotice] = useState<{
    id: string;
    wasSaved: boolean;
    evicted?: string;
  } | null>(null);
  const toggleSave = useCallback(
    (id: string) => {
      const wasSaved = saved.includes(id);
      const next = wasSaved
        ? saved.filter((v) => v !== id)
        : [...saved, id].slice(-100);
      try {
        localStorage.setItem('ertad-saved', JSON.stringify(next));
        setSaved(next);
        if (!wasSaved) track('save', id);
        setFeedback('');
        setSaveNotice({
          id,
          wasSaved,
          evicted: !wasSaved && saved.length >= 100 ? saved[0] : undefined,
        });
      } catch {
        setSaveNotice(null);
        setFeedback('ბრაუზერმა შენახვა ვერ შეძლო.');
      }
    },
    [saved],
  );
  const undoSave = () => {
    if (!saveNotice) return;
    const { id, wasSaved, evicted } = saveNotice;
    const next = saved.filter((value) => value !== id);
    if (wasSaved) next.push(id);
    if (evicted && !next.includes(evicted) && next.length < 100)
      next.unshift(evicted);
    try {
      localStorage.setItem('ertad-saved', JSON.stringify(next.slice(-100)));
      setSaved(next.slice(-100));
      setSaveNotice(null);
      setFeedback('ცვლილება გაუქმებულია');
    } catch {
      setFeedback('ბრაუზერმა ცვლილება ვერ გააუქმა. სცადე ხელახლა.');
    }
  };
  function paginate(next: number) {
    setPageState({ key: filterKey, page: next });
    document
      .getElementById('results')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  /* A search counts once the reader has stopped typing it and its results are on screen, so
     "გა", "გაყ" and "გაყი" on the way to a word are not three searches. Each distinct query/filter combination is
     counted once per board visit, and a search that found nothing is also counted as such. */
  const trackedSearches = useRef(new Set<string>());
  useEffect(() => {
    const settled = query.trim();
    // A search inside the saved list is not a search of the catalogue, and finding nothing
    // there says nothing about what the site is missing.
    if (demo || savedOnly || resultsPending || error || settled.length < 2)
      return;
    const timer = setTimeout(() => {
      const key = filterKey;
      // Recent history must move a repeated successful query to the front even
      // when analytics already counted that query during this board visit.
      if (total > 0) rememberRecentSearch(settled);
      if (trackedSearches.current.has(key)) return;
      trackedSearches.current.add(key);
      track('search', settled);
      if (total === 0) track('search_empty', settled);
    }, 1500);
    return () => clearTimeout(timer);
  }, [query, total, resultsPending, error, filterKey, demo, savedOnly]);
  /* Counts which filter the reader changed — only its name, once it has settled — so the admin
     can see which filters are actually used. The values chosen are not sent. */
  const filterSnapshot = JSON.stringify({ ...currentSearch, query: '' });
  const trackedFilters = useRef(filterSnapshot);
  useEffect(() => {
    if (demo || trackedFilters.current === filterSnapshot) return;
    const timer = setTimeout(() => {
      const before = JSON.parse(trackedFilters.current) as Record<
        string,
        unknown
      >;
      const after = JSON.parse(filterSnapshot) as Record<string, unknown>;
      trackedFilters.current = filterSnapshot;
      for (const key of Object.keys(after))
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
          track('filter', key);
    }, 1500);
    return () => clearTimeout(timer);
  }, [filterSnapshot, demo]);
  const initialPageRestored = useRef(false);
  useEffect(() => {
    if (!storageReady || !activity.ready || initialPageRestored.current) return;
    const timer = setTimeout(() => {
      initialPageRestored.current = true;
      const requestedPage = readSearchPage(params);
      const initialPage =
        seed?.key === filterKey && seed.pages > 0
          ? Math.min(requestedPage, seed.pages)
          : requestedPage;
      if (initialPage > 1) setPageState({ key: filterKey, page: initialPage });
    }, 0);
    return () => clearTimeout(timer);
  }, [storageReady, activity.ready, filterKey, params, seed]);
  const returnPath = searchReturnPath(currentSearch, page, savedOnly, demo);
  const hideVacancy = activity.hide;
  const openContext = useRef({
    loadedResult,
    loadedState,
    jobs,
    total,
    pages,
    searchMeta,
    companyLinksPending,
  });
  useEffect(() => {
    openContext.current = {
      loadedResult,
      loadedState,
      jobs,
      total,
      pages,
      searchMeta,
      companyLinksPending,
    };
  }, [
    loadedResult,
    loadedState,
    jobs,
    total,
    pages,
    searchMeta,
    companyLinksPending,
  ]);
  const searchRestored = useRef(false);
  const openJob = useCallback((job: Job) => {
    searchRestored.current = false;
    const context = openContext.current;
    rememberBoard({
      key: context.loadedResult.key,
      page: context.loadedResult.page,
      through: context.loadedState.through,
      path: context.loadedResult.path,
      jobs: context.jobs,
      total: context.total,
      pages: context.pages,
      search: context.searchMeta,
      companyLinksPending: context.companyLinksPending,
    });
    rememberSearch(
      context.loadedResult.path,
      job.id,
      context.loadedResult.page,
      context.loadedState.through,
    );
    /* Opening a vacancy is not the same as having read it. Marking it here
         stamped "ნანახია" onto the card under the reader's own finger, before
         the vacancy had even appeared; the vacancy's own page marks it once the
         reader has stayed a moment, so the badge is waiting for them when they
         come back and never flickers on the way out. */
  }, []);
  const hideJob = useCallback(
    (job: Job) => {
      setFeedback(
        hideVacancy(job.id, job.title)
          ? 'ვაკანსია დამალულია · აღდგენა სიის თავში'
          : 'ბრაუზერმა დამალვა ვერ შეძლო.',
      );
    },
    [hideVacancy],
  );
  useEffect(() => {
    if (
      !restoreReady ||
      resultsPending ||
      error ||
      !storageReady ||
      searchRestored.current
    )
      return;
    const position = restoreSearch(returnPath);
    if (!position) return;
    if (position.page !== page) return;
    // Pages appended with "load more" before leaving are fetched again, one at a time, first.
    if (
      Math.min(position.loadedThrough, pages) > loadedThrough &&
      !appendError
    ) {
      if (appending) return;
      const next = loadedThrough + 1;
      const timer = setTimeout(
        () => setAppendPage({ key: filterKey, page: next }),
        0,
      );
      return () => clearTimeout(timer);
    }
    if (appending) return;
    const frame = requestAnimationFrame(() => {
      // A cancelled frame has not restored anything. Mark completion only when
      // the scroll runs, including after React reactivates a retained page.
      searchRestored.current = true;
      const anchor = document.querySelector<HTMLAnchorElement>(
        `[data-vacancy-id="${position.id}"]`,
      );
      const top =
        anchor && position.anchorOffset !== undefined
          ? window.scrollY +
            anchor.getBoundingClientRect().top -
            position.anchorOffset
          : position.top;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      anchor?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    restoreReady,
    resultsPending,
    error,
    storageReady,
    returnPath,
    pages,
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
  /* Only runs when the visitor chooses the location option; never asks on page load. */
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
    const facets = prefix === 'desktop' && !resultsPending ? searchMeta : null;
    const changeCategory = (value: string) => {
      if (prefix === 'mobile')
        setMobileDraft({ ...draft, category: value, subcategory: undefined });
      else setCategory(value);
    };
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
        {prefix !== 'mobile' && (
          <div className="filter-head">
            <h2>
              <SlidersHorizontal size={17} /> ფილტრები
            </h2>
            <button onClick={reset} disabled={!activeCount}>
              გასუფთავება
            </button>
          </div>
        )}
        {prefix !== 'mobile' && (
          <SalaryFilter prefix={prefix} value={draft} onChange={setAdvanced} />
        )}
        <div className="filter-primary-city">
          <h3>ქალაქი</h3>
          <Choice
            label="ყველა ქალაქი"
            mobile={prefix === 'mobile'}
            value={draft.city}
            onChange={changeCity}
            options={cities}
          />
        </div>
        {prefix === 'mobile' ? (
          <div className="filter-primary-category">
            <h3>მიმართულება</h3>
            <Choice
              label="ყველა მიმართულება"
              mobile={prefix === 'mobile'}
              value={draft.category}
              onChange={changeCategory}
              options={[...categories]}
            />
          </div>
        ) : (
          <>
            <h3>
              მიმართულება <small>· არჩეული პირობებით</small>
            </h3>
            <div className="category-options">
              {(['ყველა', ...categories] as const)
                .filter(
                  (c, index) =>
                    allCategoriesVisible || index < 8 || c === draft.category,
                )
                .map((c) => {
                  const CategoryIcon = categoryIcons[c];
                  return (
                    <label
                      className="check-row"
                      key={c}
                      htmlFor={`${prefix}-${c}`}
                    >
                      <input
                        type="radio"
                        name={`${prefix}-category`}
                        value={c}
                        id={`${prefix}-${c}`}
                        checked={draft.category === c}
                        onChange={() => changeCategory(c)}
                      />
                      <CategoryIcon
                        className="category-icon"
                        size={17}
                        aria-hidden="true"
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
                  );
                })}
            </div>
            <button
              className="category-expand"
              type="button"
              aria-expanded={allCategoriesVisible}
              onClick={() => setAllCategoriesVisible((value) => !value)}
            >
              {allCategoriesVisible ? 'ნაკლების ჩვენება' : 'ყველა მიმართულება'}
              <span aria-hidden="true">{allCategoriesVisible ? '−' : '+'}</span>
            </button>
          </>
        )}
        {subcategories.some((item) => item.category === draft.category) && (
          <div className="filter-subcategory">
            <label htmlFor={`${prefix}-subcategory`}>ქვემიმართულება</label>
            <select
              id={`${prefix}-subcategory`}
              aria-describedby={`${prefix}-subcategory-help`}
              value={draft.subcategory || ''}
              onChange={(event) => {
                if (prefix === 'mobile')
                  setMobileDraft({
                    ...draft,
                    subcategory: event.target.value || undefined,
                  });
                else setSubcategory(event.target.value);
              }}
            >
              <option value="">ყველა — {draft.category}</option>
              {subcategories
                .filter((item) => item.category === draft.category)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
            </select>
            <p
              className="filter-subcategory-help"
              id={`${prefix}-subcategory-help`}
            >
              დაუზუსტებელი ვაკანსიებიც ჩანს „ყველა“-ში.
            </p>
          </div>
        )}
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
        <label
          className="filter-employment-label"
          htmlFor={`${prefix}-employment`}
        >
          განაკვეთი
        </label>
        <select
          className="filter-employment"
          id={`${prefix}-employment`}
          value={draft.employment}
          onChange={(event) => {
            const employment = event.target
              .value as AdvancedFilters['employment'];
            if (prefix === 'mobile') setMobileDraft({ ...draft, employment });
            else setAdvanced({ ...advanced, employment });
          }}
        >
          {Object.entries(employmentLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {prefix === 'mobile' && (
          <SalaryFilter
            prefix={prefix}
            value={draft}
            onChange={(next) => setMobileDraft({ ...draft, ...next })}
          />
        )}
        <details className="filter-extra">
          <summary>
            დამატებითი პირობები
            {draft.entryLevel || draft.postedWithin || draft.source !== 'ყველა'
              ? ' · არჩეულია'
              : ''}
          </summary>
          <AdvancedFilterControls
            prefix={prefix}
            showEmployment={false}
            showSalary={false}
            value={draft}
            onChange={(next) =>
              prefix === 'mobile'
                ? setMobileDraft({ ...draft, ...next })
                : setAdvanced(next)
            }
          />
          <h3>პირველწყარო</h3>
          <Choice
            label="ყველა წყარო"
            mobile={prefix === 'mobile'}
            value={draft.source}
            onChange={changeSource}
            options={Object.values(listingSourceNames)}
          />
        </details>
        <div className="source-note">
          <ShieldCheck size={21} />
          <p>იპოვე აქ. დეტალები გადაამოწმე პირველწყაროზე.</p>
        </div>
      </>
    );
  };
  return (
    <div className="board-shell editorial-board crafted-board refined-board">
      <a className="skip-link" href="#results">
        ვაკანსიებზე გადასვლა
      </a>
      <PublicHeader
        savedCount={saved.length}
        savedOnly={savedOnly}
        onVacancies={() => {
          reset();
          setSavedOnly(false);
          searchBeforeSaved.current = null;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSaved={openSaved}
        onSearch={() => {
          if (savedOnly) openVacancies();
          searchInputRef.current?.focus({ preventScroll: true });
          document
            .getElementById('search-heading')
            ?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
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
          <div className="hero-brand-clip" aria-hidden="true">
            <div className="hero-brand-art" />
          </div>
          <div className="hero-brand-trail" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-copy">
              <h1 id="search-heading">
                {landing ? (
                  landingHeading(landing)
                ) : (
                  <>
                    იპოვე შენი შემდეგი <em>სამსახური.</em>
                  </>
                )}
              </h1>
            </div>
          </div>
          <div className="hero-search-wrap">
            <div className="search-panel">
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
                  <div className="search-query-field">
                    <Search size={20} aria-hidden="true" />
                    <input
                      type="search"
                      enterKeyHint="search"
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label="მოძებნე ვაკანსია ან კომპანია"
                      maxLength={200}
                      placeholder="პოზიცია ან კომპანია"
                      value={query}
                      ref={searchInputRef}
                      aria-autocomplete="list"
                      aria-controls="search-suggest"
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        type="button"
                        className="clear-search"
                        aria-label="საძიებო ტექსტის გასუფთავება"
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setQuery('');
                          searchInputRef.current?.focus();
                        }}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    )}
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
                  </div>
                  <div className="search-city">
                    <MapPin size={18} />
                    <Choice
                      label="ყველა ქალაქი"
                      value={city}
                      onChange={setCity}
                      options={cities}
                      onLocate={canLocate ? locate : undefined}
                      locating={locating}
                    />
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
            <ShortcutMark kind="daily" />
            <strong>დღიური ანაზღაურება</strong>
          </button>
          <button
            className="discovery-shortcut"
            aria-pressed={remote}
            onClick={() => setRemote(!remote)}
          >
            <ShortcutMark kind="remote" />
            <strong>დისტანციური</strong>
          </button>
          <button
            className="discovery-shortcut"
            aria-pressed={advanced.entryLevel}
            onClick={() =>
              setAdvanced({ ...advanced, entryLevel: !advanced.entryLevel })
            }
          >
            <ShortcutMark kind="entry" />
            <strong>გამოცდილების გარეშე</strong>
          </button>
          <button
            className="discovery-shortcut"
            aria-pressed={paid}
            onClick={() => setPaid(!paid)}
          >
            <ShortcutMark kind="salary" />
            <strong>ხელფასი მითითებულია</strong>
          </button>
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
              {!demo && activity.recent.length > 0 && (
                <RecentVacancies
                  items={activity.recent}
                  returnPath={returnPath}
                  onClear={() => {
                    if (!activity.clearRecent())
                      setFeedback('ბრაუზერმა გასუფთავება ვერ შეძლო.');
                  }}
                />
              )}
              <div className="results-toolbar">
                <div className="results-head">
                  <div>
                    <div className="results-title-row">
                      <h2>
                        {savedOnly ? 'შენახული ვაკანსიები' : 'ვაკანსიები'}
                        <span className="result-count">
                          {resultsPending ? '…' : total}
                        </span>
                      </h2>
                      <output
                        className="results-updating"
                        data-active={resultsPending || undefined}
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        <span>
                          {resultsPending
                            ? visibleJobs.length
                              ? 'ახლდება…'
                              : 'იტვირთება…'
                            : ''}
                        </span>
                        <span
                          className="results-loading-track"
                          aria-hidden="true"
                        />
                      </output>
                    </div>
                    <p aria-live="polite">
                      {resultsPending
                        ? 'ვაკანსიებს ვეძებთ…'
                        : savedOnly
                          ? 'შენახულია ამ ბრაუზერში · აქტიური ვაკანსიები'
                          : activeCount
                            ? 'შედეგები შენ მიერ არჩეული პირობებით'
                            : 'იპოვე პოზიცია, რომელიც შენს გეგმებს ერგება'}
                    </p>
                    {/* A word is looked for in what a vacancy calls itself. The
                        descriptions are one line away, with the number they add. */}
                    {!resultsPending && !savedOnly && !!query.trim() && (
                      <p className="search-scope">
                        {searchMeta?.corrected ? (
                          `„${searchMeta.corrected.from}“ ვერ მოიძებნა — ნაჩვენებია „${searchMeta.corrected.to}“.`
                        ) : searchMeta?.widened ? (
                          'სათაურებში ვერ მოიძებნა — ნაჩვენებია ვაკანსიები, სადაც ეს სიტყვა აღწერაშია ნახსენები.'
                        ) : advanced.deep ? (
                          <button
                            onClick={() =>
                              setAdvanced({ ...advanced, deep: false })
                            }
                          >
                            აღწერებშიც ვეძებთ — მხოლოდ სათაურებზე დაბრუნება
                          </button>
                        ) : searchMeta?.wider && searchMeta.wider > total ? (
                          <button
                            onClick={() =>
                              setAdvanced({ ...advanced, deep: true })
                            }
                          >
                            აღწერებშიც მოძებნე — კიდევ{' '}
                            {searchMeta.wider - total} ვაკანსია
                          </button>
                        ) : null}
                      </p>
                    )}
                  </div>
                </div>
                <div className="results-tools">
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
                  <div className="results-sort">
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
                  <PersonalSpace
                    space={personal}
                    filters={currentSearch}
                    onApply={applySearch}
                    active={activeCount > 0}
                    disabled={demo || savedOnly}
                    open={personalOpen}
                    setOpen={setPersonalOpen}
                  />
                </div>
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
                  {subcategory && (
                    <button onClick={() => setSubcategory('')}>
                      {subcategoryFor(category, subcategory)?.label}
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
                      ხელფასი მითითებულია
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
                      {/* With no amount on either side there is no range to
                          show, and "0–∞ ₾ / დღე" named a filter nobody set. */}
                      {advanced.salaryFrom === null &&
                      advanced.salaryTo === null
                        ? 'დღიური ანაზღაურება'
                        : `${advanced.salaryFrom !== null && advanced.salaryTo !== null ? `${advanced.salaryFrom}–${advanced.salaryTo} ₾` : advanced.salaryFrom !== null ? `${advanced.salaryFrom} ₾-დან` : `${advanced.salaryTo} ₾-მდე`} / ${advanced.salaryPeriod === 'day' ? 'დღე' : 'თვე'}`}
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
                  <button className="clear-all-filters" onClick={reset}>
                    ყველა ფილტრის გასუფთავება
                  </button>
                </div>
              )}
              {savedOnly &&
                !resultsPending &&
                !error &&
                unavailable.length > 0 && (
                  <details className="unavailable-saved" open>
                    <summary>
                      დასრულებული ან მიუწვდომელი ({unavailable.length})
                    </summary>
                    <p>
                      ეს განცხადებები აქტიურ შედეგებში აღარ ჩანს. შენახულიდან
                      მხოლოდ შენი სურვილით წაიშლება.
                    </p>
                    <ul>
                      {unavailable.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>{vacancyCardTitle(item.title)}</strong>
                            <span>{item.company}</span>
                            <small>
                              {item.expired
                                ? 'ვადა გასულია'
                                : 'აღარ არის ხელმისაწვდომი'}
                            </small>
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => toggleSave(item.id)}
                            aria-label={`${item.title} — შენახულიდან წაშლა`}
                          >
                            წაშლა
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
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
                <div
                  className="job-list"
                  data-restored={restoredSnapshot || undefined}
                  data-updating={
                    (resultsPending && visibleJobs.length > 0) || undefined
                  }
                >
                  {resultsPending && visibleJobs.length === 0 ? (
                    <VacancySkeletons count={4} />
                  ) : (
                    <VacancySections
                      jobs={visibleJobs}
                      renderCard={(j, index) => (
                        <JobCard
                          key={`${loadedResult.key}:${loadedResult.page}:${j.id}`}
                          index={index}
                          job={j}
                          demo={demo}
                          saved={savedSet.has(j.id)}
                          seen={seenSet.has(j.id)}
                          status={applicationsById.get(j.id)}
                          returnPath={loadedResult.path}
                          onToggleSave={toggleSave}
                          onOpen={openJob}
                          onHide={hideJob}
                        />
                      )}
                    />
                  )}
                </div>
              )}
              {!resultsPending && !error && !visibleJobs.length && (
                <div className="empty">
                  <div className="empty-icon">
                    {savedOnly ? <Bookmark size={28} /> : <Search size={28} />}
                  </div>
                  <h3>
                    {savedOnly &&
                    unavailable.length === saved.length &&
                    saved.length > 0
                      ? 'აქტიური შენახული ვაკანსია აღარ გაქვს'
                      : savedOnly && !saved.length
                        ? 'საინტერესო ვაკანსია შეინახე'
                        : 'ამ პირობებით ვაკანსია ვერ მოიძებნა'}
                  </h3>
                  <p>
                    {savedOnly &&
                    unavailable.length === saved.length &&
                    saved.length > 0
                      ? 'ძველი განცხადებები ზემოთ დარჩა. ახალი შესაძლებლობები ყველა ვაკანსიაში მოძებნე.'
                      : savedOnly && !saved.length
                        ? 'დააჭირე ბარათზე შენახვის ნიშანს და მოგვიანებით აქ დაბრუნდი.'
                        : 'შეცვალე საძიებო სიტყვა ან შეამცირე ფილტრების რაოდენობა.'}
                  </p>
                  {searchMeta?.suggestion && (
                    <button
                      className="secondary-button"
                      onClick={() => setQuery(searchMeta.suggestion!.query)}
                    >
                      {searchMeta.suggestion.kind === 'fewer-words'
                        ? 'ვცადოთ '
                        : 'ხომ არ გულისხმობდი '}
                      „{searchMeta.suggestion.query}“? (
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
                <div className="load-more-row" ref={nextPageTarget}>
                  {appending && (
                    <div className="append-loading">
                      {/* The cards arriving are the message; with the next page
                          fetched before the reader reaches the end, something
                          has to occupy the space it will land in. */}
                      <output className="sr-only">
                        შემდეგი ვაკანსიები იტვირთება…
                      </output>
                      <VacancySkeletons count={2} />
                    </div>
                  )}
                  <a
                    href={searchReturnPath(
                      currentSearch,
                      loadedThrough + 1,
                      savedOnly,
                      demo,
                    )}
                    rel="next"
                    className="load-more secondary-button"
                    aria-disabled={appending || undefined}
                    onClick={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      if (!appending) loadMore();
                    }}
                  >
                    {appending
                      ? 'იტვირთება…'
                      : appendError
                        ? 'ხელახლა ცდა'
                        : loadedThrough - page >= 49
                          ? 'შემდეგი ვაკანსიების ნახვა'
                          : `მეტის ჩვენება · კიდევ ${Math.min(listPageSize, Math.max(0, total - (page - 1) * listPageSize - jobs.length))}`}
                  </a>
                  {appendError && (
                    <p className="load-more-error" role="alert">
                      {appendError}
                    </p>
                  )}
                </div>
              )}
              {!error && !resultsPending && total > 0 && (
                <div className="results-progress">
                  <output>
                    ნაჩვენებია {(page - 1) * listPageSize + 1}–
                    {Math.min(
                      (page - 1) * listPageSize + visibleJobs.length,
                      total,
                    )}{' '}
                    / {total} ვაკანსია
                  </output>
                  {page > 1 && (
                    <a
                      href={searchReturnPath(
                        currentSearch,
                        page - 1,
                        savedOnly,
                        demo,
                      )}
                      rel="prev"
                      className="secondary-button"
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        paginate(page - 1);
                      }}
                    >
                      წინა გვერდი
                    </a>
                  )}
                  {page > 2 && (
                    <button
                      className="secondary-button"
                      onClick={() => paginate(1)}
                    >
                      სიის დასაწყისში დაბრუნება
                    </button>
                  )}
                </div>
              )}
              <div className="results-foot">
                <ShieldCheck size={16} />
                <span>ვაკანსიები დამსაქმებლებისა და სამუშაოს საიტებიდან</span>
              </div>
            </section>
          </div>
        </div>
      </main>
      {/* Reader-facing, and the only way a crawler reaches these lists by
          following links rather than by reading the sitemap. */}
      <nav className="search-directory" aria-label="მსგავსი ძიებები">
        {/* Below the vacancies, not above them: a list with nothing to read is
            a thin page, but the reader came for the list and the sentence that
            describes it has no business standing between them. */}
        {landing && <p className="landing-copy">{landingCopy(landing)}</p>}
        {landing && (
          <div className="search-directory-related">
            <h2>მსგავსი ძიებები</h2>
            <div className="search-directory-links">
              {relatedLandings(landing).map(({ path, label }) => (
                <Link key={path} href={path} prefetch={false}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
        <SearchDirectoryGroups />
      </nav>
      <footer className="site-footer jobx-footer">
        <div className="footer-main">
          <Brand />
          <nav aria-label="ფუტერის ნავიგაცია">
            <a href="#search-heading">
              <Search size={16} aria-hidden="true" /> ძებნა
            </a>
            <button onClick={openSaved}>
              <Bookmark size={16} aria-hidden="true" /> შენახული ვაკანსიები
            </button>
            <Link href="/cv" prefetch={false}>
              <FileText size={16} aria-hidden="true" /> რეზიუმეს შედგენა
            </Link>
          </nav>
        </div>
        <details id="how-it-works" className="footer-help">
          <summary>
            <CircleHelp size={16} aria-hidden="true" /> როგორ მუშაობს JOBX?
          </summary>
          <p>
            მოძებნე ვაკანსია, გაეცანი პირობებს და განაცხადისთვის გადადი
            პირველწყაროზე. შენახული ვაკანსიები ამ ბრაუზერში რჩება და სხვა
            მოწყობილობაზე ავტომატურად არ გადადის. თემას, შენახულ ვაკანსიებსა და
            შენ მიერ შენახულ კონტაქტებს ამ ბრაუზერში ვინახავთ; ძიებებისა და
            მოქმედებების ანონიმური სტატისტიკა სერვერზე ინახება, ზოგი ლოგო კი
            გარე საიტიდან იტვირთება. საჯარო გვერდების ვიზიტებს Google
            Analytics-ითაც ვზომავთ; ის ანალიტიკურ ქუქი-ფაილებს იყენებს. ფორმებში
            შეყვანილ პირად მონაცემებსა და შენახულ კონტაქტებს Google Analytics-ს
            არ ვუგზავნით.{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              როგორ იყენებს Google მონაცემებს
            </a>
            .
          </p>
        </details>
        <div className="footer-meta">
          <span>ვაკანსიები სხვადასხვა წყაროდან</span>
          <span>© {new Date().getFullYear()} JOBX</span>
        </div>
      </footer>
      {saveNotice && !feedback && !filtersOpen && (
        <div className="feedback-toast save-confirmation">
          <output>
            <Check size={17} />
            {saveNotice.wasSaved
              ? 'შენახულებიდან ამოღებულია'
              : 'ვაკანსია შენახულია'}
          </output>
          <button className="undo-save" onClick={undoSave}>
            გაუქმება
          </button>
          <button
            aria-label="შეტყობინების დახურვა"
            onClick={() => setSaveNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {feedback && !filtersOpen && (
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
            <button
              className="mobile-filters-clear"
              disabled={!mobileKey}
              onClick={() => setMobileDraft(readSearch(new URLSearchParams()))}
            >
              გასუფთავება
            </button>
            <SheetDescription>
              მონიშნე პირობები — სია განახლდება „შედეგების ჩვენებაზე“ დაჭერისას.
            </SheetDescription>
          </SheetHeader>
          <div className="filters">{renderFilters('mobile')}</div>
          <div className="mobile-filters-footer">
            <button
              className="primary filters-apply"
              disabled={
                !!mobileDraft &&
                mobileDraft.salaryFrom !== null &&
                mobileDraft.salaryTo !== null &&
                mobileDraft.salaryFrom > mobileDraft.salaryTo
              }
              onClick={() => {
                if (mobileDraft) applySearch(mobileDraft);
                setFiltersOpen(false);
                setMobileDraft(null);
              }}
            >
              შედეგების ჩვენება <ArrowRight size={16} />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
