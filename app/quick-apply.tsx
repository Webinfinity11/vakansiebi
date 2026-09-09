'use client';
import { useState } from 'react';
import { Mail, Copy, ArrowUpRight, Languages } from 'lucide-react';
import {
  applicationContacts,
  emailDraft,
  hasEnglishDescription,
} from '@/lib/application-contact';
import type { PublicJob } from '@/lib/types';
export function QuickApply({ job }: { job: PublicJob }) {
  const contacts = applicationContacts(job.description);
  const [message, setMessage] = useState('');
  const [body, setBody] = useState(
    'გამარჯობა,\n\nმსურს განაცხადის გაკეთება თქვენს ვაკანსიაზე. გიგზავნით ჩემს CV-ს განსახილველად.\n\nპატივისცემით,\n[შენი სახელი]',
  );
  const english = hasEnglishDescription(job.description);
  if (!contacts.length && !english) return null;
  return (
    <section className="quick-apply">
      {contacts.length > 0 && (
        <>
          <h3>
            <Mail size={18} />
            როგორ გავაგზავნო განაცხადი?
          </h3>
          <p>
            ელფოსტა განცხადებიდან პირდაპირ აქ არის. გახსენი წერილი, მიამაგრე CV
            და გააგზავნე შენი ფოსტიდან.
          </p>
          {contacts.map((contact) => (
            <div className="application-email" key={contact.email}>
              <span>
                {contact.application
                  ? 'განაცხადის ელფოსტა'
                  : 'საკონტაქტო ელფოსტა განცხადებიდან'}
              </span>
              <strong>{contact.email}</strong>
              <div className="email-actions">
                <a
                  className="primary"
                  href={emailDraft(contact.email, job.title, body)}
                >
                  <Mail size={15} />
                  წერილის გახსნა
                </a>
                <button
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(contact.email);
                      setMessage('ელფოსტა დაკოპირებულია');
                    } catch {
                      setMessage(
                        'კოპირება ვერ მოხერხდა. მისამართი ზემოთ არის მითითებული.',
                      );
                    }
                  }}
                >
                  <Copy size={15} />
                  კოპირება
                </button>
              </div>
              {!contact.application && (
                <small>
                  გადაამოწმე, იღებს თუ არა ეს მისამართი განაცხადებს.
                </small>
              )}
            </div>
          ))}
          <details>
            <summary>წერილის ტექსტის შეცვლა</summary>
            <label htmlFor="application-email-body">
              ტექსტი — გაგზავნამდე ჩაწერე შენი სახელი
              <textarea
                id="application-email-body"
                rows={7}
                maxLength={4000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <p>
              წერილის თემად ჩაიწერება პოზიციის დასახელება. თუ განცხადება სხვა
              თემას ითხოვს, შეცვალე ფოსტაში.
            </p>
          </details>
          <p className="quick-apply-note">
            ღილაკი საფოსტო პროგრამას ხსნის. CV-ს მასში ამაგრებ; ჩვენი საიტი
            წერილს ავტომატურად არ აგზავნის.
          </p>
          <output aria-live="polite">{message}</output>
        </>
      )}
      {english && (
        <div className="translation-help">
          <h3>
            <Languages size={18} />
            ინგლისური აღწერა
          </h3>
          <p>
            ორიგინალი ტექსტი შენარჩუნებულია. წყაროს ქართული ავტომატური თარგმანი
            შეგიძლია Google Translate-ში გახსნა.
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
            ქართულად ნახვა · Google Translate <ArrowUpRight size={15} />
          </a>
          <small>
            ავტომატური თარგმანი შეიძლება არაზუსტი იყოს; მოთხოვნები ორიგინალთან
            გადაამოწმე.
          </small>
        </div>
      )}
    </section>
  );
}
