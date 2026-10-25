'use client';
import { useUi } from '@/app/ui-language';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  ChevronDown,
  Copy,
  Globe2,
  Languages,
  Mail,
  Phone,
  Send,
} from 'lucide-react';
import { emailDraft, hasEnglishDescription } from '@/lib/application-contact';
import {
  applicationDestination,
  defaultApplicationBody,
  vacancyContacts,
} from '@/lib/vacancy-details';
import type { PublicJob } from '@/lib/types';
import { trackAction } from '@/lib/analytics-client';
import { savedResumeIdentity } from '@/lib/resume-client';

const noChanges = () => () => {};
function holdsJobxCv() {
  try {
    return !!savedResumeIdentity(window.localStorage);
  } catch {
    return false;
  }
}

export function QuickApply({
  job,
  showApplication = true,
  children,
}: {
  job: PublicJob;
  showApplication?: boolean;
  children?: ReactNode;
}) {
  const { ui } = useUi();
  const { emails, phones } = vacancyContacts(job);
  // The vacancy page captures contact clicks here and in its other contact links.
  const application = applicationDestination(job);
  const [message, setMessage] = useState('');
  // Read after hydration: the server cannot know what this browser saved.
  const linksCv = useSyncExternalStore(
    noChanges,
    () => job.source === 'JOBX' && holdsJobxCv(),
    () => false,
  );
  return (
    <section className="quick-apply" id="vacancy-contacts" tabIndex={-1}>
      <h3>{ui('დაუკავშირდი დამსაქმებელს')}</h3>
      {showApplication && application && (
        <a
          className="primary external-application"
          href={application.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Send aria-hidden="true" />
          {ui('განაცხადის გაგზავნა')}
        </a>
      )}
      <div className="contact-options">
        {phones.map((phone) => (
          <a
            className="contact-phone"
            key={phone.number}
            href={`tel:${phone.number}`}
          >
            <Phone size={16} />
            <span>
              <small>{ui('ტელეფონი')}</small>
              <strong>{phone.display}</strong>
            </span>
            <span className="contact-call">{ui('დარეკვა')}</span>
          </a>
        ))}
        {emails.map((contact) => (
          <div className="application-email" key={contact.email}>
            <span>
              {contact.application
                ? ui('ელფოსტა CV-სთვის')
                : ui('საკონტაქტო ელფოსტა')}
            </span>
            <strong>{contact.email}</strong>
            <div className="email-actions">
              <a
                className="primary"
                href={emailDraft(
                  contact.email,
                  job.title,
                  contact.application
                    ? defaultApplicationBody
                    : 'გამარჯობა,\n\nთქვენს განცხადებასთან დაკავშირებით მაქვს კითხვა.\n\n[შენი სახელი]',
                )}
              >
                <Mail size={16} />
                {contact.application
                  ? ui('CV-ის გაგზავნა')
                  : ui('წერილის გახსნა')}
              </a>
              <button
                type="button"
                className="secondary-button"
                aria-label={ui('{0} — კოპირება', [contact.email])}
                title={ui('ელფოსტის კოპირება')}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(contact.email);
                    trackAction('copy_email');
                    setMessage('ელფოსტა დაკოპირებულია');
                  } catch {
                    setMessage(
                      'კოპირება ვერ მოხერხდა. მონიშნე მისამართი ხელით.',
                    );
                  }
                }}
              >
                <Copy size={16} />
                <span className="email-copy-label">{ui('კოპირება')}</span>
              </button>
            </div>
            {!contact.application && (
              <small>
                {ui('განცხადებაში გადაამოწმე, იღებს თუ არა ეს მისამართი CV-ს.')}
              </small>
            )}
          </div>
        ))}
      </div>
      {!!emails.length && (
        <p className="quick-apply-note">
          {emails.some((contact) => contact.application)
            ? ui(
                'გაიხსნება შენი ფოსტა. მიამაგრე CV და გაგზავნამდე გადაამოწმე წერილის ტექსტი და თემა.',
              )
            : ui(
                'გაიხსნება შენი ფოსტა. წერილის ტექსტი და თემა შეცვალე დაკავშირების მიზნის მიხედვით.',
              )}
        </p>
      )}
      {linksCv && (phones.length > 0 || emails.length > 0 || !!application) && (
        <p className="quick-apply-note">
          {ui(
            'JOBX-ზე შექმნილი შენი CV დაკავშირებისას ამ ვაკანსიასთან აღირიცხება.',
          )}
        </p>
      )}
      {!phones.length && !emails.length && !application && (
        <p className="contact-missing">
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <Globe2 size={14} aria-hidden="true" />
            {ui('კონტაქტი ნახე პირველწყაროზე')}
          </a>
        </p>
      )}
      <output aria-live="polite">{ui(message)}</output>
      {children}
      <TranslationHelp job={job} />
    </section>
  );
}

export function TranslationHelp({ job }: { job: PublicJob }) {
  const { ui } = useUi();
  if (!hasEnglishDescription(job.description)) return null;
  return (
    <details className="translation-help">
      <summary>
        <Languages size={16} aria-hidden="true" />
        {ui('ინგლისური აღწერის ქართულად ნახვა')}
        <ChevronDown className="disclosure-chevron" aria-hidden="true" />
      </summary>
      <p>
        {ui(
          'წყაროს ავტომატური თარგმანი შეგიძლია Google Translate-ში გახსნა; მოთხოვნები ორიგინალთან გადაამოწმე.',
        )}
      </p>
      <a
        className="secondary-button"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackAction('translate')}
        href={
          'https://translate.google.com/translate?sl=auto&tl=ka&u=' +
          encodeURIComponent(job.url)
        }
      >
        <Languages aria-hidden="true" />
        {ui('ქართულად ნახვა')}
      </a>
    </details>
  );
}
