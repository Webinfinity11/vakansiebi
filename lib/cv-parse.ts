import { candidatePhone } from './company-candidates';
import { cityAliases, isCityCountry, knownCity, placeName } from './places';
import type {
  CandidateProfile,
  CandidateLanguageLevel,
  EducationLevel,
} from './company-candidates';

type Profile = Omit<CandidateProfile, 'origin'>;
const fold = (s: string) =>
  s.normalize('NFKC').normalize('NFC').toLowerCase().replace(/й/g, 'и');
const unique = (a: string[]) => [...new Set(a.filter(Boolean))];
const languages: Record<string, string[]> = {
  ქართული: ['ქართული', 'georgian', 'грузинскии'],
  ინგლისური: ['ინგლისური', 'english', 'англиискии'],
  რუსული: ['რუსული', 'russian', 'русскии'],
  გერმანული: ['გერმანული', 'german', 'немецкии'],
  ფრანგული: ['ფრანგული', 'french', 'французскии'],
  თურქული: ['თურქული', 'turkish', 'турецкии'],
  იტალიური: ['იტალიური', 'italian', 'итальянскии'],
  ესპანური: ['ესპანური', 'spanish', 'испанскии'],
  სომხური: ['სომხური', 'armenian', 'армянскии'],
  აზერბაიჯანული: ['აზერბაიჯანული', 'azerbaijani', 'азербаиджанскии'],
  უკრაინული: ['უკრაინული', 'ukrainian', 'украинскии'],
  ჩინური: ['ჩინური', 'chinese', 'китаискии'],
  არაბული: ['არაბული', 'arabic', 'арабскии'],
};
const skills: [string, RegExp][] = [
  ['Excel', /\b(?:ms\s+)?excel\b|ექსელ|эксел/iu],
  ['1C', /1[cс]/iu],
  ['Word', /\b(?:ms\s+)?word\b/iu],
  ['PowerPoint', /power\s*point/iu],
  ['Photoshop', /photoshop/iu],
  ['Figma', /figma/iu],
  ['AutoCAD', /autocad/iu],
  ['SQL', /\bsql\b/iu],
  ['Python', /\bpython\b/iu],
  ['JavaScript', /\bjavascript\b|\bjs\b/iu],
  ['TypeScript', /\btypescript\b/iu],
  ['React', /\breact\b/iu],
  ['Next.js', /next\.js/iu],
  ['Git', /\bgit\b/iu],
  ['IFRS', /\bifrs\b|ფასს/iu],
  ['rs.ge', /rs\.ge/iu],
  ['ORIS', /\boris\b|ორის/iu],
  ['CRM', /\bcrm\b/iu],
  ['გაყიდვები', /გაყიდვ|\bsales\b|продаж/iu],
  ['მოლაპარაკება', /მოლაპარაკ|negotiation|переговор/iu],
  ['ბუღალტერია', /ბუღალტ|accounting|бухгалтер/iu],
  ['Power BI', /power\s*bi/iu],
  ['Tableau', /\btableau\b/iu],
  ['Outlook', /\boutlook\b/iu],
  ['Microsoft Office', /microsoft office|ms office|მაიკროსოფტ ოფის/iu],
  ['Google Sheets', /google sheets|გუგლ ცხრილ/iu],
  ['SAP', /\bsap\b/iu],
  ['QuickBooks', /quickbooks/iu],
  ['HTML', /\bhtml\b/iu],
  ['CSS', /\bcss\b/iu],
  ['Java', /\bjava\b/iu],
  ['Docker', /\bdocker\b/iu],
  ['Linux', /\blinux\b/iu],
  ['Customer service', /customer service|მომხმარებელთა მომსახურება|обслуживание клиентов/iu],
  ['Logistics', /logistics|ლოგისტიკა|логистика/iu],
  ['Inventory management', /inventory management|მარაგების მართვა|управление запасами/iu],
  ['Front office', /front office|სასტუმროს მიღება/iu],
  ['POS', /\bpos\b/iu],
];
const cities = cityAliases;
const contains = (text: string, word: string) =>
  new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'u').test(text);
function canonical(s: string, dict: Record<string, string[]>) {
  const t = fold(s);
  return (
    Object.entries(dict).find(([, names]) =>
      names.some((n) => contains(t, n)),
    )?.[0] ?? s.trim()
  );
}
function level(s: string): CandidateLanguageLevel | null {
  const t = fold(s);
  const cefr = [...t.matchAll(/\b([abc][12])\b/gi)].map(m => m[1]).sort()[0];
  if (cefr) return cefr as CandidateLanguageLevel;
  if (/native|mother tongue|მშობლიური|роднои/.test(t)) return 'native';
  if (/full professional/.test(t)) return 'c1';
  if (/professional working/.test(t)) return 'b2';
  if (/limited working/.test(t)) return 'b1';
  if (/elementary/.test(t)) return 'a2';
  if (/fluent|თავისუფლად|свободно/.test(t)) return 'c1';
  if (/advanced|კარგად|продвинут/.test(t)) return 'b2';
  if (/intermediate|საშუალო|средни/.test(t)) return 'b1';
  if (/basic|ბაზისური|базовы|начальн/.test(t)) return 'a2';
  return null;
}
function educationLevel(text: string): EducationLevel | null {
  const t = fold(text);
  if (/ph\.?d|დოქტორ|кандидат|доктор/.test(t)) return 'phd';
  if (/მაგისტრ|master|\bmba\b|магистр/.test(t)) return 'master';
  if (/ბაკალავრ|bachelor|бакалавр|специалист/.test(t)) return 'bachelor';
  if (/პროფესიულ|კოლეჯ|vocational|college|колледж/.test(t)) return 'vocational';
  if (/საშუალო სკოლ|secondary|high school|среднее/.test(t)) return 'secondary';
  return null;
}
function canonicalSkills(items: string[]) {
  return unique(
    items.flatMap((s) => {
      const found = skills.filter(([, re]) => re.test(s)).map(([name]) => name);
      const driving =
        /მართვის მოწმობა|კატეგორია|driving licen[cs]e|driver.?s licen[cs]e|водительские права|категори/iu.test(
          s,
        );
      if (driving)
        for (const c of s.match(/\b(?:CE|B|C)\b/gi) ?? [])
          found.push('მართვის მოწმობა ' + c.toUpperCase());
      return found.length ? found : [s.trim()];
    }),
  ).slice(0, 60);
}
export function normalizeProfile<T extends Profile>(p: T): T {
  return {
    ...p,
    skills: canonicalSkills(p.skills),
    city: placeName(p.city, true),
    languages: [
      ...new Map(
        p.languages.map((l) => [
          canonical(l.name, languages),
          { name: canonical(l.name, languages), level: level(l.level ?? '') },
        ]),
      ).values(),
    ],
    educationLevel: p.educationLevel ?? educationLevel(p.education.join('\n')),
  };
}
const monthNames = [
  ['იანვარ', 'jan', 'январ'],
  ['თებერვალ', 'feb', 'феврал'],
  ['მარტ', 'mar', 'март'],
  ['აპრილ', 'apr', 'апрел'],
  ['მაის', 'may', 'маи', 'мая'],
  ['ივნის', 'jun', 'июн'],
  ['ივლის', 'jul', 'июл'],
  ['აგვისტ', 'aug', 'август'],
  ['სექტემბერ', 'sep', 'сентябр'],
  ['ოქტომბერ', 'oct', 'октябр'],
  ['ნოემბერ', 'nov', 'ноябр'],
  ['დეკემბერ', 'dec', 'декабр'],
];
const monthWord = monthNames.flat().join('|');
const dateToken = `(?:\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4}[-/.]\\d{1,2}|\\d{4}\\s+წლის\\s+(?:${monthWord})[\\p{L}.]*|(?:${monthWord})[\\p{L}.]*\\s+\\d{4}|\\d{4})`;
const present = /present|current|^date$|^now$|დღემდე|ამჟამად|მიმდინარე|настоящее|н\.в\./i;
const range = new RegExp(
  `(${dateToken})\\s*(?:[-–—]|\\bto\\b|დან)\\s*(${dateToken}|present|current|date|now|დღემდე|ამჟამად|მიმდინარე|по настоящее время|настоящее время|н\\.в\\.)`,
  'giu',
);
function dateMonth(s: string, end = false) {
  const t = fold(s);
  if (present.test(t)) {
    const d = new Date();
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  }
  const year = Number(/(?:19|20)\d{2}/.exec(t)?.[0]);
  if (!year) return null;
  let month = monthNames.findIndex((names) => names.some((n) => t.includes(n)));
  const numeric =
    /^\d{1,2}[/.](\d{1,2})[/.]\d{4}$/.exec(t) ?? /^(\d{1,2})[/.]\d{4}$/.exec(t) ?? /^\d{4}[-/.](\d{1,2})$/.exec(t);
  if (numeric) {
    month = Number(numeric[1]) - 1;
    if (month < 0 || month > 11) return null;
  }
  if (month < 0) month = end ? 11 : 0;
  if (month > 11) return null;
  return year * 12 + month;
}
function headingKey(line: string): string | null {
  if (line.length > 85) return null;
  const h = fold(line).replace(/^[+•\s]+/, '').replace(/[:：].*$/, '').trim();
  const compact = h.replace(/(?<=\p{L})\s+(?=\p{L}(?:\s|$))/gu, '');
  const value = /^(?:\p{L}\s+){3}/u.test(h) ? compact : h;
  if (/^(?:სამუშაო გამოცდილება|გამოცდილება|professional experience|work experience|experience|employment history|work history|опыт работы|трудовая деятельность)(?:$|\s|[—–-])/.test(value)) return 'work';
  if (/^(?:განათლება|education|образование)(?:$|\s)/.test(value)) return 'education';
  if (/^(?:ენები|უცხო ენები|language skills|languages|языки|знание языков)$/.test(value)) return 'languages';
  if (/^(?:უნარები|ტექნიკური უნარები|skills|top skills|digital skills|technical skills|навыки|ключевые навыки)$/.test(value)) return 'skills';
  if (/^(?:სერტიფიკატები|certifications|certificates|licenses and certifications|сертификаты)$/.test(value)) return 'certifications';
  if (/^(?:კონტაქტი|contact|contacts|contact details|personal information|контакты)$/.test(value)) return 'contact';
  if (/^(?:summary|professional summary|პროფილი|შეჯამება|о себе)$/.test(value)) return 'summary';
  if (/^(?:ინტერესები|რეკომენდაციები|interests|references)$/.test(value)) return 'other';
  return null;
}
function isoDate(value: string): string {
  if (present.test(fold(value))) return 'present';
  const month = dateMonth(value);
  if (month === null) return '';
  return /^\d{4}$/.test(value.trim()) ? value.trim() :
    `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`;
}
export function parseCvText(input: string): Profile {
  const text = input.slice(0, 60000).replace(/\r/g, '');
  const sections: Record<string, string[]> = {
    work: [],
    education: [],
    skills: [],
    languages: [],
    other: [],
    contact: [],
    summary: [],
    certifications: [],
  };
  let section = 'other';
  for (const raw of text.split('\n')) {
    if (raw.includes('\f')) { section = 'other'; continue; }
    const line = raw.trim().replace(/^[•▪●]\s*/, '').replace(/[^\S\t]+/g, ' ');
    const key = headingKey(line);
    if (key) {
      section = key;
      const inline = line.includes(':') ? line.slice(line.indexOf(':') + 1).trim() : '';
      if (inline) sections[section].push(inline);
    } else if (line) sections[section].push(line);
  }
  const spans: [number, number][] = [];
  const work = sections.work.join('\n');
  for (const m of work.matchAll(range)) {
    const a = dateMonth(m[1]);
    const b = dateMonth(m[2], true);
    const now = new Date();
    const today = now.getUTCFullYear() * 12 + now.getUTCMonth();
    if (a !== null && b !== null && b >= a && a <= today)
      spans.push([a, Math.min(b, today) + 1]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  const detectedLanguages: Profile['languages'] = [];
  const languageText = sections.languages.length
    ? sections.languages.join('\n')
    : text;
  for (const line of languageText.split('\n')) {
    const t = fold(line);
    const matches = Object.entries(languages)
      .flatMap(([name, aliases]) =>
        aliases.flatMap((alias) => {
          const i = t.indexOf(alias);
          return i >= 0 && contains(t, alias)
            ? [{ name, i, end: i + alias.length }]
            : [];
        }),
      )
      .sort((a, b) => a.i - b.i);
    if (!matches.length && /listening|reading|writing|spoken/i.test(line) && detectedLanguages.length) {
      const previous = detectedLanguages.at(-1)!;
      previous.level = level([previous.level ?? '', line].join(' '));
    }
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      detectedLanguages.push({
        name: m.name,
        level: level(t.slice(m.end, matches[i + 1]?.i)) ?? (i === 0 ? level(t.slice(0, m.i)) : null),
      });
    }
  }
  const roleEntries: { label: string; at: number }[] = [];
  const positions: NonNullable<Profile['positions']> = [];
  let pending: string[] = [];
  for (const line of sections.work) {
    const m = [...line.matchAll(range)][0];
    if (m) {
      const inline = line
        .replace(m[0], '')
        .replace(/\([^)]*\b(?:years?|months?)\b[^)]*\)/gi, '')
        .replace(/^[\s|,:;–—-]+|[\s|,:;–—-]+$/g, '');
      const lines = inline ? [inline] : pending.slice(-2);
      const combined = lines.find((l) => /\s[—–-]\s/.test(l));
      const label = combined ?? lines.join(' — ');
      if (label && dateMonth(m[1]) !== null && dateMonth(m[2], true) !== null) {
        roleEntries.push({ label, at: dateMonth(m[2], true) ?? 0 });
        const [title, ...company] = label.split(/\s[—–-]\s/);
        positions.push({title, company: company.join(' — '), start: isoDate(m[1]), end: isoDate(m[2])});
      }
      pending = [];
    } else if (line.length < 100) pending.push(line);
  }
  // Undated job titles remain useful, but descriptions should not become roles.
  if (!roleEntries.length)
    for (const line of pending.filter((l) => /\s[—–-]\s/.test(l)))
      roleEntries.push({ label: line, at: 0 });
  const roles = unique(
    roleEntries.sort((a, b) => b.at - a.at).map((r) => r.label),
  );
  const foundCity = knownCity(text);
  const shortSkills = sections.skills
    .flatMap((l) => l.split(/[,;•▪|]/))
    .map((s) => s.trim())
    .filter(
      (s) => s.length > 1 && s.length <= 65 && s.split(/\s+/).length <= 7 && !Object.values(languages).flat().some(l => contains(fold(s), l)) && !/certificate|certified|სერტიფიკატ|сертификат/i.test(s),
    );
  const skillSource = Object.entries(sections).filter(([key]) => !['languages','certifications'].includes(key)).flatMap(([,lines]) => lines).join('\n');
  const known = skills.filter(([, re]) => re.test(sections.skills.length ? sections.skills.join('\n') : skillSource)).map(([s]) => s);
  const driving = text
    .split('\n')
    .filter((l) =>
      /მართვის მოწმობა|კატეგორია|driving licen[cs]e|driver.?s licen[cs]e|водительские права|категори/iu.test(
        l,
      ),
    );
  const contact = [...sections.other, ...sections.contact];
  const name = contact.find(line => /^[\p{L}'’-]+(?:\s+[\p{L}'’-]+){1,3}$/u.test(line) && !headingKey(line) && !Object.values(cities).flat().some(c => contains(fold(line),c))) ?? '';
  const email = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.exec(text)?.[0] ?? '';
  const phone = candidatePhone(/(?:\+|00)?\d[\d ()-]{7,}\d/.exec(contact.join('\n'))?.[0] ?? '');
  // Only a known town or a short "City, Country" line; any other short line
  // (a skill, a sentence) is not a place.
  const city = foundCity || contact.find(isCityCountry) || '';
  const confidence = [text.trim().length > 20, Boolean(email || phone), positions.length > 0, known.length + shortSkills.length > 0].filter(Boolean).length / 4;
  return normalizeProfile({
    name, email, phone, certifications: sections.certifications.slice(0, 30), positions,
    parse: {confidence, reason: !text.trim() ? 'empty' : confidence < .75 ? 'low_confidence' : positions.some(p => /^\d{4}$/.test(p.start)) ? 'approximate_dates' : null},
    years: spans.length
      ? Math.floor(merged.reduce((n, [a, b]) => n + b - a, 0) / 12)
      : null,
    roles: roles.slice(0, 8),
    skills: [...known, ...shortSkills, ...driving],
    languages: detectedLanguages,
    education: sections.education.slice(0, 8),
    educationLevel: educationLevel(sections.education.join('\n')),
    city,
    text,
  });
}
