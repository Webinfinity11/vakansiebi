'use client';
import { useUi } from '@/app/ui-language';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Copy,
  Globe2,
  Mail,
  Phone,
  Send,
} from 'lucide-react';
import { emailDraft } from '@/lib/application-contact';
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
        {emails.map((contact) => (
          <div className="application-email" key={contact.email}>
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
      </div>
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
    </section>
  );
}
