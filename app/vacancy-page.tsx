'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
import type { PublicJob } from '@/lib/types';

function ApplyAction({ job }: { job: PublicJob }) {
  const contacts = vacancyContacts(job);
  const emails = contacts.emails.filter((c) => c.application);
  const external = applicationDestination(job);
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
}: {
  job: PublicJob;
  preview: boolean;
  returnTo: string;
}) {
  const personal = usePersonalSpace();
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
    try {
      await navigator.clipboard.writeText(
        window.location.origin + vacancyPath(job.id),
      );
      setFeedback('ვაკანსიის ბმული დაკოპირებულია');
    } catch {
      setFeedback('ბმულის კოპირება ვერ მოხერხდა.');
    }
  }
  const schedule = workSchedule(job);
  const contacts = vacancyContacts(job);
  const hasContact = Boolean(
    contacts.emails.length ||
    contacts.phones.length ||
    applicationDestination(job),
  );
  return (
    <div
      className={`board-shell vacancy-page ${hasContact ? 'has-contact' : ''}`}
    >
      <header className="topbar">
        <div className="header-inner">
          <Brand />
          <Link
            className="vacancy-header-link"
            href={returnTo}
            prefetch={false}
          >
            <ArrowLeft size={16} /> ვაკანსიებზე დაბრუნება
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
          <span aria-hidden="true">/</span>
          <span>{job.category}</span>
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
            <span className="category-tag">{job.category}</span>
            <h1 id="vacancy-title" className="detail-title">
              {job.title}
            </h1>
            <div className="vacancy-title-tools">
              <div className="detail-dates">
                {job.datePosted && (
                  <span>გამოქვეყნდა {formatDate(job.datePosted)}</span>
                )}
                {job.deadline && (
                  <span>
                    <Clock3 size={14} />
                    ბოლო ვადა: {formatDate(job.deadline)}
                  </span>
                )}
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
            <dl className="detail-facts">
              {[
                ['ანაზღაურება', job.salary || 'არ არის მითითებული'],
                ['ქალაქი', job.city || 'არ არის მითითებული'],
                ['განაკვეთი', job.employmentType],
                ['სამუშაო რეჟიმი', job.mode],
                [
                  'სამუშაო გრაფიკი',
                  schedule.length ? schedule.join(' · ') : 'არ არის მითითებული',
                ],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className={
                      label === 'სამუშაო გრაფიკი' ? 'schedule-fact' : undefined
                    }
                  >
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          </section>
          {hasContact && (
            <aside
              className="vacancy-contact"
              aria-label="დამსაქმებელთან დაკავშირება"
            >
              <QuickApply job={job} />
            </aside>
          )}
          <section className="vacancy-description-panel">
            <h2 className="description-heading">პოზიციის შესახებ</h2>
            {job.description.trim() ? (
              <Description text={job.description} />
            ) : (
              <p className="filter-help">
                დამატებითი აღწერა არ არის მითითებული.
              </p>
            )}
            {!hasContact && <TranslationHelp job={job} />}
            {!!job.facts?.length && (
              <details className="extra-facts">
                <summary>
                  დამატებითი პირობები და მოთხოვნები{' '}
                  <span>{job.facts.length}</span>
                </summary>
                <dl>
                  {job.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
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
            {!!job.applicationLinks?.length && (
              <details className="vacancy-related-links">
                <summary>ბმულები განცხადებიდან</summary>
                <div className="application-links">
                  {job.applicationLinks.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {l.label}
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                </div>
              </details>
            )}
            <details className="application-tracker">
              <summary>
                განაცხადის ეტაპის აღნიშვნა <span>სურვილისამებრ</span>
              </summary>
              <ApplicationControl
                job={job}
                space={personal}
                disabled={preview}
              />
            </details>
          </section>
          <footer className="vacancy-source" id="vacancy-source">
            <h2>განცხადების წყარო</h2>
            {job.sourceChanged && (
              <p className="source-update-note">
                წყაროზე ცვლილებაა დაფიქსირებული. განაცხადის გაგზავნამდე
                გადაამოწმე განახლებული პირობები.
              </p>
            )}
            {!hasContact && (
              <p>
                საკონტაქტო ინფორმაცია აღწერაში არ არის მითითებული. დაკავშირების
                გზა შეგიძლია განცხადების ორიგინალში ნახო.
              </p>
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
                  {source.source}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
            <SourceStatus job={job} />
          </footer>
        </article>
      </main>
      {hasContact && (
        <div className="vacancy-mobile-action">
          <ApplyAction job={job} />
        </div>
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
