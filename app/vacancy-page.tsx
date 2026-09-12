'use client';
import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Share2,
  Clock3,
  Globe2,
  Check,
  X,
} from 'lucide-react';
import { Brand } from './brand';
import { CompanyLogo } from './company-logo';
import { Description, SourceStatus, formatDate } from './vacancy-text';
import { QuickApply, TranslationHelp } from './quick-apply';
import { ApplicationControl, usePersonalSpace } from './personal-space';
import {
  vacancyContacts,
  workSchedule,
  applicationDestination,
  defaultApplicationBody,
} from '@/lib/vacancy-details';
import { emailDraft } from '@/lib/application-contact';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { shareLink } from '@/lib/share';
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
import type { SalaryContext } from '@/lib/server/salary-context';
import './search-features.css';

/* Thousands separated by a narrow no-break space, the way Georgian salaries are written. */
const gel = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
/* The context is monthly GEL figures; only a monthly GEL vacancy can be compared with it
   (same rule as the salary filter: an empty period is monthly unless the text says otherwise). */
function monthlyGel(job: PublicJob) {
  return (
    job.currency === 'GEL' &&
    typeof job.salaryMin === 'number' &&
    job.salaryMin > 0 &&
    (job.salaryPeriod === 'თვე' ||
      (!job.salaryPeriod &&
        !/(დღ|საათ|კვირ|hour|dail|day|week)/i.test(job.salary || '')))
  );
}

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
        >
          დარეკვა
        </a>
        <a
          className="primary"
          href={emailDraft(
            contacts.emails[0].email,
            job.title,
            contacts.emails[0].application
              ? defaultApplicationBody
              : 'გამარჯობა,\n\nთქვენს ვაკანსიასთან დაკავშირებით მაქვს კითხვა.',
          )}
        >
          {contacts.emails[0].application ? 'CV-ის გაგზავნა' : 'წერილის გახსნა'}{' '}
          <ArrowUpRight size={16} />
        </a>
      </>
    );
  if (emails.length === 1)
    return (
      <a
        className="primary"
        href={emailDraft(emails[0].email, job.title, defaultApplicationBody)}
      >
        CV-ის გაგზავნა მეილით <ArrowUpRight size={17} />
      </a>
    );
  if (external)
    return (
      <a
        className="primary"
        href={external.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        განაცხადის შევსება <ArrowUpRight size={17} />
      </a>
    );
  if (!contacts.emails.length && contacts.phones.length === 1)
    return (
      <a className="primary" href={`tel:${contacts.phones[0].number}`}>
        დარეკვა <ArrowUpRight size={17} />
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
        კონტაქტების ნახვა <ArrowUpRight size={17} />
      </button>
    );
  return null;
}
export default function VacancyPage({
  job,
  preview,
  returnTo,
  salaryContext = null,
}: {
  job: PublicJob;
  preview: boolean;
  returnTo: string;
  salaryContext?: SalaryContext | null;
}) {
  const personal = usePersonalSpace();
  const activity = useVacancyActivity();
  const { markSeen } = activity;
  useEffect(() => {
    if (preview) return;
    const timer = setTimeout(() => markSeen(job.id), 0);
    return () => clearTimeout(timer);
  }, [job.id, preview, markSeen]);
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
    const next = saved.includes(job.id)
      ? saved.filter((id) => id !== job.id)
      : [...saved, job.id].slice(-100);
    try {
      localStorage.setItem('ertad-saved', JSON.stringify(next));
      setSaved(next);
    } catch {
      setFeedback('ბრაუზერმა შენახვა ვერ შეძლო.');
    }
  }
  async function share() {
    const outcome = await shareLink(
      window.location.origin + vacancyPath(job.id),
      `${job.title} — ${job.company}`,
      [job.city, compactSalary(job.salary)].filter(Boolean).join(' · ') ||
        undefined,
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
    ['ანაზღაურება', compactSalary(job.salary)],
    ['ქალაქი', job.city || explicitWorkCity(job)],
    ['განაკვეთი', job.employmentType],
    ['სამუშაო რეჟიმი', job.mode],
    ['სამუშაო გრაფიკი', schedule.map(compactSchedule).join(' · ')],
  ].filter(([, value]) => value?.trim());
  const summary = vacancySummary(job);
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
  const contacts = vacancyContacts(job);
  const hasContact = Boolean(contacts.emails.length || contacts.phones.length);
  const hasAction = hasContact || Boolean(applicationDestination(job));
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
    if (
      href &&
      (/^(?:mailto:|tel:)/i.test(href) ||
        href === applicationDestination(job)?.url)
    )
      personal.begin(job);
  }
  const progress = (
    <ApplicationControl
      job={job}
      space={personal}
      disabled={preview}
      seen={activity.seen.includes(job.id)}
    />
  );
  return (
    <div
      onClickCapture={recordContactOpen}
      onAuxClickCapture={(event) => {
        if (event.button === 1) recordContactOpen(event);
      }}
      className={`board-shell vacancy-page has-personal-progress ${hasAction ? 'has-contact' : ''}`}
    >
      <header className="topbar">
        <div className="header-inner">
          <Brand />
          <Link
            className="vacancy-header-link"
            href={returnTo}
            prefetch={false}
            aria-label="ვაკანსიებზე დაბრუნება"
          >
            <ArrowLeft size={16} />
            <span className="back-label-full">ვაკანსიებზე დაბრუნება</span>
            <span className="back-label-short">უკან</span>
          </Link>
        </div>
      </header>
      <main className="vacancy-page-main">
        {preview && (
          <p className="vacancy-preview">
            ადმინის წინასწარი ნახვა — გამოუქვეყნებელი მონაცემები
          </p>
        )}
        <nav className="vacancy-breadcrumb" aria-label="გვერდის მდებარეობა">
          <Link href={returnTo} prefetch={false}>
            ვაკანსიები
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
              <CompanyLogo large company={job.company} url={job.logoUrl} />
              <div>
                <span>დამსაქმებელი</span>
                <strong>{job.company}</strong>
              </div>
            </div>
            {job.category !== 'სხვა' && (
              <span className="category-tag">{job.category}</span>
            )}
            <h1 id="vacancy-title" className="detail-title">
              {job.title}
            </h1>
            <div className="vacancy-title-tools">
              <div className="detail-dates">
                {job.datePosted && (
                  <span>გამოქვეყნდა {formatDate(job.datePosted)}</span>
                )}
                {job.deadline &&
                  (() => {
                    const left = daysUntil(job.deadline);
                    const urgent = left >= 0 && left <= 3;
                    return (
                      <span className={urgent ? 'deadline-urgent' : undefined}>
                        <Clock3 size={14} />
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
                      label === 'სამუშაო გრაფიკი'
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
            {salaryContext && (
              <aside className="salary-context" aria-label="ხელფასის კონტექსტი">
                <strong>ამ მიმართულებაში მითითებული ხელფასები</strong>
                <span className="salary-context-range">
                  <b>{gel(salaryContext.p25)}</b> –{' '}
                  <b>{gel(salaryContext.p75)}</b> ₾ / თვე
                </span>
                <small>
                  {salaryContext.count} ვაკანსია „{salaryContext.category}“
                  კატეგორიაში; შუალედი {gel(salaryContext.median)} ₾. მხოლოდ
                  განცხადებაში მითითებული საწყისი თანხებით.
                </small>
                {monthlyGel(job) && job.salaryMin ? (
                  <span className="salary-context-you">
                    ეს ვაკანსია: {gel(job.salaryMin)} ₾{' '}
                    {job.salaryMin >= salaryContext.median
                      ? '· შუალედზე მაღალი ან ტოლი'
                      : '· შუალედზე დაბალი'}
                  </span>
                ) : null}
              </aside>
            )}
            {summary.length > 0 && (
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
            {!hasAction && (
              <div className="vacancy-contact-guidance">
                <strong>დაკავშირების გზა</strong>
                <a
                  className="secondary-button"
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  კონტაქტი ნახე ორიგინალ განცხადებაში <ArrowUpRight size={15} />
                </a>
              </div>
            )}
          </section>
          {!hasAction && (
            <aside className="vacancy-contact vacancy-progress-only">
              {progress}
            </aside>
          )}
          {hasAction && (
            <aside
              className="vacancy-contact"
              aria-label="დამსაქმებელთან დაკავშირება"
            >
              <QuickApply job={job}>{progress}</QuickApply>
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
                              : 'vacancy-employer-link'
                          }
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {l.label}
                          <ArrowUpRight size={15} />
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
                      კომპანიის ვებსაიტი <ArrowUpRight size={14} />
                    </a>
                  )}
                </section>
              )}
              <details className="vacancy-more-actions">
                <summary>მეტი მოქმედება</summary>{' '}
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
          {!preview && <SimilarVacancies id={job.id} returnTo={returnTo} />}
          <footer className="vacancy-source" id="vacancy-source">
            <h2>ორიგინალი განცხადება</h2>
            {job.sourceChanged && (
              <p className="source-update-note">
                წყაროზე ცვლილებაა დაფიქსირებული. განაცხადის გაგზავნამდე
                გადაამოწმე განახლებული პირობები.
              </p>
            )}
            {job.fullTextUrl && (
              <a
                className="vacancy-fulltext-source"
                href={job.fullTextUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                სრული ტექსტი დამსაქმებლის გვერდზე <ArrowUpRight size={14} />
              </a>
            )}
            <div className="vacancy-source-links">
              {(job.sources.length
                ? job.sources
                : [{ source: job.source, url: job.url }]
              ).map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ორიგინალის ნახვა · {source.source}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
            <SourceStatus job={job} />
          </footer>
        </article>
      </main>
      {hasAction && (
        <section
          className="vacancy-mobile-action"
          aria-label="დამსაქმებელთან დაკავშირება"
        >
          <ApplyAction job={job} />
        </section>
      )}
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
