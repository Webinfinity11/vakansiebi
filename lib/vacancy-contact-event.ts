import { mailtoAddress } from './application-contact';
import {
  applicationDestination,
  telephoneHref,
  vacancyContacts,
} from './vacancy-details';
import type { Vacancy } from './types';

/** The same destination counts alike in a button, the description, or the mobile bar. */
export function vacancyContactEvent(
  href: string,
  job: Pick<Vacancy, 'description' | 'facts' | 'applicationLinks'>,
): 'call' | 'cv' | 'email' | 'apply' | null {
  if (telephoneHref(href)) return 'call';
  const email = mailtoAddress(href);
  if (email)
    return vacancyContacts(job).emails.some(
      (contact) =>
        contact.application &&
        contact.email.toLowerCase() === email.toLowerCase(),
    )
      ? 'cv'
      : 'email';
  if (href === applicationDestination(job)?.url) return 'apply';
  return null;
}
