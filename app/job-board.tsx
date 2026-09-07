'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  MapPin,
  BriefcaseBusiness,
  Clock3,
  Layers3,
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
import type { PublicJob as Job } from '@/lib/types';
import { categories } from '@/lib/types';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
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
    <Link className="brand" href="/">
      <span className="brand-icon">
        <Layers3 size={25} />
      </span>
      ერთად<span className="brand-dot">.</span>
    </Link>
  );
}
export default function JobBoard() {
  const [jobs, setJobs] = useState<Job[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [query, setQuery] = useState(''),
    [city, setCity] = useState('ყველა'),
    [category, setCategory] = useState('ყველა'),
    [source, setSource] = useState('ყველა'),
    [paid, setPaid] = useState(false),
    [remote, setRemote] = useState(false),
    [sort, setSort] = useState('უახლესი'),
    [selected, setSelected] = useState<Job | null>(null),
    [pageState, setPageState] = useState({ key: '', page: 1 }),
    [total, setTotal] = useState(0),
    [pages, setPages] = useState(0);
  const demo = useSearchParams().get('preview') === '1';
  const filterKey = JSON.stringify([
    query,
    city,
    category,
    source,
    paid,
    remote,
    sort,
  ]);
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (value: number | ((p: number) => number)) =>
    setPageState({
      key: filterKey,
      page: typeof value === 'function' ? value(page) : value,
    });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      const preview = demo;
      const p = new URLSearchParams({
        q: query,
        city: city === 'ყველა' ? '' : city,
        category: category === 'ყველა' ? '' : category,
        source: source === 'ყველა' ? '' : source,
        paid: String(paid),
        remote: String(remote),
        sort: sort === 'მაღალი ხელფასი' ? 'salary' : 'new',
        page: String(page),
        preview: preview ? '1' : '0',
      });
      fetch('/api/jobs?' + p, { signal: controller.signal })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error || 'ვაკანსიები ვერ ჩაიტვირთა');
          return d;
        })
        .then((d) => {
          setJobs(d.jobs);
          setTotal(d.total);
          setPages(d.pages);
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
  }, [query, city, category, source, paid, remote, sort, page, demo]);
  const list = jobs;
  const reset = () => {
    setQuery('');
    setCity('ყველა');
    setCategory('ყველა');
    setSource('ყველა');
    setPaid(false);
    setRemote(false);
  };
  return (
    <>
      <header className="topbar">
        <div className="header-inner">
          <Brand />
          <nav>
            <Link className="nav-active" href="/">
              ვაკანსიები
            </Link>
            <Link href="/admin">
              ადმინის სივრცე <ArrowUpRight size={15} />
            </Link>
          </nav>
          <span className="test-badge">
            <span /> სატესტო ვერსია
          </span>
        </div>
      </header>
      <main className="page">
        <section className="search-section">
          <div className="eyebrow">
            <span /> სხვადასხვა წყარო · ერთი სივრცე
          </div>
          <h1>
            შენი შემდეგი სამსახური<span> აქ იწყება.</span>
          </h1>
          <div className="searchbar">
            <Search size={23} />
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
                options={['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი']}
              />
            </div>
            <button
              className="primary"
              onClick={() =>
                document
                  .getElementById('results')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              ძებნა <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="quick">
            <span>სწრაფი არჩევანი</span>
            {['ტექნოლოგიები', 'გაყიდვები', 'მარკეტინგი'].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? 'ყველა' : c)}
                className={category === c ? 'active' : ''}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => setRemote(!remote)}
              className={remote ? 'active' : ''}
            >
              დისტანციური <ArrowUpRight size={13} />
            </button>
          </div>
        </section>
        <div className="workspace">
          <aside className="filters">
            <div className="filter-head">
              <h2>
                <SlidersHorizontal size={18} />
                ფილტრები
              </h2>
              <button onClick={reset}>გასუფთავება</button>
            </div>
            <h3>მიმართულება</h3>
            {categories.map((c) => (
              <label className="check-row" key={c}>
                <Checkbox
                  checked={category === c}
                  onCheckedChange={(v) => setCategory(v ? c : 'ყველა')}
                />
                {c}
              </label>
            ))}
            <div className="filter-divider" />
            <h3>სამუშაო პირობები</h3>
            <label className="check-row" htmlFor="remote-filter">
              <Checkbox
                id="remote-filter"
                checked={remote}
                onCheckedChange={setRemote}
              />
              დისტანციური
            </label>
            <label className="check-row" htmlFor="paid-filter">
              <Checkbox
                id="paid-filter"
                checked={paid}
                onCheckedChange={setPaid}
              />
              მითითებული ხელფასით
            </label>
            <div className="filter-divider" />
            <h3>წყარო</h3>
            <Choice
              label="ყველა წყარო"
              value={source}
              onChange={setSource}
              options={['hr.ge', 'jobs.ge', 'samushao.ge']}
            />
            <div className="source-note">
              <ShieldCheck size={21} />
              <p>ყველა ვაკანსიას ახლავს პირველწყაროს ბმული.</p>
            </div>
          </aside>
          <section id="results" className="results">
            <div className="results-head">
              <div>
                <h2>აღმოაჩინე შესაძლებლობები</h2>
                <p aria-live="polite">
                  {loading
                    ? 'იტვირთება…'
                    : `${total} ${demo ? 'ჩანაწერი წინასწარი ნახვისთვის' : 'ვაკანსია'}`}
                </p>
              </div>
              <Choice
                label="დალაგება"
                value={sort}
                onChange={(v) => setSort(v === 'ყველა' ? 'უახლესი' : v)}
                options={['უახლესი', 'მაღალი ხელფასი']}
              />
            </div>
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
            {demo && (
              <div className="demo-note">
                <span>ადმინის წინასწარი ნახვა</span> აქ გამოუქვეყნებელი
                ვაკანსიებიც ჩანს. საჯაროდ მხოლოდ დამტკიცებული ჩანაწერები
                გამოჩნდება.
              </div>
            )}
            <div className="job-list">
              {list.map((j, i) => (
                <article className="job-card" key={j.id}>
                  <div className={`company-mark mark-${i % 4}`}>
                    {j.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="job-info">
                    <div className="job-company">
                      {j.company}
                      <span className="source-pill">{j.source}</span>
                    </div>
                    <button
                      className="job-title"
                      onClick={() => setSelected(j)}
                    >
                      {j.title}
                    </button>
                    <div className="job-meta">
                      <span>
                        <MapPin size={14} />
                        {j.city || 'ქალაქი მითითებული არ არის'}
                      </span>
                      <span>
                        <BriefcaseBusiness size={14} />
                        {j.category || 'სხვა'}
                      </span>
                      <span>
                        <Clock3 size={14} />
                        {j.mode || 'რეჟიმი დასაზუსტებელია'}
                      </span>
                    </div>
                  </div>
                  <div className="job-side">
                    <span className={j.salary ? 'salary' : 'no-salary'}>
                      {j.salary || 'ხელფასი არ არის მითითებული'}
                    </span>
                    <button
                      aria-label={`${j.title} — დეტალები`}
                      onClick={() => setSelected(j)}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!loading && !error && !list.length && (
              <div className="empty">
                <Search size={32} />
                <h3>ამ პირობებით ვაკანსია ვერ მოიძებნა</h3>
                <p>სცადე სხვა საკვანძო სიტყვა ან შეცვალე ფილტრები.</p>
                <button className="primary" onClick={reset}>
                  ფილტრების გასუფთავება
                </button>
              </div>
            )}
            {pages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <button
                      className="secondary-button"
                      disabled={page === 1 || loading}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      წინა
                    </button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="page-number">
                      {page} / {pages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <button
                      className="secondary-button"
                      disabled={page === pages || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      შემდეგი
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
            <div className="results-foot">
              <Layers3 size={17} />
              <span>მეტი წყარო. ნაკლები ძებნა.</span>
              <Link href="/admin">
                წყაროების მართვა <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>
        </div>
      </main>
      <footer>
        <Brand />
        <span>ვაკანსიები ერთ სივრცეში</span>
        <span>© 2026 ერთად</span>
      </footer>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetDescription>
              {selected?.company} · {selected?.source}
            </SheetDescription>
            <SheetTitle className="detail-title">{selected?.title}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="detail-body">
              <div className="detail-facts">
                <span>{selected.city}</span>
                <span>{selected.salary || 'ხელფასი მითითებული არ არის'}</span>
                <span>{selected.mode}</span>
                {selected.deadline && (
                  <span>ბოლო ვადა: {selected.deadline}</span>
                )}
              </div>
              <p className="description">{selected.description}</p>
              <div className="editor-source-links">
                {selected.sources?.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.source} <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
              <a
                className="primary"
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                ნახე პირველწყაროზე <ArrowUpRight size={18} />
              </a>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
