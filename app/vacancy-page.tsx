'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { salaryDetails } from '@/lib/salary-summary';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Mail,
  Phone,
  Send,
  ChevronDown,
  ChevronLeft,
  CalendarDays,
  Share2,
  Clock3,
  Globe2,
  Check,
  X,
} from 'lucide-react';
import { PublicHeader } from './public-header';
import { CompanyIdentity } from './company-identity';
import { Description, SourceStatus, formatDate } from './vacancy-text';
import { QuickApply, TranslationHelp } from './quick-apply';
import {
  vacancyContacts,
  workSchedule,
  applicationDestination,
  defaultApplicationBody,
} from '@/lib/vacancy-details';
import { emailDraft } from '@/lib/application-contact';
import {
  canStepBack,
  planListReturn,
  resolveReturnPath,
  vacancyPath,
} from '@/lib/vacancy-navigation';
import { shareLink } from '@/lib/share';
import { track, trackAction, trackContact } from '@/lib/analytics-client';
import type { PublicJob } from '@/lib/types';
import { vacancySummary } from '@/lib/vacancy-summary';
import {
  compactSalary,
  compactSchedule,
  factAlreadyVisible,
} from '@/lib/vacancy-presentation';
import { explicitWorkCity } from '@/lib/work-location';
import { vacancyLinks } from '@/lib/vacancy-links';
import { useVacancyActivity } from './use-vacancy-activity';
import { SimilarVacancies } from './similar-vacancies';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import './search-features.css';

/* Whole days from today's local midnight to the deadline's; negative once it has passed. */
function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
function ApplyAction({ job }: { job: PublicJob }) {
  const contacts = vacancyContacts(job);
  const emails = contacts.emails.filter((c) => c.application);
  const external = applicationDestination(job);
  if (contacts.phones.length === 1 && contacts.emails.length === 1)
    return (
      <>
        <a
          className="secondary-button"
          href={`tel:${contacts.phones[0].number}`}
          onClick={() => trackContact('call', job)}
        >
          <Phone aria-hidden="true" />
          დარეკვა
        </a>
        <a
          className="primary"
          onClick={() => trackContact('cv', job)}
          href={emailDraft(
            contacts.emails[0].email,
            job.title,
            contacts.emails[0].application
              ? defaultApplicationBody
              : 'გამარჯობა,\n\nთქვენს ვაკანსიასთან დაკავშირებით მაქვს კითხვა.',
          )}
        >
          <Mail aria-hidden="true" />
          {contacts.emails[0].application ? 'CV-ის გაგზავნა' : 'წერილის გახსნა'}
        </a>
      </>
    );
  if (emails.length === 1)
    return (
      <a
        className="primary"
        href={emailDraft(emails[0].email, job.title, defaultApplicationBody)}
        onClick={() => trackContact('cv', job)}
      >
        <Mail aria-hidden="true" />
        CV-ის გაგზავნა მეილით
      </a>
    );
  if (external)
    return (
      <a
        className="primary"
        href={external.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackContact('apply', job)}
      >
        <Send aria-hidden="true" />
        განაცხადი კომპანიის საიტზე
      </a>
    );
  if (!contacts.emails.length && contacts.phones.length === 1)
    return (
      <a
        className="primary"
        href={`tel:${contacts.phones[0].number}`}
        onClick={() => trackContact('call', job)}
      >
        <Phone aria-hidden="true" />
        დარეკვა
      </a>
    );
  if (contacts.emails.length || contacts.phones.length)
    return (
      <button
        className="primary"
        onClick={() => {
          document
            .getElementById('vacancy-contacts')
            ?.scrollIntoView({ block: 'start' });
          document
            .getElementById('vacancy-contacts')
            ?.focus({ preventScroll: true });
        }}
      >
        კონტაქტების ნახვა
      </button>
    );
  return null;
}
function JobReportForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const success = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    if (!sent) return;
    success.current?.focus();
    success.current?.scrollIntoView({ block: 'center' });
  }, [sent]);
  return (
    <div className="job-report">
      {!sent && (
        <button
          type="button"
          className="secondary-button"
          aria-expanded={open}
          aria-controls="job-report-form"
          disabled={busy}
          onClick={() => {
            if (!open) trackAction('report_open');
            setOpen((value) => !value);
          }}
        >
          შეცდომის შეტყობინება
        </button>
      )}
      {open && !sent && (
        <form
          id="job-report-form"
          aria-label="ვაკანსიის პრობლემის შეტყობინება"
          className="job-report-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              const response = await fetch(`/api/jobs/${jobId}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, note }),
              });
              const body = await response.json();
              if (!response.ok)
                throw Error(
                  body.error || 'გაგზავნა ვერ მოხერხდა. სცადე ხელახლა.',
                );
              setSent(true);
              trackAction('report_sent');
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'გაგზავნა ვერ მოხერხდა.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="job-report-reasons">
            <legend id="job-report-reason-label">რა პრობლემაა?</legend>
            <RadioGroup
              aria-labelledby="job-report-reason-label"
              value={reason}
              disabled={busy}
              onValueChange={(value) => setReason(String(value))}
            >
              {[
                ['expired', 'ვადაგასულია'],
                ['wrong', 'არასწორი ინფორმაცია'],
                ['duplicate', 'დუბლიკატია'],
                ['other', 'სხვა'],
              ].map(([value, label]) => (
                <label key={value} className="job-report-reason">
                  <RadioGroupItem value={value} />
                  {label}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <label htmlFor="job-report-note">შენიშვნა (არასავალდებულო)</label>
          <textarea
            id="job-report-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
            maxLength={300}
            rows={3}
            aria-describedby="job-report-note-hint"
            className="ds-input job-report-note"
          />
          <small id="job-report-note-hint">
            {note.length}/300 · პირად მონაცემებს ნუ მიუთითებ.
          </small>
          {error && <p role="alert">{error}</p>}
          <button
            className="primary job-report-submit"
            type="submit"
            disabled={busy || !reason}
          >
            {busy && <span className="ds-spinner" aria-hidden="true" />}
            {busy ? 'იგზავნება' : 'გაგზავნა'}
          </button>
        </form>
      )}
      <output ref={success} tabIndex={-1} className="job-report-done">
        {sent ? 'მადლობა — გადავამოწმებთ.' : ''}
      </output>
    </div>
  );
}

export default function VacancyPage({
  job,
  preview,
  returnTo: initialReturnTo,
  companyPath = null,
  footer,
}: {
  job: PublicJob;
  preview: boolean;
  returnTo: string;
  /** The employer's own page, when it has one. */
  companyPath?: string | null;
  footer?: ReactNode;
}) {
  const activity = useVacancyActivity();
  const { markSeen } = activity;
  /* Long enough that a tap taken back is not a visit, short enough that anyone
     who meant to read this has already been counted. */
  useEffect(() => {
    if (preview) return;
    const timer = setTimeout(
      () => markSeen(job.id, { title: job.title, company: job.company }),
      2500,
    );
    return () => clearTimeout(timer);
  }, [job.id, job.title, job.company, preview, markSeen]);
  /* One view per vacancy per page load; the ref keeps a re-run of the effect from counting twice. */
  const viewed = useRef('');
  useEffect(() => {
    if (preview || viewed.current === job.id) return;
    viewed.current = job.id;
    track('view', job.id);
  }, [job.id, preview]);
  /* Where "back to the list" should lead. A vacancy the list opened is one step
     above it, so stepping back returns the reader to the page they left, with
     its scroll and its loaded pages, and leaves the history no longer than it
     was. The flag lives in this history entry, so it survives going back and
     forward again; a vacancy opened from a search engine or a shared link has
     no step to go back to and keeps the plain link. */
  const router = useRouter();
  const [returnTo, setReturnTo] = useState(initialReturnTo);
  const steppedFromList = useRef(false);
  useEffect(() => {
    const path = resolveReturnPath(initialReturnTo);
    steppedFromList.current = planListReturn(path);
    const frame = requestAnimationFrame(() => setReturnTo(path));
    return () => cancelAnimationFrame(frame);
  }, [job.id, initialReturnTo]);
  const leftFor = useRef(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    const read = () => {
      try {
        const value = JSON.parse(localStorage.getItem('ertad-saved') || '[]');
        setSaved(
          Array.isArray(value)
            ? value
                .filter(
                  (id: unknown) =>
                    typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id),
                )
                .slice(0, 100)
            : [],
        );
      } catch {}
      setReady(true);
    };
    const timer = setTimeout(read, 0);
    window.addEventListener('storage', read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', read);
    };
  }, []);
  function toggleSave() {
    const wasSaved = saved.includes(job.id);
    const next = wasSaved
      ? saved.filter((id) => id !== job.id)
      : [...saved, job.id].slice(-100);
    try {
      localStorage.setItem('ertad-saved', JSON.stringify(next));
      setSaved(next);
      // The board counts a save the same way; a vacancy page used to save it uncounted.
      if (preview) return;
      if (wasSaved) trackAction('unsave');
      else track('save', job.id);
    } catch {
      setFeedback('ბრაუზერმა შენახვა ვერ შეძლო.');
    }
  }
  async function share() {
    const outcome = await shareLink(
      window.location.origin + vacancyPath(job),
      `${job.title} — ${job.company}`,
      [job.city, compactSalary(job.salary, job.salaryPeriod)]
        .filter(Boolean)
        .join(' · ') || undefined,
    );
    if (!preview)
      trackAction(
        outcome === 'shared'
          ? 'share_native'
          : outcome === 'copied'
            ? 'share_copy'
            : 'share_failed',
      );
    setFeedback(
      outcome === 'shared'
        ? 'ვაკანსია გაზიარებულია'
        : outcome === 'copied'
          ? 'ვაკანსიის ბმული დაკოპირებულია'
          : 'ბმულის კოპირება ვერ მოხერხდა.',
    );
  }
  const schedule = workSchedule(job);
  const facts = [
    ['ანაზღაურება', compactSalary(job.salary, job.salaryPeriod)],
    ['ქალაქი', job.city || explicitWorkCity(job)],
    ['განაკვეთი', job.employmentType],
    ['სამუშაო რეჟიმი', job.mode],
    ['სამუშაო გრაფიკი', schedule.map(compactSchedule).join(' · ')],
  ].filter(([, value]) => value?.trim());
  const summary = vacancySummary(job);
  // One extracted detail belongs with the existing facts, not in its own summary panel.
  if (summary.length === 1) {
    const item = summary[0];
    const existing = facts.find(([, value]) =>
      factAlreadyVisible(item.value, '', [value || '']),
    );
    if (!existing) facts.push([item.label, item.value]);
    else if (existing[0] === 'ქალაქი' && item.label === 'მისამართი')
      existing[0] = 'მისამართი';
  }
  const links = vacancyLinks(job);
  const marker = 'სრული ინფორმაცია დამსაქმებლისგან:';
  const split = job.fullTextUrl ? job.description.indexOf(marker) : -1;
  const sourceExcerpt =
    split >= 0 ? job.description.slice(0, split).trim() : '';
  const description =
    split >= 0
      ? job.description.slice(split + marker.length).trim()
      : job.description;
  const extraFacts = (job.facts || []).filter(
    (f) =>
      !factAlreadyVisible(f.value, job.description, [
        ...facts.map(([, v]) => v || ''),
        ...summary.map((s) => s.value),
      ]),
  );
  const payConditions = salaryDetails(job.salary, job.salaryPeriod);
  if (
    payConditions &&
    !factAlreadyVisible(
      payConditions,
      job.description,
      extraFacts.map((f) => f.value),
    )
  )
    extraFacts.push({ label: 'ანაზღაურების პირობები', value: payConditions });
  if (
    extraFacts.length === 1 &&
    /კატეგორია|category/i.test(extraFacts[0].label)
  ) {
    facts.push([extraFacts[0].label, extraFacts[0].value]);
    extraFacts.length = 0;
  }
  const contacts = vacancyContacts(job);
  // The contact column already offers these; listing them again below reads as a second box.
  const contactValues = [
    ...contacts.emails.map((c) => c.email),
    ...contacts.phones.flatMap((c) => [c.number, c.display]),
  ];
  for (let i = extraFacts.length - 1; i >= 0; i--)
    if (contactValues.some((v) => v && extraFacts[i].value.includes(v)))
      extraFacts.splice(i, 1);
  const hasContact = Boolean(contacts.emails.length || contacts.phones.length);
  const hasAction = hasContact || Boolean(applicationDestination(job));
  /* Where applying happens is where a missing resume is noticed. */
  const cvHint = (
    <p className="vacancy-cv-hint">
      CV არ გაქვს?{' '}
      <Link href="/cv" prefetch={false}>
        შექმენი უფასოდ
      </Link>
    </p>
  );
  const hasDescriptionContent = Boolean(
    description.trim() ||
    sourceExcerpt ||
    links.some((link) => !link.application) ||
    extraFacts.length ||
    job.companyProfile?.website ||
    job.companyProfile?.description,
  );
  function recordContactOpen(event: MouseEvent<HTMLDivElement>) {
    if (preview || !(event.target instanceof Element)) return;
    const href = event.target.closest('a')?.getAttribute('href');
    /* Where a reader goes next inside the site, from any of the page's links to it. Going
       back to the company the reader came from is a return, not a new visit. */
    if (
      href?.startsWith('/companies/') &&
      !event.target.closest('.vacancy-breadcrumb')
    )
      trackAction('company_open');
    else if (href === '/cv') trackAction('cv_hint');
    /* Leaving for the employer — a mail, a call, the application form or the original posting —
       is the nearest sign of an application the site can see. Counted once per page load. */
    if (
      href &&
      !leftFor.current &&
      (/^(?:mailto:|tel:)/i.test(href) ||
        (/^https?:/i.test(href) &&
          new URL(href).origin !== window.location.origin))
    ) {
      leftFor.current = true;
      track('outbound', job.id);
    }
  }
  const returnLabel = returnTo.startsWith('/companies/')
    ? 'კომპანიაზე დაბრუნება'
    : new URLSearchParams(returnTo.split('?')[1] || '').get('saved') === '1'
      ? 'შენახულებში დაბრუნება'
      : // A reader who arrived from a search engine has no results to return to.
        returnTo === '/'
        ? 'ყველა ვაკანსია'
        : 'შედეგებზე დაბრუნება';
  return (
    <div
      onClickCapture={recordContactOpen}
      onAuxClickCapture={(event) => {
        if (event.button === 1) recordContactOpen(event);
      }}
      className="board-shell vacancy-page has-contact"
    >
      <PublicHeader savedCount={saved.length} />
      <main className="vacancy-page-main">
        {preview && (
          <p className="vacancy-preview">
            ადმინის წინასწარი ნახვა — გამოუქვეყნებელი მონაცემები
          </p>
        )}
        <nav className="vacancy-breadcrumb" aria-label="გვერდის მდებარეობა">
          <Link
            href={returnTo}
            prefetch={false}
            onClick={(event) => {
              if (!steppedFromList.current || !canStepBack()) return;
              event.preventDefault();
              router.back();
            }}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {returnLabel}
          </Link>
          {job.category !== 'სხვა' && (
            <>
              <span aria-hidden="true">/</span>
              <span>{job.category}</span>
            </>
          )}
        </nav>
        <article className="vacancy-layout">
          <section className="vacancy-overview" aria-labelledby="vacancy-title">
            <div className="detail-company">
              <CompanyIdentity
                company={job.company}
                logoUrl={job.logoUrl}
                category={job.category}
                href={companyPath}
                large
              />
            </div>
            {job.category !== 'სხვა' && (
              <span className="category-tag">{job.category}</span>
            )}
            {job.placement && (
              <span
                className={`placement-badge placement-badge-${job.placement.tier}`}
              >
                {job.placement.tier === 'premium' ? 'პრემიუმი' : 'VIP'}
              </span>
            )}
            <h1 id="vacancy-title" className="detail-title">
              {job.title}
            </h1>
            <div className="vacancy-title-tools">
              <div className="detail-dates">
                {job.datePosted && (
                  <span>
                    <CalendarDays aria-hidden="true" />
                    გამოქვეყნდა {formatDate(job.datePosted)}
                  </span>
                )}
                {job.deadline &&
                  (() => {
                    const left = daysUntil(job.deadline);
                    const urgent = left >= 0 && left <= 3;
                    return (
                      <span className={urgent ? 'deadline-urgent' : undefined}>
                        <Clock3 aria-hidden="true" />
                        ბოლო ვადა: {formatDate(job.deadline)}
                        {urgent && ' · იწურება'}
                      </span>
                    );
                  })()}
              </div>
              <div className="vacancy-tools">
                <button
                  className={`secondary-button ${saved.includes(job.id) ? 'is-saved' : ''}`}
                  disabled={!ready}
                  aria-pressed={saved.includes(job.id)}
                  onClick={toggleSave}
                >
                  <Bookmark size={16} />
                  {saved.includes(job.id) ? 'შენახულია' : 'შენახვა'}
                </button>
                {!preview && (
                  <button
                    className="secondary-button"
                    onClick={() => void share()}
                  >
                    <Share2 size={16} />
                    გაზიარება
                  </button>
                )}
              </div>
            </div>
            {facts.length > 0 && (
              <dl
                className={`detail-facts ${facts.filter(([label]) => label !== 'სამუშაო გრაფიკი').length < 2 ? 'single-fact-column' : ''}`}
              >
                {facts.map(([label, value]) => (
                  <div
                    key={label}
                    className={
                      label === 'სამუშაო გრაფიკი' || label === 'მისამართი'
                        ? 'schedule-fact'
                        : label === 'ანაზღაურება' && job.salary
                          ? 'salary-fact'
                          : undefined
                    }
                  >
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {summary.length > 1 && (
              <section
                className="vacancy-summary"
                aria-labelledby="summary-title"
              >
                <h2 id="summary-title">პირობები მოკლედ</h2>
                <dl>
                  {summary.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className={
                        item.label.includes('დასაზუსტებელია')
                          ? 'summary-conflict'
                          : undefined
                      }
                    >
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p>ამონარიდები განცხადებიდან — სრული პირობები აღწერაშია.</p>
              </section>
            )}
          </section>
          {!hasAction && (
            <aside
              className="vacancy-contact vacancy-contact-fallback"
              aria-label="დამსაქმებელთან დაკავშირება"
            >
              {/* Without an email, phone or form, the way to apply sits where those would be. */}
              <div className="vacancy-contact-guidance">
                <h3>დაუკავშირდი დამსაქმებელს</h3>
                <a
                  className="primary"
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Send aria-hidden="true" />
                  განაცხადის გაგზავნა
                </a>
                <p>გაიხსნება ორიგინალი განცხადება.</p>
                {cvHint}
              </div>
            </aside>
          )}
          {hasAction && (
            <aside
              className="vacancy-contact"
              aria-label="დამსაქმებელთან დაკავშირება"
            >
              <QuickApply job={job}>{cvHint}</QuickApply>
            </aside>
          )}
          {hasDescriptionContent && (
            <section className="vacancy-description-panel">
              {description.trim() && (
                <>
                  <h2 className="description-heading">სრული აღწერა</h2>
                  <Description text={description} links={links} />
                </>
              )}
              {sourceExcerpt && (
                <section className="vacancy-source-excerpt">
                  <h3>განცხადების შესავალი პირველწყაროდან</h3>
                  <Description text={sourceExcerpt} links={links} />
                </section>
              )}
              {links.some(
                (link) =>
                  !link.application && !job.description.includes(link.url),
              ) && (
                <section
                  className="vacancy-related-links"
                  aria-label="განცხადების ბმულები"
                >
                  <div className="application-links">
                    {links
                      .filter(
                        (link) =>
                          !link.application &&
                          !job.description.includes(link.url),
                      )
                      .map((l) => (
                        <a
                          className={
                            l.application
                              ? 'primary vacancy-apply-link'
                              : 'secondary-button vacancy-employer-link'
                          }
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {l.application ? (
                            <Send aria-hidden="true" />
                          ) : (
                            <Globe2 aria-hidden="true" />
                          )}
                          {l.label}
                          <small>{l.host}</small>
                        </a>
                      ))}
                  </div>
                </section>
              )}
              {!hasAction && <TranslationHelp job={job} />}
              {!!extraFacts.length && (
                <section className="extra-facts">
                  <h3>დამატებითი პირობები და მოთხოვნები</h3>
                  <dl>
                    {/* A source can repeat a label (two contact phones, say), so the index
                        keeps the rows distinct; React drops rows that share a key. */}
                    {extraFacts.map((f, index) => (
                      <div key={`${f.label}-${index}`}>
                        <dt>{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {(job.companyProfile?.website ||
                job.companyProfile?.description) && (
                <section className="company-about">
                  <h2>დამსაქმებლის შესახებ</h2>
                  {job.companyProfile.description && (
                    <p>{job.companyProfile.description}</p>
                  )}
                  {job.companyProfile.website && (
                    <a
                      href={job.companyProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe2 size={14} />
                      კომპანიის ვებსაიტი
                    </a>
                  )}
                </section>
              )}
              <details className="vacancy-more-actions">
                <summary>
                  მეტი მოქმედება
                  <ChevronDown
                    className="disclosure-chevron"
                    aria-hidden="true"
                  />
                </summary>
                {!preview && (
                  <button
                    className="secondary-button vacancy-hide-action"
                    disabled={!activity.ready}
                    onClick={() => {
                      const hidden = activity.hidden.some(
                        (item) => item.id === job.id,
                      );
                      const ok = hidden
                        ? activity.restore(job.id)
                        : activity.hide(job.id, job.title);
                      setFeedback(
                        ok
                          ? hidden
                            ? 'ვაკანსია დაბრუნებულია ძებნის შედეგებში.'
                            : 'ვაკანსია დამალულია ძებნის შედეგებიდან. აქვე შეგიძლია აღდგენა.'
                          : 'ბრაუზერმა ცვლილება ვერ შეინახა.',
                      );
                    }}
                  >
                    {activity.hidden.some((item) => item.id === job.id)
                      ? 'ძებნის შედეგებში აღდგენა'
                      : 'არ მაინტერესებს'}
                  </button>
                )}
              </details>
            </section>
          )}
          <footer
            className="vacancy-source compact-source"
            id="vacancy-source"
            aria-label="განცხადების წყარო"
          >
            {job.source === 'JOBX' ? (
              <span>განცხადება დამსაქმებელმა JOBX-ზე დაამატა.</span>
            ) : (
              <>
                <span>ორიგინალი: </span>
                {(job.sources.length
                  ? job.sources
                  : [{ source: job.source, url: job.url }]
                ).map((source, index) => (
                  <span key={source.url}>
                    {index > 0 && ', '}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.source}
                    </a>
                  </span>
                ))}
                <span> · </span>
                <SourceStatus job={job} />
              </>
            )}
            {job.fullTextUrl && (
              <>
                {' '}
                ·{' '}
                <a
                  href={job.fullTextUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  სრული ტექსტი დამსაქმებელთან
                </a>
              </>
            )}
            {job.sourceChanged && (
              <span>
                {' '}
                · წყაროზე პირობები შეიცვალა — გადაამოწმე განაცხადის გაგზავნამდე.
              </span>
            )}
            {!preview && <JobReportForm key={job.id} jobId={job.id} />}
          </footer>
          {!preview && <SimilarVacancies id={job.id} returnTo={returnTo} />}
        </article>
      </main>
      {footer}
      {/* On a phone the contact column sits below the vacancy, so the way to apply stays in reach here. */}
      <section
        className="vacancy-mobile-action"
        aria-label="დამსაქმებელთან დაკავშირება"
      >
        {hasAction ? (
          <ApplyAction job={job} />
        ) : (
          <a
            className="primary"
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send aria-hidden="true" />
            განაცხადის გაგზავნა
          </a>
        )}
      </section>
      {feedback && (
        <output className="feedback-toast">
          <Check size={16} />
          {feedback}
          <button
            aria-label="შეტყობინების დახურვა"
            onClick={() => setFeedback('')}
          >
            <X size={16} />
          </button>
        </output>
      )}
    </div>
  );
}
