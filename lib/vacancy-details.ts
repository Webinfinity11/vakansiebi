import type { Vacancy } from './types';
import { applicationContacts } from './application-contact';

type DetailSource = Pick<Vacancy, 'description' | 'facts'>;
export const defaultApplicationBody =
  'გამარჯობა,\n\nმსურს განაცხადის გაკეთება თქვენს ვაკანსიაზე. გიგზავნით ჩემს CV-ს განსახილველად.\n\nპატივისცემით,\n[შენი სახელი]';

export function telephoneNumber(value: string): string | null {
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('00995')
    ? digits.slice(5)
    : digits.startsWith('995')
      ? digits.slice(3)
      : digits.length === 10 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return /^[235]\d{8}$/.test(local) ? '+995' + local : null;
}
export function telephoneHref(value: string): string | null {
  if (!/^tel:/i.test(value)) return null;
  try {
    return telephoneNumber(decodeURIComponent(value.slice(4)));
  } catch {
    return null;
  }
}
export function vacancyContacts(job: DetailSource) {
  const text = [
    job.description,
    ...(job.facts || []).map((f) => `${f.label}: ${f.value}`),
  ].join('\n');
  const phones = new Map<string, string>();
  const pattern =
    /(?<![\p{L}\p{N}@])(?:\+?995[ ().-]*|0)?[235](?:[ ().-]*\d){8}(?![\p{L}\p{N}])/gu;
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(
      Math.max(0, text.lastIndexOf('\n', match.index) + 1, match.index - 100),
      match.index,
    );
    const lineEnd = text.indexOf('\n', match.index);
    const context =
      before +
      text.slice(
        match.index,
        Math.min(
          lineEnd < 0 ? text.length : lineEnd,
          match.index + match[0].length + 50,
        ),
      );
    if (
      /https?:\/\/\S*$|(?:\bID|კოდი|საიდენტიფიკაციო)\s*[:#]?\s*$/i.test(before)
    )
      continue;
    if (
      !/ტელეფონ|ტელ\s*[:.]|ნომერ|დარეკ|დაგვიკავშ|დაკავშირ|მობილურ|phone|\bcall\b|contact|whatsapp|viber|📞/i.test(
        context,
      ) &&
      !match[0].startsWith('+995')
    )
      continue;
    if (
      /^\s*(?:₾|ლარ|GEL|USD|EUR|\$|€)/i.test(
        text.slice(match.index + match[0].length),
      )
    )
      continue;
    const number = telephoneNumber(match[0]);
    if (number)
      phones.set(
        number,
        number.replace(
          /^\+995(\d{3})(\d{2})(\d{2})(\d{2})$/,
          '+995 $1 $2 $3 $4',
        ),
      );
  }
  return {
    emails: applicationContacts(text).filter(
      (contact) =>
        !/^(?:privacy|dpo|noreply|no-reply|abuse|unsubscribe)@/i.test(
          contact.email,
        ),
    ),
    phones: [...phones]
      .slice(0, 5)
      .map(([number, display]) => ({ number, display })),
  };
}

/** Keep source wording; full-time employment alone does not imply hours or days. */
export function workSchedule(job: DetailSource): string[] {
  const values = (job.facts || [])
    .filter((f) =>
      /გრაფიკ|სამუშაო საათ|working hours|work(?:ing)? schedule|shift/i.test(
        f.label,
      ),
    )
    .map((f) => f.value.trim());
  const lines = job.description
    .split('\n')
    .map((l) => l.trim().replace(/^[•*–—-]+\s*/, ''))
    .filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(
      /^(?:(?:სამუშაო|მუშაობის|მორიგეობის)\s+)?(?:გრაფიკი|სამუშაო საათები|სამუშაო დღეები|working hours|work(?:ing)? schedule|shifts?)\s*[:–—-]?\s*(.*)$/i,
    );
    let value = match?.[1]?.trim();
    if (
      match &&
      !value &&
      lines[i + 1] &&
      /\d{1,2}[:.]\d{2}|ორშაბ|სამშაბ|ოთხშაბ|ხუთშაბ|პარასკ|შაბათ|კვირა|ცვლ|შეთანხმ|monday|weekday|weekend/i.test(
        lines[i + 1],
      )
    )
      value = lines[++i];
    if (
      !match &&
      /^(?:\d+\s*საათიანი\s*გრაფიკი|\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2})/.test(
        line,
      )
    )
      value = line;
    if (value && value.length <= 300) values.push(value);
  }
  return [...new Set(values.filter(Boolean))].slice(0, 4);
}

export function applicationDestination(job: Pick<Vacancy, 'applicationLinks'>) {
  const links = (job.applicationLinks || []).filter(
    (link) =>
      /განაცხად|რეზიუმ|\bapply\b|\bapplication\b/i.test(link.label) &&
      !/privacy|policy|კონფიდენციალურ/i.test(link.label + ' ' + link.url),
  );
  if (links.length !== 1) return null;
  try {
    const url = new URL(links[0].url);
    return url.protocol === 'https:' && !url.username && !url.password
      ? links[0]
      : null;
  } catch {
    return null;
  }
}
