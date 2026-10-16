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
    if (
      /^(?:დასაქმებულის\s+)?სამუშაო დრო\s+(?:შეადგენს|განისაზღვრება)/.test(
        line,
      ) &&
      /საათ|კვირ|დღე/.test(line)
    )
      value = line;
    if (value && value.length <= 300) values.push(value);
  }
  return [...new Set(values.filter(Boolean))].slice(0, 4);
}

/* Forms and hiring systems that receive the application themselves. Sources often
   label these links with the bare URL, so the address alone has to identify them. */
const applicationForm =
  /^https:\/\/(?:smrtr\.io\/[A-Za-z0-9]+|wrk\.ge\/[A-Za-z0-9]+|(?:www\.)?app\.helio-ai\.com\/apply\/|hel-ai\.com\/apply\/|[a-z0-9-]+\.selfrecruit\.ge\/(?:s\/|[a-f0-9]{8}-)|jobs\.smartrecruiters\.com\/|docs\.google\.com\/forms\/|forms\.gle\/|forms\.office\.com\/|(?:[a-z0-9-]+\.)?typeform\.com\/to\/|(?:form\.)?jotform\.com\/|tally\.so\/r\/|[a-z0-9-]+\.hirehive\.com\/[^/?#]+|(?:www\.)?cleverstaff\.net\/[^?#]*vacanc|[a-z0-9-]+\.bamboohr\.com\/careers\/\d|talent\.sage\.hr\/jobs\/|apply\.workable\.com\/[^/]+\/j\/|[a-z0-9-]+\.teamtailor\.com\/jobs\/|jobs\.lever\.co\/[^/]+\/|(?:job-)?boards\.greenhouse\.io\/|[a-z0-9-]+\.recruitee\.com\/o\/|[a-z0-9-]+\.peopleforce\.io\/careers\/v\/|[a-z0-9-]+\.bitrix24\.site\/crm_form|crm\.[a-z0-9.-]+\/crm\/deal\/web_form\/|vacancy\.hr\.gov\.ge\/JobProvider\/UserOrgVaks\/Details\/)/i;
/* An employer's own careers site counts only on a page deeper than its front page,
   and never on a job board that republishes the vacancy. */
const careersPage =
  /^https:\/\/(?:(?:careers?|jobs|vacancy|vacancies)\.(?!ge\/)[a-z0-9.-]+\/[^?#\s]+|(?!(?:www\.)?(?:jobs|hr|myjobs|ss|jobs24|unijobs)\.ge\/)[a-z0-9.-]+\/(?:[a-z]{2}\/)?(?:careers?|jobs?|vacanc(?:y|ies))\/[^?#\s]+)/i;
export function applicationDestination(job: Pick<Vacancy, 'applicationLinks'>) {
  const links = (job.applicationLinks || []).filter(
    (link) =>
      (/განაცხად|რეზიუმ|\bapply\b|\bapplication\b/i.test(link.label) ||
        applicationForm.test(link.url) ||
        careersPage.test(link.url)) &&
      !/privacy|policy|კონფიდენციალურ/i.test(link.label + ' ' + link.url),
  );
  // One form reached through tracked and untracked links is still one destination.
  const destinations = new Map<string, (typeof links)[number]>();
  for (const link of links) {
    try {
      const url = new URL(link.url);
      if (url.protocol !== 'https:' || url.username || url.password)
        return null;
      const key = url.host + url.pathname.replace(/\/$/, '');
      if (!destinations.has(key)) destinations.set(key, link);
    } catch {
      return null;
    }
  }
  /* A careers page can also list its own shortcuts (…/vacancy and …/vacancy/whatsapp);
     the page they all sit under is the application. */
  const keys = [...destinations.keys()];
  const parent = keys.find((key) =>
    keys.every((other) => other === key || other.startsWith(key + '/')),
  );
  return parent ? destinations.get(parent)! : null;
}
