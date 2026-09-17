import { cities, cityStem } from './cities';
import { roleVocabulary } from './search-language';
import { categories } from './types';
import type { SearchFilters } from './personal-space';

/* A search this site is willing to be found by. Readers do not look for "a job
   board"; they look for "გაყიდვების ვაკანსიები თბილისში" or "ვაკანსიები დღიური
   ანაზღაურებით". Those pages exist already as filters of the list — they were
   simply closed to search engines, every one of them, to keep the endless
   combinations of salary, sort and free text out of the index. This is the
   short, reviewed list that is worth opening, each page naming itself and
   saying in its own words what it holds. */

/* The conditions people search by name. One per page: a reader looking for
   daily pay is not also looking for an internship, and every extra pairing
   multiplies pages that say almost the same thing. */
export const traits = {
  remote: {
    param: ['remote', 'true'],
    before: 'დისტანციური',
    copy: 'სამუშაოები, რომელთა შესრულებაც სახლიდან ან ნებისმიერი სხვა ადგილიდან შეიძლება. დისტანციურად მუშაობის შესაძლებლობას დამსაქმებელი თავად უთითებს განცხადებაში.',
  },
  daily: {
    param: ['salaryPeriod', 'day'],
    after: 'დღიური ანაზღაურებით',
    copy: 'სამუშაოები, რომელთა ანაზღაურებაც დღიურად ან ცვლის მიხედვით გამოითვლება — კურიერობა, დარბაზის მომსახურება, ტვირთის დატვირთვა-გადმოტვირთვა, პრომოაქციებში მონაწილეობა და სხვა. ანაზღაურება ყოველთვის მითითებულია სიაში.',
  },
  entry: {
    param: ['entryLevel', 'true'],
    after: 'გამოცდილების გარეშე',
    copy: 'ვაკანსიები დამწყებთათვის: სამუშაო გამოცდილება სავალდებულო არ არის ან სწავლება ადგილზეა გათვალისწინებული. ეს პოზიციები შესაფერისია მათთვის, ვინც პირველ სამსახურს ეძებს ან პროფესიის შეცვლა სურს.',
  },
  paid: {
    param: ['paid', 'true'],
    after: 'მითითებული ხელფასით',
    copy: 'მხოლოდ ის განცხადებები, რომლებშიც დამსაქმებელმა ანაზღაურება მიუთითა. შეგიძლია შეადარო შემოთავაზებული ხელფასები, სანამ განაცხადს გაგზავნი.',
  },
  'part-time': {
    param: ['employment', 'part-time'],
    after: 'ნახევარ განაკვეთზე',
    copy: 'სამუშაოები არასრულ განაკვეთზე, მოქნილი გრაფიკით. ასეთი სამუშაოს შეთავსება სწავლასთან ან სხვა საქმიანობასთან შეგიძლია.',
  },
  internship: {
    param: ['employment', 'internship'],
    before: 'სტაჟირების',
    copy: 'სტუდენტებისა და დამწყებთათვის განკუთვნილი სტაჟირებისა და პრაქტიკის პროგრამები. გაეცანი ანაზღაურებისა და მონაწილეობის პირობებს შესაბამის განცხადებაში.',
  },
} as const satisfies Record<
  string,
  {
    param: readonly [string, string];
    before?: string;
    after?: string;
    copy: string;
  }
>;
export type TraitKey = keyof typeof traits;
export const traitKeys = Object.keys(traits) as TraitKey[];

export type Landing = {
  category: string | null;
  city: string | null;
  trait: TraitKey | null;
  /* A profession, as a reader names it. "მოლარის ვაკანსიები თბილისში" is what
     people type into Google — far more often than the name of a whole field —
     and it is the one search the board answered only through free text, which
     stays out of the index for good reason. A word from the reviewed vocabulary
     is not free text: it is a term with a page behind it. */
  role: string | null;
  path: string;
};
/* `role` is the newest of the four and the rarest, so it may be left out. */
type Choice = Omit<Landing, 'path' | 'role'> & { role?: string | null };
const roleFor = (value: string) =>
  roleVocabulary.find(
    (role) => role.label === value.normalize('NFKC').trim().toLowerCase(),
  ) ?? null;

/* Category modifiers, written out rather than derived: headings need genitive
   phrases for some fields and adjectives for others. */
const genitive: Record<string, string> = {
  ტექნოლოგიები: 'ტექნოლოგიების სფეროს',
  გაყიდვები: 'გაყიდვების',
  მარკეტინგი: 'მარკეტინგის',
  ადმინისტრაცია: 'ადმინისტრაციული',
  ფინანსები: 'ფინანსური',
  ლოჯისტიკა: 'ლოჯისტიკის',
  მომსახურება: 'მომსახურების',
  სამედიცინო: 'სამედიცინო',
  განათლება: 'განათლების სფეროს',
  მშენებლობა: 'სამშენებლო',
  დაცვა: 'დაცვის',
  წარმოება: 'წარმოების',
  იურიდიული: 'იურიდიული',
  სილამაზე: 'სილამაზის სფეროს',
};
/** თბილისი → თბილისში, მცხეთა → მცხეთაში: the stem the search already uses. */
export const cityIn = (city: string) => cityStem(city) + 'ში';

export function landingPath(landing: Choice) {
  const params = new URLSearchParams();
  // One spelling per page: the order is fixed, so the canonical never varies.
  if (landing.category) params.set('category', landing.category);
  if (landing.city) params.set('city', landing.city);
  if (landing.role) params.set('q', landing.role);
  if (landing.trait) {
    const [key, value] = traits[landing.trait].param;
    params.set(key, value);
  }
  return '/' + (params.size ? '?' + params : '');
}

/* The address a crawler asked for, as a landing page — or null, which means the
   list stays out of the index as it always has. */
export function landingFor(params: URLSearchParams): Landing | null {
  // Two conditions share the `employment` key, so a parameter is recognised by
  // its name and its value together, never by the name alone.
  const traitNames = new Set<string>(
    traitKeys.map((key) => traits[key].param[0]),
  );
  const allowed = new Set(['category', 'city', 'q', ...traitNames]);
  let trait: TraitKey | null = null;
  for (const [key, value] of params) {
    const ignorable =
      (key === 'page' && value === '1') ||
      key.startsWith('utm_') ||
      ['gclid', 'fbclid'].includes(key);
    if (ignorable) continue;
    if (!allowed.has(key)) return null;
    if (!traitNames.has(key)) continue;
    const named = traitKeys.find(
      (candidate) =>
        traits[candidate].param[0] === key &&
        traits[candidate].param[1] === value,
    );
    // One condition per page, and only the value that names it.
    if (!named || trait) return null;
    trait = named;
  }
  const category = params.get('category');
  const city = params.get('city');
  const typed = params.get('q');
  // Only a word the vocabulary knows; anything else is a search, not a page.
  const role = typed === null ? null : (roleFor(typed)?.label ?? null);
  if (typed !== null && !role) return null;
  if (
    category !== null &&
    !(categories as readonly string[]).includes(category)
  )
    return null;
  if (city !== null && !(cities as readonly string[]).includes(city))
    return null;
  // "სხვა" names everything the categories could not place; it describes no search.
  if (category === 'სხვა') return null;
  /* A field, a city and a condition together is the shape ss.ge publishes most
     of — "ლოჯისტიკის ვაკანსიები დღიური ანაზღაურებით ბათუმში" is a search, not a
     stray combination. What keeps it honest is the sitemap, which counts each
     one and lists only those a reader would find something on. */
  /* A profession already names the work; a field on top of it is a narrower way
     of saying the same thing, and a condition on top of that empties the page. */
  if (role && (category || trait)) return null;
  if (!category && !city && !trait && !role) return null;
  const landing = { category, city, trait, role };
  return { ...landing, path: landingPath(landing) };
}

/** What such a page calls itself, on the page and in a result. */
export function landingHeading(landing: Choice) {
  if (landing.role) {
    const role = roleFor(landing.role);
    const where = landing.city ? ' ' + cityIn(landing.city) : ' საქართველოში';
    return `${role?.genitive ?? landing.role} ვაკანსიები${where}`;
  }
  const trait = landing.trait ? traits[landing.trait] : null;
  const before = trait && 'before' in trait ? trait.before + ' ' : '';
  const after = trait && 'after' in trait ? ' ' + trait.after : '';
  const field = landing.category ? genitive[landing.category] + ' ' : '';
  const where = landing.city
    ? ' ' + cityIn(landing.city)
    : // The country is worth saying only when nothing else narrows the list.
      trait
      ? ''
      : ' საქართველოში';
  return `${field}${before}ვაკანსიები${after}${where}`;
}
/* Two sentences of the site's own, so the page answers the search rather than
   repeating its title: a list with nothing to read is the thin page Google is
   right to ignore. */
export function landingCopy(landing: Choice) {
  if (landing.role) {
    const role = roleFor(landing.role);
    const where = landing.city ? cityIn(landing.city) : 'საქართველოს მასშტაბით';
    return `${role?.genitive ?? landing.role} აქტიური ვაკანსიები ${where}. სია ყოველდღიურად ახლდება დამსაქმებლებისა და დასაქმების საიტებზე გამოქვეყნებული განცხადებებით — შეადარე ანაზღაურება, გრაფიკი და პირობები.`;
  }
  if (landing.trait) return traits[landing.trait].copy;
  if (landing.category && landing.city)
    return `${genitive[landing.category]} ვაკანსიები ${cityIn(landing.city)}. სია ყოველდღიურად ახლდება დამსაქმებლებისა და დასაქმების საიტებზე გამოქვეყნებული აქტიური განცხადებებით.`;
  if (landing.category)
    return `${genitive[landing.category]} ვაკანსიები საქართველოში — აქტიური განცხადებები ერთ სიაში. შეადარე ანაზღაურება, სამუშაოს ადგილმდებარეობა და პირობები, შემდეგ კი გაეცანი განცხადებას პირველწყაროზე.`;
  return `აქტიური ვაკანსიები ${cityIn(landing.city!)} — ყველა სფერო ერთ სიაში. სია ყოველდღიურად ახლდება დამსაქმებლებისა და დასაქმების საიტებზე გამოქვეყნებული განცხადებებით.`;
}
export function landingDescription(landing: Choice) {
  return `${landingHeading(landing)}. ${landingCopy(landing)}`.slice(0, 300);
}

/** Whether the list on screen is exactly this landing page, and may name itself. */
export function landingOf(filters: SearchFilters): Landing | null {
  const params = new URLSearchParams();
  if (filters.query) {
    const role = roleFor(filters.query);
    if (!role) return null;
    params.set('q', role.label);
  }
  if (filters.category !== 'ყველა') params.set('category', filters.category);
  if (filters.city !== 'ყველა') params.set('city', filters.city);
  if (filters.remote) params.set('remote', 'true');
  if (filters.paid) params.set('paid', 'true');
  if (filters.entryLevel) params.set('entryLevel', 'true');
  if (filters.employment !== 'all')
    params.set('employment', filters.employment);
  if (filters.salaryPeriod === 'day') params.set('salaryPeriod', 'day');
  if (
    filters.source !== 'ყველა' ||
    filters.salaryFrom !== null ||
    filters.salaryTo !== null ||
    filters.deep ||
    filters.postedWithin ||
    filters.subcategory ||
    // A page that is sorted another way is one reader's view, not the page.
    filters.sort !== 'უახლესი'
  )
    return null;
  return landingFor(params);
}

/* The lists worth linking to from every page: each category, the cities with a
   catalogue of their own, and each condition people search by name. A crawler
   that never reaches a page cannot index it, and a sitemap alone is a weaker
   signal than a link a reader can follow. Kept to combinations that are always
   populated; the narrower pairs are discovered through the sitemap, which
   counts them first. */
export const linkedCities = [
  'თბილისი',
  'ბათუმი',
  'ქუთაისი',
  'რუსთავი',
  'ზუგდიდი',
  'გორი',
] as const;
/* The professions readers name most often, by our own search log and by how
   much of the catalogue answers them. */
export const linkedRoles = [
  'მძღოლი',
  'მოლარე',
  'ადმინისტრატორი',
  'კონსულტანტი',
  'ოპერატორი',
  'მენეჯერი',
  'კურიერი',
  'დიზაინერი',
  'ბუღალტერი',
  'მზარეული',
  'მიმტანი',
  'დამლაგებელი',
] as const;
/* Which professions belong to which field. A field is an abstraction — a reader
   searches for "მძღოლი", not for "ლოჯისტიკა" — so every field's page offers the
   words people actually type, and every profession's page offers the cities.
   The pairing is written out rather than counted: a profession that merely
   appears in a field's listings is not what that field is about. */
const fieldRoles: Record<string, readonly string[]> = {
  ტექნოლოგიები: ['დეველოპერი', 'დიზაინერი', 'ანალიტიკოსი', 'ტექნიკოსი'],
  გაყიდვები: ['გამყიდველი', 'კონსულტანტი', 'მოლარე', 'მენეჯერი'],
  მარკეტინგი: ['მარკეტინგი', 'კოპირაიტერი', 'დიზაინერი', 'ჟურნალისტი'],
  ადმინისტრაცია: ['ადმინისტრატორი', 'ასისტენტი', 'ოპერატორი', 'რეკრუტერი'],
  ფინანსები: ['ბუღალტერი', 'ანალიტიკოსი', 'კონსულტანტი', 'მენეჯერი'],
  ლოჯისტიკა: ['მძღოლი', 'კურიერი', 'მტვირთავი', 'დისპეჩერი'],
  მომსახურება: ['მიმტანი', 'ბარისტა', 'მზარეული', 'ბარმენი', 'დამლაგებელი'],
  სამედიცინო: ['ექიმი', 'ექთანი', 'ფარმაცევტი', 'მასაჟისტი'],
  განათლება: ['მასწავლებელი', 'მთარგმნელი'],
  მშენებლობა: ['ელექტრიკოსი', 'შემდუღებელი', 'ინჟინერი', 'ტექნიკოსი'],
  დაცვა: ['მცველი'],
  წარმოება: ['მკერავი', 'კონდიტერი', 'შემდუღებელი', 'მტვირთავი'],
  იურიდიული: ['იურისტი'],
  სილამაზე: ['დალაქი', 'მასაჟისტი'],
};
/* Where this page can lead next — the same search narrowed one more way, or the
   professions the field is made of. It is the difference between a page that
   ends and a site that goes on, for a reader and for a crawler alike. */
export function relatedLandings(landing: Landing) {
  const nearby: Choice[] = [];
  if (landing.role && !landing.city)
    nearby.push(
      ...linkedCities.map((city) => ({
        category: null,
        city,
        trait: null,
        role: landing.role,
      })),
    );
  if (landing.role && landing.city)
    nearby.push({
      category: null,
      city: null,
      trait: null,
      role: landing.role,
    });
  if (landing.category)
    nearby.push(
      ...(fieldRoles[landing.category] ?? []).map((role) => ({
        category: null,
        city: landing.city,
        trait: null,
        role,
      })),
      ...(landing.city
        ? [{ category: landing.category, city: null, trait: null, role: null }]
        : linkedCities.slice(0, 4).map((city) => ({
            category: landing.category,
            city,
            trait: null,
            role: null,
          }))),
    );
  if (landing.city && !landing.category && !landing.role)
    nearby.push(
      ...linkedRoles.slice(0, 6).map((role) => ({
        category: null,
        city: landing.city,
        trait: null,
        role,
      })),
    );
  if (landing.trait)
    nearby.push(
      ...(landing.city
        ? [{ category: null, city: null, trait: landing.trait, role: null }]
        : linkedCities.slice(0, 4).map((city) => ({
            category: null,
            city,
            trait: landing.trait,
            role: null,
          }))),
    );
  const seen = new Set([landing.path]);
  return nearby
    .filter((choice) => {
      const path = landingPath(choice);
      if (seen.has(path) || !landingFor(new URLSearchParams(path.slice(2))))
        return false;
      seen.add(path);
      return true;
    })
    .map((choice) => ({
      path: landingPath(choice),
      label: landingHeading(choice).replace(' საქართველოში', ''),
    }))
    .slice(0, 10);
}
export function landingLinks() {
  const links: Choice[] = [
    ...categories
      .filter((category) => category !== 'სხვა')
      .map((category) => ({ category, city: null, trait: null, role: null })),
    ...linkedCities.map((city) => ({
      category: null,
      city,
      trait: null,
      role: null,
    })),
    ...traitKeys.map((trait) => ({
      category: null,
      city: null,
      trait,
      role: null,
    })),
    ...linkedRoles.map((role) => ({
      category: null,
      city: null,
      trait: null,
      role,
    })),
  ];
  return links.map((landing) => ({
    path: landingPath(landing),
    /* The page calls itself "… ვაკანსიები საქართველოში"; a row of links does not
       need to say the country twelve times. */
    label: landingHeading(landing).replace(' საქართველოში', ''),
  }));
}
