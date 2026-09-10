'use client';
import { useState, type ReactNode } from 'react';
import { Mail, Phone, Copy, ArrowUpRight, Languages } from 'lucide-react';
import { emailDraft, hasEnglishDescription } from '@/lib/application-contact';
import {
  applicationDestination,
  defaultApplicationBody,
  vacancyContacts,
} from '@/lib/vacancy-details';
import type { PublicJob } from '@/lib/types';

export function QuickApply({
  job,
  showApplication = true,
  children,
}: {
  job: PublicJob;
  showApplication?: boolean;
  children?: ReactNode;
}) {
  const { emails, phones } = vacancyContacts(job);
  const application = applicationDestination(job);
  const [message, setMessage] = useState('');
  return (
    <section className="quick-apply" id="vacancy-contacts" tabIndex={-1}>
      <h3>დაუკავშირდი დამსაქმებელს</h3>
      {showApplication && application && (
        <a
          className="primary external-application"
          href={application.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          განაცხადის შევსება <ArrowUpRight size={16} />
        </a>
      )}
      <div className="contact-options">
        {phones.map((phone) => (
          <a
            className="contact-phone"
            key={phone.number}
            href={`tel:${phone.number}`}
          >
            <Phone size={18} />
            <span>
              <small>ტელეფონი</small>
              <strong>{phone.display}</strong>
            </span>
            <span className="contact-call">დარეკვა</span>
          </a>
        ))}
        {emails.map((contact) => (
          <div className="application-email" key={contact.email}>
            <span>
              {contact.application ? 'ელფოსტა CV-სთვის' : 'საკონტაქტო ელფოსტა'}
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
                {contact.application ? 'CV-ის გაგზავნა' : 'წერილის გახსნა'}
              </a>
              <button
                className="secondary-button"
                aria-label={`${contact.email} — კოპირება`}
                title="ელფოსტის კოპირება"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(contact.email);
                    setMessage('ელფოსტა დაკოპირებულია');
                  } catch {
                    setMessage(
                      'კოპირება ვერ მოხერხდა. მონიშნე მისამართი ხელით.',
                    );
                  }
                }}
              >
                <Copy size={15} />
                <span className="email-copy-label">კოპირება</span>
              </button>
            </div>
            {!contact.application && (
              <small>
                განცხადებაში გადაამოწმე, იღებს თუ არა ეს მისამართი CV-ს.
              </small>
            )}
          </div>
        ))}
      </div>
      {!!emails.length && (
        <p className="quick-apply-note">
          {emails.some((contact) => contact.application)
            ? 'გაიხსნება შენი ფოსტა. მიამაგრე CV და გაგზავნამდე გადაამოწმე წერილის ტექსტი და თემა.'
            : 'გაიხსნება შენი ფოსტა. წერილის ტექსტი და თემა შეცვალე დაკავშირების მიზნის მიხედვით.'}
        </p>
      )}
      {!phones.length && !emails.length && !application && (
        <p className="contact-missing">
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            კონტაქტი ნახე პირველწყაროზე <ArrowUpRight size={13} />
          </a>
        </p>
      )}
      <output aria-live="polite">{message}</output>
      {children}
      <TranslationHelp job={job} />
    </section>
  );
}

export function TranslationHelp({ job }: { job: PublicJob }) {
  if (!hasEnglishDescription(job.description)) return null;
  return (
    <details className="translation-help">
      <summary>
        <Languages size={16} /> ინგლისური აღწერის ქართულად ნახვა
      </summary>
      <p>
        წყაროს ავტომატური თარგმანი შეგიძლია Google Translate-ში გახსნა;
        მოთხოვნები ორიგინალთან გადაამოწმე.
      </p>
      <a
        className="secondary-button"
        target="_blank"
        rel="noopener noreferrer"
        href={
          'https://translate.google.com/translate?sl=auto&tl=ka&u=' +
          encodeURIComponent(job.url)
        }
      >
        ქართულად ნახვა <ArrowUpRight size={15} />
      </a>
    </details>
  );
}
