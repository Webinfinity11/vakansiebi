'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  SlidersHorizontal,
  MapPin,
  BriefcaseBusiness,
  Clock3,
  Bookmark,
  Check,
  X,
  Share2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  ArrowDown,
  Laptop,
  ShieldCheck,
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
import { QuickApply } from './quick-apply';
import {
  PersonalSpace,
  ApplicationControl,
  usePersonalSpace,
} from './personal-space';
import type { SearchFilters } from '@/lib/personal-space';
import type { PublicJob as Job } from '@/lib/types';
import { categories, sourceNames } from '@/lib/types';

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
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="ერთად — მთავარი გვერდი">
      <span className="brand-icon">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M6 23V13a7 7 0 0 1 14 0v10M12 23V13a7 7 0 0 1 14 0v10"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M6 23h20"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>
        ერთად<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
const cities = [
  'თბილისი',
  'ბათუმი',
  'ქუთაისი',
  'რუსთავი',
  'გორი',
  'ზუგდიდი',
  'ფოთი',
  'თელავი',
  'კასპი',
  'მცხეთა',
  'ახალციხე',
  'ბორჯომი',
  'ოზურგეთი',
  'სხვა',
];
function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${day} ${['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'][month - 1]}`;
}
function Description({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks: { kind: 'list' | 'heading' | 'p'; lines: string[] }[] = [];
  for (const line of paragraphs) {
    if (/^[•*▪–]\s|^\d+[.)]\s/.test(line)) {
      if (blocks.at(-1)?.kind !== 'list')
        blocks.push({ kind: 'list', lines: [] });
      blocks.at(-1)!.lines.push(line.replace(/^[•*▪–]\s*|^\d+[.)]\s*/, ''));
    } else
      blocks.push({
        kind: line.length < 110 && /[:：]$/.test(line) ? 'heading' : 'p',
        lines: [line],
      });
  }
  return (
    <div className="vacancy-description">
      {blocks.map((b, i) =>
        b.kind === 'list' ? (
          <ul key={i}>
            {b.lines.map((line, k) => (
              <li key={k}>{line}</li>
            ))}
          </ul>
        ) : b.kind === 'heading' ? (
          <h3 key={i}>{b.lines[0].replace(/:$/, '')}</h3>
        ) : (
          <p key={i}>{b.lines[0]}</p>
        ),
      )}
    </div>
  );
}

function SourceStatus({ job }: { job: Job }) {
  const checked = job.sources
    .filter((s) => s.health === 'recent' && s.checkedAt)
    .sort((a, b) => b.checkedAt!.localeCompare(a.checkedAt!))[0];
  const unavailable =
    job.sources.length > 0 &&
    job.sources.every((s) => s.health === 'unavailable');
  return (
    <div className="job-evidence">
      {job.sources.length > 1 && <span>{job.sources.length} პირველწყარო</span>}
      <span>
        {checked
          ? `წყარო შემოწმდა ${formatDate(checked.checkedAt!)}`
          : unavailable
            ? 'წყაროს შემოწმება ვერ მოხერხდა'
            : 'აქტუალურობა გადაამოწმე პირველწყაროზე'}
      </span>
    </div>
  );
}
export default function JobBoard() {
  const params = useSearchParams();
  const demo = params.get('preview') === '1';
  const deepId = params.get('job');
  const personal = usePersonalSpace();
  const [personalOpen, setPersonalOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [query, setQuery] = useState(''),
    [city, setCity] = useState('ყველა'),
    [category, setCategory] = useState('ყველა'),
    [source, setSource] = useState('ყველა'),
    [paid, setPaid] = useState(false),
    [remote, setRemote] = useState(false),
    [sort, setSort] = useState('შესაბამისობა');
  const [selected, setSelected] = useState<Job | null>(null),
    [filtersOpen, setFiltersOpen] = useState(false),
    [savedOnly, setSavedOnly] = useState(false),
    [saved, setSaved] = useState<string[]>([]),
    [storageReady, setStorageReady] = useState(false),
    [feedback, setFeedback] = useState(''),
    [retry, setRetry] = useState(0);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const detailId = selected?.id;
  const needsDetail = selected?.summary === true;
  useEffect(() => {
    if (!detailId || !needsDetail) return;
    const controller = new AbortController();
    void fetch(`/api/jobs?ids=${detailId}&preview=${demo ? '1' : '0'}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error('დეტალები ვერ ჩაიტვირთა. სცადე ხელახლა.');
        const data = await response.json();
        if (!data.jobs?.[0]) throw Error('ვაკანსია აღარ არის ხელმისაწვდომი.');
        if (!controller.signal.aborted)
          setSelected((current) =>
            current?.id === detailId ? data.jobs[0] : current,
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted) setDetailError(error.message);
      });
    return () => controller.abort();
  }, [detailId, needsDetail, demo, detailRetry]);
  const [pageState, setPageState] = useState({ key: '', page: 1 }),
    [total, setTotal] = useState(0),
    [pages, setPages] = useState(0);
  const filterKey = JSON.stringify([
    query,
    city,
    category,
    source,
    paid,
    remote,
    sort,
    savedOnly,
    savedOnly ? saved : [],
  ]);
  const page = pageState.key === filterKey ? pageState.page : 1;
  const savedFilter = savedOnly ? saved.join(',') : '';
  const activeCount = [
    query,
    city === 'ყველა' ? '' : city,
    category === 'ყველა' ? '' : category,
    source === 'ყველა' ? '' : source,
    paid,
    remote,
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
    if (!deepId || !/^[a-f0-9-]{36}$/.test(deepId)) return;
    const controller = new AbortController();
    void fetch(`/api/jobs?ids=${deepId}&preview=${demo ? '1' : '0'}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (!controller.signal.aborted) {
          if (d.jobs?.[0]) setSelected(d.jobs[0]);
          else setFeedback('ვაკანსია აღარ არის ხელმისაწვდომი.');
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [deepId, demo]);
  useEffect(() => {
    if (savedOnly && !storageReady) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      const p = new URLSearchParams({
        q: query,
        city: city === 'ყველა' ? '' : city,
        category: category === 'ყველა' ? '' : category,
        source: source === 'ყველა' ? '' : source,
        paid: String(paid),
        remote: String(remote),
        sort:
          sort === 'მაღალი ხელფასი'
            ? 'salary'
            : sort === 'ვადა იწურება'
              ? 'deadline'
              : sort === 'უახლესი'
                ? 'new'
                : 'relevance',
        page: String(page),
        summary: '1',
        preview: demo ? '1' : '0',
      });
      if (savedOnly) p.set('ids', savedFilter);
      void fetch('/api/jobs?' + p, { signal: controller.signal })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error || 'ვაკანსიები ვერ ჩაიტვირთა');
          return d;
        })
        .then((d) => {
          if (!controller.signal.aborted) {
            setJobs(d.jobs);
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
    }, 250);
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
    page,
    demo,
    savedOnly,
    savedFilter,
    storageReady,
    retry,
  ]);
  const applySearch = (filters: SearchFilters) => {
    setPageState({ key: '', page: 1 });
    setQuery(filters.query);
    setCity(filters.city);
    setCategory(filters.category);
    setSource(filters.source);
    setPaid(filters.paid);
    setRemote(filters.remote);
    setSort(filters.sort);
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
  async function share(job: Job) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/?job=${job.id}`,
      );
      setFeedback('ვაკანსიის ბმული დაკოპირებულია');
    } catch {
      setFeedback('ბმულის კოპირება ვერ მოხერხდა.');
    }
  }
  const renderFilters = (prefix: string) => (
    <>
      <div className="filter-head">
        <h2>
          <SlidersHorizontal size={17} /> ფილტრები
        </h2>
        <button onClick={reset} disabled={!activeCount}>
          გასუფთავება
        </button>
      </div>
      <h3>მიმართულება</h3>
      <div className="category-options">
        {categories.map((c) => (
          <label className="check-row" key={c} htmlFor={`${prefix}-${c}`}>
            <Checkbox
              id={`${prefix}-${c}`}
              checked={category === c}
              onCheckedChange={(v) => setCategory(v ? c : 'ყველა')}
            />
            {c}
          </label>
        ))}
      </div>
      <div className="filter-divider" />
      <h3>სამუშაო პირობები</h3>
      <label className="check-row" htmlFor={`${prefix}-remote`}>
        <Checkbox
          id={`${prefix}-remote`}
          checked={remote}
          onCheckedChange={setRemote}
        />
        დისტანციური
      </label>
      <label className="check-row" htmlFor={`${prefix}-paid`}>
        <Checkbox
          id={`${prefix}-paid`}
          checked={paid}
          onCheckedChange={setPaid}
        />
        ხელფასი მითითებულია
      </label>
      <div className="filter-divider" />
      <h3>ქალაქი</h3>
      <Choice
        label="ყველა ქალაქი"
        value={city}
        onChange={setCity}
        options={cities}
      />
      <div className="filter-divider" />
      <h3>პირველწყარო</h3>
      <Choice
        label="ყველა წყარო"
        value={source}
        onChange={setSource}
        options={Object.values(sourceNames)}
      />
      <div className="source-note">
        <ShieldCheck size={21} />
        <p>იპოვე აქ. დეტალები გადაამოწმე პირველწყაროზე.</p>
      </div>
    </>
  );
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
          <button
            className={`saved-nav ${savedOnly ? 'is-active' : ''}`}
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
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> კარიერის ახალი დასაწყისი
              </div>
              <h1>
                ბევრი შესაძლებლობა.
                <br />
                <em>ყველაფერი ერთად.</em>
              </h1>
              <p>
                შენი შემდეგი სამსახური რამდენიმე საიტზეა.
                <br className="desktop-break" /> ჩვენ მათ ერთ სივრცეში
                ვაერთიანებთ.
              </p>
              <a className="hero-discover" href="#results">
                იპოვე შენი შესაძლებლობა <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="art-label art-label-top">შენი ახალი ნაბიჯი</span>
              <div className="art-source art-source-hr">
                hr<span>.ge</span>
              </div>
              <div className="art-source art-source-jobs">
                jobs<span>.ge</span>
              </div>
              <div className="art-source art-source-ss">
                jobs.ss<span>.ge</span>
              </div>
              <div className="art-center">
                <svg viewBox="0 0 32 32" fill="none">
                  <path
                    d="M6 23V13a7 7 0 0 1 14 0v10M12 23V13a7 7 0 0 1 14 0v10M6 23h20"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                <span>ერთად.</span>
              </div>
              <span className="art-spark">✳</span>
              <span className="art-caption">
                <span /> ერთი სივრცე. მეტი არჩევანი.
              </span>
            </div>
          </div>
          <div className="hero-search-wrap">
            <form
              className="searchbar"
              onSubmit={(e) => {
                e.preventDefault();
                document
                  .getElementById('results')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Search size={22} />
              <input
                aria-label="მოძებნე ვაკანსია ან კომპანია"
                placeholder="პოზიცია, კომპანია ან საკვანძო სიტყვა"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="search-city">
                <MapPin size={18} />
                <Choice
                  label="ყველა ქალაქი"
                  value={city}
                  onChange={setCity}
                  options={cities}
                />
              </div>
              <button className="primary" type="submit">
                მოძებნე ვაკანსია <ArrowRight size={18} />
              </button>
            </form>
            <div className="quick">
              <span>სცადე:</span>
              {['ტექნოლოგიები', 'გაყიდვები', 'მარკეტინგი'].map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  className={category === c ? 'active' : ''}
                  onClick={() => setCategory(category === c ? 'ყველა' : c)}
                >
                  {c}
                  <ArrowUpRight size={12} />
                </button>
              ))}
              <button
                aria-pressed={remote}
                className={remote ? 'active' : ''}
                onClick={() => setRemote(!remote)}
              >
                <Laptop size={13} /> დისტანციური
              </button>
            </div>
          </div>
        </section>
        <div className="page board-page">
          <div className="workspace">
            <aside className="filters desktop-filters">
              {renderFilters('desktop')}
            </aside>
            <section id="results" className="results" aria-busy={loading}>
              <div className="results-head">
                <div>
                  <div className="section-kicker">შენი კარიერისთვის</div>
                  <h2>
                    {savedOnly
                      ? 'შენახული ვაკანსიები'
                      : 'აღმოაჩინე შესაძლებლობები'}
                    <span className="result-count">
                      {loading ? '…' : total}
                    </span>
                  </h2>
                  <p aria-live="polite">
                    {loading
                      ? 'ვაკანსიებს ვეძებთ…'
                      : savedOnly
                        ? 'შენახულია ამ ბრაუზერში · აქტიური ვაკანსიები'
                        : 'შეადარე პირობები და აირჩიე შენი შემდეგი ნაბიჯი'}
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
              <PersonalSpace
                space={personal}
                filters={{ query, city, category, source, paid, remote, sort }}
                active={activeCount > 0}
                disabled={demo}
                onApply={applySearch}
                open={personalOpen}
                setOpen={setPersonalOpen}
              />
              <button
                className="mobile-filter-toggle secondary-button"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal size={16} />
                ფილტრები {activeCount > 0 && <b>{activeCount}</b>}
              </button>
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
                </div>
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
                  {loading && jobs.length === 0
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
                        <article className="job-card" key={j.id}>
                          <CompanyLogo company={j.company} url={j.logoUrl} />
                          <div className="job-info">
                            <div className="job-company">
                              <span>{j.company || 'კომპანია'}</span>
                              <span className="source-pill">
                                <span />
                                {j.source}
                              </span>
                            </div>
                            <button
                              className="job-title"
                              onClick={() => {
                                setDetailError('');
                                setSelected(j);
                              }}
                            >
                              {j.title}
                            </button>
                            <div className="job-meta">
                              {j.city && (
                                <span>
                                  <MapPin size={13} />
                                  {j.city}
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
                            <SourceStatus job={j} />
                            <div className="card-bottom">
                              <span className="category-tag">{j.category}</span>
                              {j.salary ? (
                                <span className="salary">{j.salary}</span>
                              ) : (
                                <span className="no-salary">
                                  ანაზღაურება არ არის მითითებული
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="job-side">
                            <button
                              className={`save-button ${saved.includes(j.id) ? 'is-saved' : ''}`}
                              aria-label={
                                saved.includes(j.id)
                                  ? `${j.title} — შენახულიდან წაშლა`
                                  : `${j.title} — შენახვა`
                              }
                              aria-pressed={saved.includes(j.id)}
                              onClick={() => toggleSave(j.id)}
                            >
                              <Bookmark size={19} />
                            </button>
                            <span className="job-date">
                              {formatDate(j.datePosted)}
                            </span>
                            <button
                              className="card-open"
                              aria-label={`${j.title} — დეტალები`}
                              onClick={() => {
                                setDetailError('');
                                setSelected(j);
                              }}
                            >
                              <ArrowUpRight size={19} />
                            </button>
                          </div>
                        </article>
                      ))}
                </div>
              )}
              {!loading && !error && !jobs.length && (
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
              {pages > 1 && (
                <div className="board-pagination">
                  <span>
                    {page} / {pages} გვერდი
                  </span>
                  <button
                    aria-label="წინა გვერდი"
                    disabled={page === 1 || loading}
                    onClick={() => paginate(page - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    aria-label="შემდეგი გვერდი"
                    disabled={page === pages || loading}
                    onClick={() => paginate(page + 1)}
                  >
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
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="mobile-filters-sheet">
          <SheetHeader>
            <SheetTitle>მოარგე ძებნა შენს სურვილებს</SheetTitle>
            <SheetDescription>
              აირჩიე მიმართულება და სამუშაო პირობები.
            </SheetDescription>
          </SheetHeader>
          <div className="filters">{renderFilters('mobile')}</div>
          <button className="primary" onClick={() => setFiltersOpen(false)}>
            შედეგების ნახვა <ArrowRight size={16} />
          </button>
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetDescription>
              ვაკანსიის დეტალები · {selected?.source}
            </SheetDescription>
            <SheetTitle className="sr-only">
              {selected?.title || 'ვაკანსია'}
            </SheetTitle>
          </SheetHeader>
          {selected && (
            <>
              <div className="detail-body">
                <div className="detail-company">
                  <CompanyLogo
                    large
                    company={selected.company}
                    url={selected.logoUrl}
                  />
                  <div>
                    <span>დამსაქმებელი</span>
                    <strong>{selected.company}</strong>
                  </div>
                  <button
                    className={`save-button ${saved.includes(selected.id) ? 'is-saved' : ''}`}
                    aria-label="ვაკანსიის შენახვა"
                    aria-pressed={saved.includes(selected.id)}
                    onClick={() => toggleSave(selected.id)}
                  >
                    <Bookmark size={21} />
                  </button>
                </div>
                <span className="category-tag">{selected.category}</span>
                <h2 className="detail-title">{selected.title}</h2>
                <div className="detail-dates">
                  {selected.datePosted && (
                    <span>გამოქვეყნდა {formatDate(selected.datePosted)}</span>
                  )}
                  {selected.deadline && (
                    <span>
                      <Clock3 size={13} />
                      ბოლო ვადა: {formatDate(selected.deadline)}
                    </span>
                  )}
                </div>
                {!selected.summary && (
                  <QuickApply key={selected.id} job={selected} />
                )}
                <ApplicationControl
                  job={selected}
                  space={personal}
                  disabled={demo}
                />
                <dl className="detail-facts">
                  {[
                    ['ანაზღაურება', selected.salary || 'არ არის მითითებული'],
                    ['ქალაქი', selected.city || 'არ არის მითითებული'],
                    ['განაკვეთი', selected.employmentType],
                    ['სამუშაო რეჟიმი', selected.mode],
                  ]
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
                {!!selected.facts?.length && (
                  <details className="extra-facts">
                    <summary>
                      დამატებითი პირობები და მოთხოვნები{' '}
                      <span>{selected.facts.length}</span>
                    </summary>
                    <dl>
                      {selected.facts.map((f) => (
                        <div key={f.label}>
                          <dt>{f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
                <h3 className="description-heading">პოზიციის შესახებ</h3>
                {(selected.companyProfile?.website ||
                  selected.companyProfile?.description) && (
                  <section className="company-about">
                    <h3>დამსაქმებლის შესახებ</h3>
                    {selected.companyProfile.description && (
                      <p>{selected.companyProfile.description}</p>
                    )}
                    {selected.companyProfile.website && (
                      <a
                        href={selected.companyProfile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe2 size={14} />
                        ოფიციალური ვებსაიტი
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </section>
                )}
                <SourceStatus job={selected} />
                {selected.sourceChanged && (
                  <p className="source-update-note">
                    პირველწყაროზე ცვლილებაა დაფიქსირებული. განაცხადის
                    გაგზავნამდე გადაამოწმე განახლებული პირობები.
                  </p>
                )}
                {selected.summary ? (
                  <div aria-live="polite">
                    <output>{detailError || 'დეტალები იტვირთება…'}</output>
                    {detailError && (
                      <button
                        className="secondary-button"
                        onClick={() => (
                          setDetailError(''),
                          setDetailRetry((value) => value + 1)
                        )}
                      >
                        ხელახლა ცდა
                      </button>
                    )}
                  </div>
                ) : (
                  <Description text={selected.description} />
                )}
                {!!selected.applicationLinks?.length && (
                  <div className="application-links">
                    <h3>ბმულები განცხადებიდან</h3>
                    {selected.applicationLinks.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {l.label}
                        <ArrowUpRight size={16} />
                      </a>
                    ))}
                  </div>
                )}
                <div className="detail-source">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>ინფორმაცია პირველწყაროდან</strong>
                    <p>
                      განაცხადის გაგზავნამდე გადაამოწმე პირობები და აქტუალურობა.
                    </p>
                    <div className="editor-source-links">
                      {selected.sources.map((s) => (
                        <a
                          key={s.url}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>
                            {s.source}
                            <small className="source-check-note">
                              {s.health === 'unavailable'
                                ? 'ბოლო შემოწმება ვერ შესრულდა'
                                : s.checkedAt
                                  ? `შემოწმდა ${formatDate(s.checkedAt)}${s.health === 'stale' ? ' · ხელახლა გადასამოწმებელია' : ''}`
                                  : 'ჯერ არ შემოწმებულა'}
                            </small>
                          </span>
                          <ArrowUpRight size={13} />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="detail-actions">
                <a
                  className="primary"
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ნახე პირველწყაროზე <ArrowUpRight size={18} />
                </a>
                {!demo && (
                  <button
                    className="secondary-button"
                    onClick={() => void share(selected)}
                  >
                    <Share2 size={17} />
                    <span>გაზიარება</span>
                  </button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
