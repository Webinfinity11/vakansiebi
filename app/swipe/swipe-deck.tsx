'use client';
import Link from 'next/link';
import { trackAction } from '@/lib/analytics-client';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import {
  SlidersHorizontal,
  ArrowLeft,
  Briefcase,
  Check,
  Clock,
  FileText,
  MapPin,
  Send,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import type { PublicJob } from '@/lib/types';
import type { SearchFilters } from '@/lib/personal-space';
import { SearchFilterFields } from '../search-filter-fields';
import { FiltersSheet } from '../filters-sheet';
import { employmentLabels } from '../advanced-filters';
import { subcategoryFor } from '@/lib/subcategories';
import { CV_STORAGE_KEY, readCv, type Cv } from '@/lib/cv';
import { createResumeSync, savedResumeIdentity } from '@/lib/resume-client';
import { safeEmail } from '@/lib/application-contact';
import {
  readSwipeApplicant,
  readSwipeHistory,
  recordSwipeSent,
  writeSwipeApplicant,
  type SwipeApplicant,
  type SwipeSent,
  rememberSwipeFilters,
} from '@/lib/swipe-history';
import { readSearch, searchParams } from '@/lib/search-state';
import { vacancyContacts } from '@/lib/vacancy-details';
import { compactSalary } from '@/lib/vacancy-presentation';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { CompanyLogo } from '../company-logo';
import { Description } from '../vacancy-text';

/* One vacancy at a time over the board's own list and filters, and only the
   vacancies a CV can be mailed to: right always sends the CV from hr@jobx.ge
   to the vacancy's application address, left always skips (the board's
   "hide"). The full text opens inside the card, so nothing leaves the deck.
   Sending is held for a few seconds so a slip of the thumb can be taken back;
   when the hold runs out the letter leaves through /api/swipe/apply. */

type Decision = 'send' | 'skip' | 'sent';
type Done = { job: PublicJob; decision: Decision };
const noApplicant: SwipeApplicant = { name: '', email: '', phone: '' };
const holdSeconds = 8;
const consentKey = 'jobx-swipe-consent-v2';
const hintKey = 'jobx-swipe-hint-v1';
const keysKey = 'jobx-swipe-keys-v1';
const keysVisits = 3;
const maxUploadBytes = 4_000_000;
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
const throwAt = 110;
const exitDuration = 240;
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Some sources write markdown emphasis; the deck shows the words, not the stars.
const plain = (text: string) =>
  text.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*\*/g, '');
const applicationEmail = (job: PublicJob) =>
  vacancyContacts(job).emails[0]?.email ?? '';
function daysLeft(deadline: string) {
  if (!deadline) return null;
  const end = Date.parse(deadline + 'T23:59:59+04:00');
  return Number.isFinite(end) ? Math.ceil((end - Date.now()) / 86400000) : null;
}
const deadlineLabel = (deadline: string) => {
  const left = daysLeft(deadline);
  if (left === null || left < 0) return '';
  if (left === 0) return 'ბოლო დღე';
  if (left <= 3) return `${left} დღე დარჩა`;
  const [, month, day] = deadline.split('-').map(Number);
  return `ვადა ${day} ${months[month - 1]}`;
};

export function SwipeDeck() {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackAction('swipe_open');
  }, []);
  const router = useRouter();
  const params = useSearchParams();
  const filters = useMemo(
    () => readSearch(new URLSearchParams(params.toString())),
    [params],
  );
  const listQuery = searchParams(filters).toString();
  const requestKey = listQuery + '&from=' + (params.get('from') || '');
  const [loadedKey, setLoadedKey] = useState(requestKey);
  const generation = useRef(0);
  const [filterDraft, setFilterDraft] = useState<SearchFilters | null>(null);
  // The list's filters when the deck opened: Back returns to that address.
  const [entryQuery] = useState(listQuery);
  const updateFilters = (patch: Partial<SearchFilters>) => {
    trackAction('swipe_filter');
    const next = new URLSearchParams(params.toString());
    const changed = searchParams({ ...filters, ...patch });
    rememberSwipeFilters(window.sessionStorage, entryQuery, changed.toString());
    for (const key of new Set([
      ...searchParams(filters).keys(),
      ...changed.keys(),
    ]))
      next.delete(key);
    changed.forEach((value, key) => next.set(key, value));
    next.delete('from');
    next.delete('page');
    router.replace('/swipe' + (next.size ? '?' + next.toString() : ''), {
      scroll: false,
    });
  };
  const activeFilters: {
    key: string;
    label: string;
    clear: Partial<SearchFilters>;
  }[] = [];
  if (filters.query)
    activeFilters.push({
      key: 'query',
      label: filters.query,
      clear: { query: '' },
    });
  if (filters.city !== 'ყველა')
    activeFilters.push({
      key: 'city',
      label: filters.city,
      clear: { city: 'ყველა' },
    });
  if (filters.category !== 'ყველა')
    activeFilters.push({
      key: 'category',
      label: filters.category,
      clear: { category: 'ყველა', subcategory: undefined },
    });
  if (filters.subcategory)
    activeFilters.push({
      key: 'subcategory',
      label:
        subcategoryFor(filters.category, filters.subcategory)?.label ??
        filters.subcategory,
      clear: { subcategory: undefined },
    });
  if (filters.source !== 'ყველა')
    activeFilters.push({
      key: 'source',
      label: filters.source,
      clear: { source: 'ყველა' },
    });
  if (filters.paid)
    activeFilters.push({
      key: 'paid',
      label: 'ხელფასი მითითებულია',
      clear: { paid: false },
    });
  if (filters.remote)
    activeFilters.push({
      key: 'remote',
      label: 'დისტანციური',
      clear: { remote: false },
    });
  if (
    filters.salaryPeriod === 'day' ||
    filters.salaryFrom !== null ||
    filters.salaryTo !== null
  )
    activeFilters.push({
      key: 'salary',
      label:
        filters.salaryFrom === null && filters.salaryTo === null
          ? 'დღიური ანაზღაურება'
          : `${filters.salaryFrom !== null && filters.salaryTo !== null ? `${filters.salaryFrom}–${filters.salaryTo} ₾` : filters.salaryFrom !== null ? `${filters.salaryFrom} ₾-დან` : `${filters.salaryTo} ₾-მდე`} / ${filters.salaryPeriod === 'day' ? 'დღე' : 'თვე'}`,
      clear: { salaryPeriod: 'month', salaryFrom: null, salaryTo: null },
    });
  if (filters.employment !== 'all')
    activeFilters.push({
      key: 'employment',
      label: employmentLabels[filters.employment],
      clear: { employment: 'all' },
    });
  if (filters.entryLevel)
    activeFilters.push({
      key: 'entryLevel',
      label: 'გამოცდილების გარეშე',
      clear: { entryLevel: false },
    });
  if (filters.postedWithin)
    activeFilters.push({
      key: 'postedWithin',
      label:
        filters.postedWithin === 1
          ? 'დღეს'
          : `ბოლო ${filters.postedWithin} დღეში`,
      clear: { postedWithin: 0 },
    });
  if (filters.deep)
    activeFilters.push({
      key: 'deep',
      label: 'აღწერაშიც ძებნა',
      clear: { deep: false },
    });
  const backHref = '/' + (listQuery ? '?' + listQuery : '');

  const [started, setStarted] = useState(false);
  const [cv, setCv] = useState<Cv | null>(null);
  const [upload, setUpload] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [consent, setConsent] = useState(false);
  /* Browsing asks for nothing. The CV is asked for once, at the first send,
     in a sheet over the deck; the chip in the header reopens it. */
  const [askCv, setAskCv] = useState(false);
  const [hint, setHint] = useState(false);
  // The key legend appears for a moment on the first few visits, then gets out of the way.
  const [keys, setKeys] = useState(false);
  const [entering, setEntering] = useState<'left' | 'right' | 'next' | null>(
    null,
  );
  const flight = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissHint = useCallback(() => {
    setHint(false);
    try {
      localStorage.setItem(hintKey, '1');
    } catch {}
  }, []);
  const [applicant, setApplicant] = useState<SwipeApplicant>(noApplicant);
  const [sent, setSent] = useState<SwipeSent[]>([]);
  const sentIds = useRef(new Set<string>());
  const [sending, setSending] = useState<PublicJob | null>(null);

  const [queue, setQueue] = useState<PublicJob[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef(new Set<string>());
  const [history, setHistory] = useState<Done[]>([]);
  const [pending, setPending] = useState<{
    job: PublicJob;
    left: number;
  } | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    // Read after mount, like the board's other browser-held lists.
    const t = setTimeout(() => {
      try {
        const saved = readCv(window.localStorage);
        setCv(saved);
        const sentBefore = readSwipeHistory(window.localStorage);
        sentBefore.forEach((item) => sentIds.current.add(item.id));
        setSent(sentBefore);
        // The contact used last time, otherwise what the CV says.
        setApplicant(
          readSwipeApplicant(window.localStorage) ??
            (saved
              ? { name: saved.fullName, email: saved.email, phone: saved.phone }
              : noApplicant),
        );
        setConsent(!!localStorage.getItem(consentKey));
        setHint(!localStorage.getItem(hintKey) && !reducedMotion());
        const visits = Number(localStorage.getItem(keysKey)) || 0;
        if (visits < keysVisits) {
          localStorage.setItem(keysKey, String(visits + 1));
          setKeys(true);
        }
        setStarted(true);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  /* A CV made in another tab (the builder opens in one) attaches itself here:
     the deck and the card waiting to be sent stay where they were. */
  useEffect(() => {
    const read = (e: StorageEvent) => {
      if (e.key !== CV_STORAGE_KEY) return;
      try {
        const made = readCv(window.localStorage);
        if (!made) return;
        setCv(made);
        setApplicant((a) => ({
          name: a.name || made.fullName,
          email: a.email || made.email,
          phone: a.phone || made.phone,
        }));
      } catch {}
    };
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadedKey !== requestKey || loading || page >= pages) return;
    const version = generation.current;
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams(listQuery);
      p.set('page', String(page + 1));
      p.set('withEmail', '1');
      const from = page === 0 ? params.get('from') : null;
      const [response, first] = await Promise.all([
        fetch('/api/jobs?' + p),
        // The vacancy the reader opened this deck from comes first.
        from && /^[0-9a-f-]{36}$/.test(from)
          ? fetch('/api/jobs?ids=' + from)
              .then((r) => (r.ok ? r.json() : { jobs: [] }))
              .then((d: { jobs: PublicJob[] }) => d.jobs)
              .catch(() => [] as PublicJob[])
          : Promise.resolve([] as PublicJob[]),
      ]);
      if (!response.ok) throw Error();
      const body = (await response.json()) as {
        jobs: PublicJob[];
        total: number;
        pages: number;
      };
      if (version !== generation.current) return;
      const data = { ...body, jobs: [...first, ...body.jobs] };
      setTotal(data.total);
      setPages(data.pages);
      setPage(page + 1);
      // A vacancy this browser already sent to is not offered again.
      const fresh = data.jobs.filter(
        (j) =>
          !seen.current.has(j.id) &&
          !sentIds.current.has(j.id) &&
          !!applicationEmail(j),
      );
      fresh.forEach((j) => seen.current.add(j.id));
      setQueue((q) => [...q, ...fresh]);
    } catch {
      if (version === generation.current) setError('ვაკანსიები ვერ ჩაიტვირთა.');
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [loading, page, pages, listQuery, params, loadedKey, requestKey]);

  // The next page is asked for while half of this one is still ahead, so a
  // quick reader never reaches an empty deck between pages.
  useEffect(() => {
    if (!started || queue.length >= 15 || error) return;
    const t = setTimeout(() => void loadMore(), 0);
    return () => clearTimeout(t);
  }, [started, queue.length, error, loadMore]);

  /* The letter itself: JOBX's address to the vacancy's, the CV attached, the
     reader's address as Reply-To. A refusal puts the card back in front so a
     second throw can try again; "already sent" counts as sent. */
  const submit = useCallback(
    async (job: PublicJob) => {
      setSending(job);
      setNotice('');
      try {
        const body = new FormData();
        body.set('job', job.id);
        body.set('name', applicant.name.trim());
        body.set('email', applicant.email.trim());
        body.set('phone', applicant.phone.trim());
        if (upload) body.set('file', upload, upload.name);
        else if (cv) {
          body.set('cv', JSON.stringify(cv));
          const identity = savedResumeIdentity(window.localStorage);
          if (identity) body.set('resume', identity.id);
        }
        const response = await fetch('/api/swipe/apply', {
          method: 'POST',
          body,
        });
        const data = (await response.json().catch(() => ({}))) as {
          to?: string;
          error?: string;
        };
        if (!response.ok && response.status !== 409)
          throw Error(data.error || '');
        if (response.ok) trackAction('swipe_send');
        const to = data.to || applicationEmail(job);
        sentIds.current.add(job.id);
        setSent(
          recordSwipeSent(window.localStorage, {
            id: job.id,
            title: job.title,
            company: job.company,
            to,
            at: new Date().toISOString(),
          }),
        );
        setHistory((h) =>
          h.map((item) =>
            item.job.id === job.id && item.decision === 'send'
              ? { ...item, decision: 'sent' as Decision }
              : item,
          ),
        );
        setNotice(
          response.status === 409
            ? `ამ ვაკანსიაზე შენი CV უკვე გაგზავნილი იყო.`
            : `CV გაიგზავნა: ${job.company || job.title}` +
                (to !== applicationEmail(job)
                  ? ` (სატესტო მისამართი ${to})`
                  : ''),
        );
      } catch (e) {
        trackAction('swipe_failed');
        setNotice(
          (e instanceof Error && e.message) ||
            'წერილი ვერ გაიგზავნა — სცადე ხელახლა.',
        );
        setHistory((h) =>
          h.filter(
            (item) => !(item.job.id === job.id && item.decision === 'send'),
          ),
        );
        setQueue((q) => [job, ...q.filter((j) => j.id !== job.id)]);
      } finally {
        setSending(null);
      }
    },
    [applicant, cv, upload],
  );

  // The held send counts down; at zero the letter leaves for the employer.
  useEffect(() => {
    if (!pending) return;
    if (pending.left <= 0) {
      const t = setTimeout(() => {
        setPending(null);
        void submit(pending.job);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setPending((p) => (p ? { ...p, left: p.left - 1 } : p)),
      1000,
    );
    return () => clearTimeout(t);
  }, [pending, submit]);

  const current = queue[0];
  useEffect(() => {
    if (!keys) return;
    const t = setTimeout(() => setKeys(false), 4500);
    return () => clearTimeout(t);
  }, [keys]);
  // Any reading or interaction ends the demonstration, including during its delay.
  useEffect(() => {
    if (!hint) return;
    const events = [
      'pointerdown',
      'touchstart',
      'wheel',
      'scroll',
      'keydown',
      'click',
    ];
    events.forEach((event) =>
      document.addEventListener(event, dismissHint, {
        capture: true,
        passive: true,
      }),
    );
    return () =>
      events.forEach((event) =>
        document.removeEventListener(event, dismissHint, true),
      );
  }, [hint, dismissHint]);
  useEffect(() => {
    if (!hint || !current) return;
    // Mark the visit now, so leaving midway never replays the demonstration.
    try {
      localStorage.setItem(hintKey, '1');
    } catch {}
  }, [hint, current]);
  useEffect(
    () => () => {
      if (flight.current) clearTimeout(flight.current);
    },
    [],
  );
  const ready =
    consent &&
    (!!cv || !!upload) &&
    !!applicant.name.trim() &&
    !!safeEmail(applicant.email);
  const decide = useCallback(
    (decision: Decision) => {
      if (!current) return;
      setNotice('');
      dismissHint();
      // The first send asks for the CV; the card waits in front meanwhile.
      if (decision === 'send' && !ready) {
        setAskCv(true);
        return;
      }
      if (decision === 'skip') trackAction('swipe_skip');
      if (decision === 'send') {
        // A second throw while one is still held sends the first one now.
        if (pending) void submit(pending.job);
        setPending({ job: current, left: holdSeconds });
      }
      setEntering(reducedMotion() ? null : 'next');
      setHistory((h) => [...h, { job: current, decision }].slice(-20));
      setQueue((q) => q.slice(1));
    },
    [current, pending, submit, ready, dismissHint],
  );
  const undo = useCallback(() => {
    dismissHint();
    if (flight.current) return;
    const last = history.at(-1);
    if (!last) return;
    // A letter that has left cannot be taken back; neither can one in flight.
    if (last.decision === 'sent' || sending?.id === last.job.id) {
      setNotice(
        last.decision === 'sent'
          ? 'ეს CV უკვე გაიგზავნა — უკან ვეღარ დაბრუნდება.'
          : 'წერილი ახლა იგზავნება…',
      );
      return;
    }
    trackAction('swipe_undo');
    if (last.decision === 'send' && pending?.job.id === last.job.id)
      setPending(null);
    setEntering(
      reducedMotion() ? null : last.decision === 'skip' ? 'left' : 'right',
    );
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.job, ...q]);
    setNotice('');
  }, [history, pending, sending, dismissHint]);

  // Drag: the top card follows the pointer and is thrown past the threshold.
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    id: number;
    locked?: boolean;
  } | null>(null);
  useEffect(() => {
    if (loadedKey === requestKey) return;
    generation.current += 1;
    if (flight.current) clearTimeout(flight.current);
    flight.current = null;
    seen.current.clear();
    const timer = setTimeout(() => {
      setQueue([]);
      setPage(0);
      setPages(1);
      setTotal(null);
      setLoading(false);
      setError('');
      setHistory((items) =>
        items.filter((item) => item.job.id === pending?.job.id),
      );
      setDx(0);
      setLeaving(null);
      setEntering(null);
      setLoadedKey(requestKey);
    }, 0);
    return () => clearTimeout(timer);
  }, [requestKey, loadedKey, pending?.job.id]);

  const fling = useCallback(
    (side: 'left' | 'right', decision: Decision) => {
      dismissHint();
      if (!current || flight.current) return;
      setEntering(null);
      // The CV sheet keeps this card in place until sending is possible.
      if (reducedMotion() || (decision === 'send' && !ready)) {
        setDx(0);
        decide(decision);
        return;
      }
      setLeaving(side);
      flight.current = setTimeout(() => {
        flight.current = null;
        decide(decision);
        setLeaving(null);
        setDx(0);
      }, exitDuration);
    },
    [decide, dismissHint, current, ready],
  );
  const onDown = (e: PointerEvent<HTMLElement>) => {
    dismissHint();
    if (flight.current || (e.target as HTMLElement).closest('a,button')) return;
    setEntering(null);
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || flight.current) return;
    const mx = e.clientX - d.x,
      my = e.clientY - d.y;
    if (!d.locked) {
      if (Math.abs(mx) < 12 && Math.abs(my) < 12) return;
      // Only a clearly sideways move throws; anything steeper reads the text.
      if (Math.abs(mx) < Math.abs(my) * 1.5) {
        drag.current = null; // a vertical scroll of the card's text
        return;
      }
      d.locked = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    setDx(mx);
  };
  // Once a finger is throwing the card sideways, iOS must not also scroll
  // the text up and down under it.
  useEffect(() => {
    const hold = (e: TouchEvent) => {
      if (drag.current?.locked && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', hold, { passive: false });
    return () => document.removeEventListener('touchmove', hold);
  }, []);
  /* A trackpad's sideways two-finger scroll moves the card the way a finger
     does on a phone; an up-down scroll still reads the text. The card snaps
     back when the gesture stops short of the throw. */
  const wheel = useRef({
    vertical: 0,
    x: 0,
    timer: 0 as unknown as ReturnType<typeof setTimeout>,
  });
  const onWheel = (e: WheelEvent<HTMLElement>) => {
    dismissHint();
    const w = wheel.current;
    const now = performance.now();
    // While the text is being scrolled, the small sideways drift a trackpad
    // reports along with it must not nudge the card.
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      w.vertical = now;
      return;
    }
    if (
      leaving ||
      now - w.vertical < 350 ||
      Math.abs(e.deltaX) < 2 * Math.abs(e.deltaY) ||
      Math.abs(e.deltaX) < 3
    )
      return;
    clearTimeout(w.timer);
    w.x -= e.deltaX;
    if (Math.abs(w.x) > throwAt) {
      const side = w.x > 0 ? 'right' : 'left';
      w.x = 0;
      fling(side, side === 'right' ? 'send' : 'skip');
      return;
    }
    setDx(w.x);
    w.timer = setTimeout(() => {
      w.x = 0;
      setDx(0);
    }, 180);
  };
  const onUp = () => {
    if (!drag.current?.locked) {
      drag.current = null;
      return;
    }
    drag.current = null;
    if (dx > throwAt) fling('right', 'send');
    else if (dx < -throwAt) fling('left', 'skip');
    else setDx(0);
  };

  useEffect(() => {
    if (!started) return;
    const key = (e: KeyboardEvent) => {
      if (
        askCv ||
        filterDraft !== null ||
        (e.target instanceof Element &&
          e.target.closest(
            'input, textarea, [role=combobox], [role=listbox], [role=option], [contenteditable=true]',
          ))
      )
        return;
      if (e.key === 'ArrowRight') fling('right', 'send');
      if (e.key === 'ArrowLeft') fling('left', 'skip');
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') undo();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [started, fling, undo, askCv, filterDraft]);

  const sentCount = history.filter((h) => h.decision === 'sent').length;
  const remaining = total === null ? 0 : Math.max(0, total - history.length);
  const field =
    (key: keyof SwipeApplicant) => (e: ChangeEvent<HTMLInputElement>) =>
      setApplicant((a) => ({ ...a, [key]: e.target.value }));
  const sentDate = (at: string) => {
    const date = new Date(at);
    return Number.isNaN(date.getTime())
      ? ''
      : `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const attach = askCv ? (
    <dialog open className="swipe-attach" aria-label="CV-ის მიმაგრება">
      <div className="swipe-attach-top">
        <div>
          <h2>მიამაგრე CV და გააგზავნე</h2>
          <p>
            ერთხელ — შემდეგ ყოველი მარჯვნივ გადაწევა CV-ს hr@jobx.ge-დან
            გაუგზავნის კომპანიას, პასუხი კი შენს ელფოსტაზე მოვა.
          </p>
        </div>
        <button
          type="button"
          className="swipe-icon-btn"
          onClick={() => setAskCv(false)}
          aria-label="დახურვა"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="swipe-attach-body">
        {cv && !upload ? (
          <div className="swipe-cv swipe-cv-chosen">
            <FileText size={20} aria-hidden="true" />
            <div>
              <b>{cv.fullName || 'ჩემი CV'}</b>
              <span>JOBX-ზე შექმნილი{cv.title ? ' · ' + cv.title : ''}</span>
            </div>
          </div>
        ) : upload ? (
          <div className="swipe-cv swipe-cv-chosen">
            <FileText size={20} aria-hidden="true" />
            <div>
              <b>{upload.name}</b>
              <span>ატვირთული PDF</span>
            </div>
          </div>
        ) : (
          <Link className="swipe-cv" href="/cv" target="_blank" rel="noopener">
            <FileText size={20} aria-hidden="true" />
            <div>
              <b>CV ჯერ არ გაქვს</b>
              <span>
                შექმენი JOBX-ზე — 3 წუთი; ახალ ჩანართში გაიხსნება და აქ თავისით
                მიემაგრება
              </span>
            </div>
          </Link>
        )}
        <label className="swipe-upload">
          <Upload size={16} aria-hidden="true" />
          {upload ? 'სხვა ფაილის არჩევა' : 'CV-ის ატვირთვა (PDF)'}
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              const pdf =
                !!file &&
                (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
              setUploadError(
                !file
                  ? ''
                  : !pdf
                    ? 'მხოლოდ PDF ფაილი მიიღება.'
                    : file.size > maxUploadBytes
                      ? 'PDF 4 მბ-ზე დიდია — უფრო პატარა ფაილი ატვირთე.'
                      : '',
              );
              setUpload(
                file && pdf && file.size <= maxUploadBytes ? file : null,
              );
            }}
          />
        </label>
        {uploadError && <p className="swipe-field-error">{uploadError}</p>}
        <div className="swipe-fields">
          <label>
            <span>სახელი და გვარი</span>
            <input
              value={applicant.name}
              onChange={field('name')}
              autoComplete="name"
              maxLength={120}
              placeholder="ნინო ბერიძე"
            />
          </label>
          <label>
            <span>ელფოსტა პასუხისთვის</span>
            <input
              type="email"
              inputMode="email"
              value={applicant.email}
              onChange={field('email')}
              autoComplete="email"
              maxLength={254}
              placeholder="nino@example.com"
            />
          </label>
          <label>
            <span>ტელეფონი</span>
            <input
              type="tel"
              inputMode="tel"
              value={applicant.phone}
              onChange={field('phone')}
              autoComplete="tel"
              maxLength={32}
              placeholder="+995 555 12 34 56"
            />
          </label>
        </div>
        <label className="swipe-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            ვეთანხმები, რომ JOBX ჩემი სახელით, hr@jobx.ge-დან, გაუგზავნის ჩემს
            CV-ს და ზემოთ მითითებულ კონტაქტს იმ კომპანიებს, რომლებზეც მარჯვნივ
            გადავწევ. კომპანიის პასუხი ჩემს ელფოსტაზე მოვა. CV ინახება JOBX-ზე,
            რომ გაგზავნის ისტორია შენარჩუნდეს.
            {cv && !upload
              ? ' JOBX-ზე შექმნილი CV-ის ასლი JOBX-ზე 12 თვემდე ინახება.'
              : ''}
          </span>
        </label>
        <button
          className="swipe-start"
          disabled={!ready}
          onClick={() => {
            trackAction(upload ? 'swipe_cv_upload' : 'swipe_cv_jobx');
            try {
              localStorage.setItem(consentKey, new Date().toISOString());
              writeSwipeApplicant(window.localStorage, {
                name: applicant.name.trim(),
                email: applicant.email.trim(),
                phone: applicant.phone.trim(),
              });
              // A JOBX-built CV keeps its copy here, the same way a PDF press does.
              if (cv && !upload)
                void createResumeSync(window.localStorage).save(cv);
            } catch {}
            setAskCv(false);
            // The card that asked for the CV leaves now.
            if (current) decide('send');
          }}
        >
          {current ? 'მიამაგრე და გააგზავნე' : 'შენახვა'}{' '}
          <Send size={16} aria-hidden="true" />
        </button>
        {sent.length > 0 && (
          <section className="swipe-sent" aria-label="გაგზავნილი CV">
            <h2>
              <Check size={16} aria-hidden="true" /> გაგზავნილი — {sent.length}
            </h2>
            <ul>
              {sent.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link href={vacancyPath(item)} target="_blank">
                    {item.title}
                  </Link>
                  <span>
                    {[item.company, sentDate(item.at)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </dialog>
  ) : null;

  if (!started) return <output className="swipe-hint">იტვირთება…</output>;

  return (
    <main className="swipe-main">
      <header className="swipe-top">
        <Link
          className="swipe-icon-btn"
          href={backHref}
          aria-label="სიაში დაბრუნება"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className="swipe-heading">
          <h1>Swipe</h1>
          <small>
            {total === null
              ? 'იტვირთება…'
              : `გაგზავნილია ${sentCount} · დარჩა ${remaining}`}
          </small>
        </div>
        <button
          type="button"
          className="mobile-filter-toggle secondary-button swipe-filter-toggle"
          aria-label={`ფილტრები${activeFilters.length ? ` — ${activeFilters.length} აქტიური` : ''}`}
          aria-haspopup="dialog"
          onClick={() => setFilterDraft(filters)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span className="results-tool-label" aria-hidden="true">
            ფილტრები
          </span>
          {activeFilters.length > 0 && (
            <b aria-hidden="true">{activeFilters.length}</b>
          )}
        </button>
        <button
          type="button"
          className="swipe-cv-chip"
          aria-label={ready ? 'CV-ის ნახვა' : 'მიამაგრე CV'}
          data-ready={ready || undefined}
          onClick={() => setAskCv(true)}
        >
          {ready ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <FileText size={16} aria-hidden="true" />
          )}
          <span className="swipe-cv-label">
            {!ready && <span>მიამაგრე </span>}CV
          </span>
        </button>
      </header>

      {activeFilters.length > 0 && (
        <div
          className="active-filters swipe-active-filters"
          aria-label="აქტიური ფილტრები"
        >
          {activeFilters.map((filter) => (
            <button
              type="button"
              className="ds-chip"
              data-active="true"
              key={filter.key}
              aria-label={`${filter.label} — წაშლა`}
              onClick={() => updateFilters(filter.clear)}
            >
              {filter.label}
              <X size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <FiltersSheet
        open={filterDraft !== null}
        onOpenChange={(open) => {
          if (!open) setFilterDraft(null);
        }}
        value={filterDraft ?? filters}
        onChange={setFilterDraft}
        onApply={() => {
          if (filterDraft) updateFilters(filterDraft);
          setFilterDraft(null);
        }}
        withEmail
        className="swipe-filters-sheet"
      >
        <label className="swipe-filter-search">
          <span>ძებნა</span>
          <input
            type="search"
            maxLength={200}
            placeholder="პოზიცია ან კომპანია"
            value={(filterDraft ?? filters).query}
            onChange={(event) =>
              setFilterDraft({
                ...(filterDraft ?? filters),
                query: event.target.value,
              })
            }
          />
        </label>
        <SearchFilterFields
          value={filterDraft ?? filters}
          onChange={setFilterDraft}
          prefix="swipe"
          mobile
        />
      </FiltersSheet>

      <div className="swipe-stage">
        <div className="swipe-deck">
          {queue
            .slice(1, 3)
            .reverse()
            .map((job, i, list) => (
              <div
                key={job.id}
                className={`quick-card quick-card-behind swipe-depth-${list.length - i}`}
                aria-hidden="true"
              />
            ))}
          {current ? (
            <article
              key={current.id}
              className="quick-card"
              data-hint={hint || undefined}
              data-entering={entering || undefined}
              onAnimationEnd={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.animationName === 'swipe-card-nudge') dismissHint();
                else setEntering(null);
              }}
              data-leaving={leaving || undefined}
              data-dragging={dx !== 0 || undefined}
              style={
                {
                  '--dx': `${dx}px`,
                  '--tilt': `${Math.max(-12, Math.min(12, dx / 18))}deg`,
                } as CSSProperties
              }
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => {
                drag.current = null;
                setDx(0);
              }}
              onWheel={onWheel}
            >
              <div className="swipe-stamp-slot" aria-hidden="true">
                <span
                  className="swipe-stamp swipe-stamp-right"
                  style={{ opacity: Math.max(0, Math.min(1, dx / throwAt)) }}
                  aria-hidden="true"
                >
                  <Send size={16} /> გაიგზავნება
                </span>
                <span
                  className="swipe-stamp swipe-stamp-left"
                  style={{ opacity: Math.max(0, Math.min(1, -dx / throwAt)) }}
                  aria-hidden="true"
                >
                  <X size={16} /> გამოტოვება
                </span>
              </div>
              {/* The whole posting, read by scrolling the card itself; a vertical
                move scrolls, only a sideways one throws the card. */}
              <div className="quick-card-scroll">
                <div className="swipe-company">
                  <CompanyLogo
                    company={current.company}
                    url={current.logoUrl}
                    large
                  />
                  <div>
                    <b>{current.company || 'კერძო განცხადება'}</b>
                    {current.category && <span>{current.category}</span>}
                  </div>
                </div>
                <h2>{current.title}</h2>
                {compactSalary(current.salary, current.salaryPeriod) && (
                  <p className="swipe-pay">
                    {compactSalary(current.salary, current.salaryPeriod)}
                  </p>
                )}
                <div className="swipe-chips">
                  {current.city && (
                    <span>
                      <MapPin size={14} aria-hidden="true" />
                      {current.city}
                    </span>
                  )}
                  {current.employmentType && (
                    <span>
                      <Briefcase size={14} aria-hidden="true" />
                      {current.employmentType}
                    </span>
                  )}
                  {deadlineLabel(current.deadline) && (
                    <span
                      data-urgent={
                        (daysLeft(current.deadline) ?? 9) <= 3 || undefined
                      }
                    >
                      <Clock size={14} aria-hidden="true" />
                      {deadlineLabel(current.deadline)}
                    </span>
                  )}
                </div>
                <div className="swipe-card-text">
                  <Description
                    text={plain(current.description)}
                    links={current.applicationLinks}
                  />
                </div>
              </div>
            </article>
          ) : (
            <div className="swipe-empty">
              {error ? (
                <>
                  <p>{error}</p>
                  <button
                    className="swipe-start"
                    onClick={() => void loadMore()}
                  >
                    ხელახლა ცდა
                  </button>
                </>
              ) : loading || total === null ? (
                <p>ვაკანსიები იტვირთება…</p>
              ) : (
                <>
                  <p>ამ ფილტრებით ყველა ვაკანსია ნახე.</p>
                  <Link className="swipe-start" href={backHref}>
                    სიაში დაბრუნება
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {(pending || sending || notice) && (
          <output className="swipe-toast">
            {pending ? (
              <>
                <span className="swipe-ring">{pending.left}</span>
                <div>
                  <b>
                    CV გაიგზავნება: {pending.job.company || pending.job.title}
                  </b>
                  <span>hr@jobx.ge → {applicationEmail(pending.job)}</span>
                </div>
                <button onClick={undo}>გაუქმება</button>
              </>
            ) : sending ? (
              <>
                <span className="swipe-ring swipe-ring-spin" />
                <div>
                  <b>იგზავნება: {sending.company || sending.title}</b>
                  <span>hr@jobx.ge → {applicationEmail(sending)}</span>
                </div>
              </>
            ) : (
              <div>
                <span>{notice}</span>
              </div>
            )}
          </output>
        )}

        <div className="swipe-actions">
          <button
            aria-label="გამოტოვება"
            onClick={() => fling('left', 'skip')}
            disabled={!current}
          >
            <span className="swipe-act swipe-act-skip">
              <X size={26} aria-hidden="true" />
            </span>
          </button>
          <button
            aria-label="უკან"
            onClick={undo}
            disabled={!history.length || history.at(-1)?.decision === 'sent'}
          >
            <span className="swipe-act swipe-act-sm">
              <Undo2 size={20} aria-hidden="true" />
            </span>
          </button>
          <button
            aria-label="CV-ის გაგზავნა"
            onClick={() => fling('right', 'send')}
            disabled={!current}
          >
            <span className="swipe-act swipe-act-send">
              <Send size={26} aria-hidden="true" />
            </span>
          </button>
        </div>
        <p
          className="swipe-keys"
          aria-hidden="true"
          data-show={keys || undefined}
        >
          <kbd>←</kbd> გამოტოვება · <kbd>→</kbd> გაგზავნა · <kbd>Ctrl</kbd>+
          <kbd>Z</kbd> უკან
        </p>
      </div>
      {attach}
    </main>
  );
}
