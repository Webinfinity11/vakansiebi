import { cities, cityStem } from './cities';
import { searchUrlValue, searchValueFromUrl } from './search-url';
import { roleVocabulary } from './search-language';
import { subcategoryFor } from './subcategories';
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
    copy: 'დისტანციური სამსახური და ონლაინ სამუშაო სახლიდან სხვადასხვა სფეროში. შეადარე ვაკანსიები და გადაამოწმე განცხადებაში, შესაძლებელია თუ არა სახლიდან გაუსვლელად მუშაობა და რა გრაფიკს გთავაზობს დამსაქმებელი.',
  },
  daily: {
    param: ['salaryPeriod', 'day'],
    after: 'დღიური ანაზღაურებით',
    copy: 'იპოვე სამუშაო დღიური ანაზღაურებით. შეადარე დღიურად ან ცვლის მიხედვით მითითებული თანხა, სამუშაო საათები და მდებარეობა. თანხის გამოთვლის პერიოდი ყოველთვის არ ნიშნავს ყოველდღიურ ჩარიცხვას — გადახდის გრაფიკი გადაამოწმე განცხადებაში.',
  },
  entry: {
    param: ['entryLevel', 'true'],
    after: 'გამოცდილების გარეშე',
    copy: 'ვაკანსიები გამოცდილების გარეშე — პირველი სამსახური ან ახალი პროფესია. შეადარე დამწყებთათვის განკუთვნილი პოზიციები, სადაც გამოცდილება სავალდებულო არ არის ან სწავლება ადგილზეა გათვალისწინებული.',
  },
  paid: {
    param: ['paid', 'true'],
    after: 'მითითებული ხელფასით',
    copy: 'მხოლოდ ის განცხადებები, რომლებშიც დამსაქმებელმა ანაზღაურება მიუთითა. შეგიძლია შეადარო შემოთავაზებული ხელფასები, სანამ განაცხადს გაგზავნი.',
  },
  'part-time': {
    param: ['employment', 'part-time'],
    after: 'ნახევარ განაკვეთზე',
    copy: 'სამსახური ნახევარ განაკვეთზე — შეადარე სამუშაო საათები, ანაზღაურება და მდებარეობა. განცხადებაში გადაამოწმე, რამდენად შეძლებ გრაფიკის სწავლასთან ან სხვა საქმიანობასთან შეთავსებას.',
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
  /* A subcategory id inside `category`: "სტომატოლოგიის ვაკანსიები" is a search
     people make that the whole medical field answers only loosely. It pairs
     with a category and, at most, a city — never a condition or a profession. */
  subcategory: string | null;
  path: string;
};
/* `role` and `subcategory` are the newest and the rarest, so they may be left out. */
type Choice = Omit<Landing, 'path' | 'role' | 'subcategory'> & {
  role?: string | null;
  subcategory?: string | null;
};
// Ten active results is the site's publication floor, not a search-engine rule.
export const minimumLandingJobs = 10;
export type LandingCount = Choice & { count: number };
export function eligibleLandings(rows: readonly LandingCount[]) {
  return rows.filter(
    (row) =>
      row.count >= minimumLandingJobs &&
      // These vocabulary terms name fields already present as category pages.
      !['გაყიდვები', 'მარკეტინგი'].includes(row.role ?? '') &&
      !!landingFor(new URLSearchParams(landingPath(row).slice(2))),
  );
}

export function landingIndexable(
  landing: Landing,
  rows: readonly LandingCount[] | null,
) {
  // Unavailable counts are not evidence that a previously indexable page is thin.
  return (
    rows === null ||
    eligibleLandings(rows).some(
      (row) =>
        landingPath(row) === landing.path && row.count >= minimumLandingJobs,
    )
  );
}
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
/* Each subcategory as the head of "… ვაკანსიები", written out: the labels are
   filter names ("მანიკური / პედიკური"), and a slash does not decline. Where a
   label names a field, the phrase names it; where people search by the worker,
   it names the worker. Joined pairs take -ა before და, as Georgian does. */
export const subcategoryGenitive: Record<string, string> = {
  'tech-security': 'კიბერუსაფრთხოების',
  'tech-business-systems': 'ERP და ბიზნესსისტემების',
  'tech-product': 'ციფრული პროდუქტის, პროექტებისა და UX',
  'tech-data': 'მონაცემთა ანალიტიკისა და ხელოვნური ინტელექტის',
  'tech-qa': 'QA და ტესტირების',
  'tech-development': 'პროგრამირების',
  'tech-systems': 'IT ინფრასტრუქტურისა და ქსელების',
  'tech-support': 'IT მხარდაჭერის',
  'sales-property': 'უძრავი ქონების გაყიდვების',
  'sales-store': 'მაღაზიის მენეჯერის',
  'sales-retail': 'გამყიდველისა და მოლარის',
  'sales-representative': 'სავაჭრო წარმომადგენლისა და მერჩენდაიზერის',
  'sales-operations': 'გაყიდვების მხარდაჭერის',
  'sales-management': 'გაყიდვების მენეჯერის',
  'marketing-promotion': 'პრომოუტერისა და რეკლამის დამრიგებლის',
  'marketing-design': 'გრაფიკული დიზაინერის',
  'marketing-media': 'ფოტო- და ვიდეოწარმოების',
  'marketing-social': 'სოციალური მედიისა და ციფრული რეკლამის',
  'marketing-content': 'კონტენტისა და ჟურნალისტიკის',
  'marketing-pr': 'PR-ისა და ღონისძიებების',
  'marketing-management': 'მარკეტინგისა და ბრენდის მართვის',
  'admin-hr': 'HR-ისა და რეკრუტინგის',
  'admin-reception': 'მიმღებისა და რეგისტრატორის',
  'admin-projects': 'პროექტების მართვის',
  'admin-branch': 'ფილიალისა და სივრცის მართვის',
  'admin-office': 'ოფისის მართვისა და საქმისწარმოების',
  'finance-audit': 'აუდიტის',
  'finance-accounting': 'ბუღალტერიის',
  'finance-risk': 'რისკებისა და დაზღვევის',
  'finance-credit': 'სესხებისა და განვადების',
  'finance-cash': 'სალაროსა და საკასო ოპერაციების',
  'finance-banking': 'ბანკირის',
  'finance-analysis': 'ფინანსური ანალიზის',
  'logistics-customs': 'საბაჟოს, იმპორტისა და ექსპორტის',
  'logistics-driving': 'მძღოლისა და კურიერის',
  'logistics-distribution': 'დისტრიბუციისა და ექსპედიციის',
  'logistics-warehouse': 'საწყობისა და მარაგების',
  'logistics-procurement': 'შესყიდვებისა და მომარაგების',
  'logistics-dispatch': 'ლოჯისტიკოსისა და დისპეტჩერის',
  'service-reception': 'რეცეფციისა და სასტუმროს მართვის',
  'service-kitchen': 'სამზარეულოსა და საცხობის',
  'service-hospitality': 'მიმტანის, ბარისტასა და ბარმენის',
  'service-auto': 'ავტოსამრეცხაოს',
  'service-cleaning': 'დასუფთავების',
  'service-care': 'ძიძისა და მომვლელის',
  'service-support': 'მომხმარებელთა მხარდაჭერის',
  'medical-administration': 'კლინიკის ადმინისტრატორის',
  'medical-commercial': 'სამედიცინო წარმომადგენლის',
  'medical-dental': 'სტომატოლოგიის',
  'medical-nursing': 'საექთნო საქმისა და სანიტარიის',
  'medical-pharmacy': 'ფარმაციის',
  'medical-mental-rehab': 'ფსიქოლოგიისა და რეაბილიტაციის',
  'medical-laboratory': 'ლაბორატორიისა და დიაგნოსტიკის',
  'medical-doctors': 'ექიმების',
  'education-support': 'სწავლის მხარდაჭერის',
  'education-preschool': 'სკოლამდელი აღზრდის',
  'education-vocational': 'პროფესიული სწავლების',
  'education-training': 'ტრენერისა და ინსტრუქტორის',
  'education-academic': 'უმაღლესი განათლების',
  'education-school': 'მასწავლებლისა და რეპეტიტორის',
  'construction-architecture': 'პროექტირებისა და გეოდეზიის',
  'construction-management': 'მშენებლობის მართვის',
  'construction-electrical': 'ელექტრიკოსისა და სანტექნიკოსის',
  'construction-furniture': 'ავეჯისა და დურგლობის',
  'construction-installation': 'მონტაჟისა და შედუღების',
  'construction-finishing': 'მოპირკეთებისა და შეღებვის',
  'construction-structure': 'ბეტონის სამუშაოებისა და მძიმე ტექნიკის',
  'construction-labor': 'სამშენებლო მუშის',
  'security-safety': 'შრომისა და სახანძრო უსაფრთხოების',
  'security-monitoring': 'ვიდეომონიტორინგის',
  'security-cash': 'ინკასატორის',
  'security-guard': 'დაცვისა და დარაჯის',
  'production-engineering': 'საინჟინრო',
  'production-maintenance': 'ტექნიკოსისა და მექანიკოსის',
  'production-sewing': 'კერვისა და ტექსტილის',
  'production-furniture': 'ავეჯის აწყობის',
  'production-packing': 'შეფუთვისა და დაფასოების',
  'production-line': 'საწარმოო ხაზისა და დანადგარების',
  'production-labor': 'საწარმოო მუშის',
  'legal-assistance': 'იურიდიული თანაშემწის',
  'legal-proceedings': 'სასამართლოსა და სამართალწარმოების',
  'legal-practice': 'იურიდიული პრაქტიკის',
  'beauty-management': 'სალონისა და სპა-ცენტრის მართვის',
  'beauty-nails': 'მანიკურისა და პედიკურის',
  'beauty-cosmetics': 'კოსმეტოლოგისა და ვიზაჟისტის',
  'beauty-spa': 'მასაჟისა და სპა-ცენტრის',
  'beauty-hair': 'სტილისტისა და ბარბერის',
};
/** თბილისი → თბილისში, მცხეთა → მცხეთაში: the stem the search already uses. */
export const cityIn = (city: string) => cityStem(city) + 'ში';

export function landingPath(landing: Choice) {
  const params = new URLSearchParams();
  // One spelling per page: the order is fixed, so the canonical never varies.
  if (landing.category)
    params.set('category', searchUrlValue('category', landing.category));
  if (landing.subcategory) params.set('subcategory', landing.subcategory);
  if (landing.city) params.set('city', searchUrlValue('city', landing.city));
  if (landing.role) params.set('q', searchUrlValue('q', landing.role));
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
  const allowed = new Set([
    'category',
    'subcategory',
    'city',
    'q',
    ...traitNames,
  ]);
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
  const category = params.has('category')
    ? searchValueFromUrl('category', params.get('category')!)
    : null;
  const city = params.has('city')
    ? searchValueFromUrl('city', params.get('city')!)
    : null;
  const typed = params.has('q')
    ? searchValueFromUrl('q', params.get('q')!)
    : null;
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
  /* A subcategory lives inside its field, and it is already as narrow as a page
     should be: a city may follow it, a condition or a profession may not. */
  const named = params.has('subcategory')
    ? subcategoryFor(category ?? '', params.get('subcategory'))
    : null;
  if (params.has('subcategory') && (!named || trait || role)) return null;
  const subcategory = named?.id ?? null;
  const landing = { category, city, trait, role, subcategory };
  return { ...landing, path: landingPath(landing) };
}

/** What such a page calls itself, on the page and in a result. */
export function landingHeading(landing: Choice) {
  if (landing.subcategory) {
    const where = landing.city ? ' ' + cityIn(landing.city) : ' საქართველოში';
    return `${subcategoryGenitive[landing.subcategory]} ვაკანსიები${where}`;
  }
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
/* What any list on screen is, said in full — "დისტანციური ვაკანსიები მითითებული
   ხელფასით, დღიური ანაზღაურებით და გამოცდილების გარეშე" — not only the pages
   that may be indexed. A combination of conditions fell back to the site's
   tagline, so the heading stopped saying what the reader had asked for. The
   index stays with the one-condition pages (landingFor); this is the name. Free
   text that is not a profession has no name of its own and keeps the tagline. */
export function searchHeading(filters: SearchFilters): string | null {
  const landing = landingOf(filters);
  if (landing) return landingHeading(landing);
  const typed = filters.query.trim();
  const role = typed ? roleFor(typed) : null;
  const chosen: TraitKey[] = [];
  if (filters.remote) chosen.push('remote');
  if (filters.employment === 'internship') chosen.push('internship');
  if (filters.paid) chosen.push('paid');
  if (filters.salaryPeriod === 'day') chosen.push('daily');
  if (filters.employment === 'part-time') chosen.push('part-time');
  if (filters.entryLevel) chosen.push('entry');
  const befores: string[] = chosen.flatMap((key) => {
    const trait = traits[key];
    return 'before' in trait ? [trait.before] : [];
  });
  const afters: string[] = chosen.flatMap((key) => {
    const trait = traits[key];
    return 'after' in trait ? [trait.after] : [];
  });
  if (filters.employment === 'daily') befores.push('ერთჯერადი სამუშაოს');
  if (filters.salaryFrom !== null)
    afters.push(
      `${String(filters.salaryFrom).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₾-დან`,
    );
  const category =
    filters.category !== 'ყველა' && filters.category !== 'სხვა'
      ? filters.category
      : null;
  const named = filters.subcategory
    ? subcategoryFor(filters.category, filters.subcategory)
    : null;
  const city = (cities as readonly string[]).includes(filters.city)
    ? filters.city
    : null;
  const subject = named
    ? subcategoryGenitive[named.id]
    : role
      ? (role.genitive ?? role.label)
      : category
        ? genitive[category]
        : '';
  if (!subject && !typed && !city && !befores.length && !afters.length)
    return null;
  const conditions =
    afters.length > 1
      ? `${afters.slice(0, -1).join(', ')} და ${afters.at(-1)}`
      : (afters[0] ?? '');
  const where = city
    ? ' ' + cityIn(city)
    : befores.length || afters.length
      ? ''
      : ' საქართველოში';
  const heading = [subject, ...befores, 'ვაკანსიები', conditions]
    .filter(Boolean)
    .join(' ')
    .concat(where);
  // Free text is the reader's own word, quoted rather than declined.
  return typed && !role ? `„${typed}“ — ${heading}` : heading;
}

/* Two sentences of the site's own, so the page answers the search rather than
   repeating its title: a list with nothing to read is the thin page Google is
   right to ignore. */
export function landingCopy(landing: Choice) {
  if (landing.subcategory && landing.category)
    return `${landingHeading(landing)} — ${genitive[landing.category]} ვაკანსიებიდან მხოლოდ ამ მიმართულების აქტიური განცხადებები. სია ყოველდღიურად ახლდება; შეადარე ანაზღაურება, გრაფიკი და პირობები, შემდეგ კი გაეცანი განცხადებას პირველწყაროზე.`;
  if (landing.role) {
    const role = roleFor(landing.role);
    const where = landing.city ? cityIn(landing.city) : 'საქართველოს მასშტაბით';
    return `${role?.genitive ?? landing.role} აქტიური ვაკანსიები ${where}. სია ყოველდღიურად ახლდება დამსაქმებლებისა და დასაქმების საიტებზე გამოქვეყნებული განცხადებებით — შეადარე ანაზღაურება, გრაფიკი და პირობები.`;
  }
  if (landing.trait)
    return (
      (landing.category || landing.city ? `${landingHeading(landing)}. ` : '') +
      traits[landing.trait].copy
    );
  if (landing.category && landing.city)
    return `${genitive[landing.category]} ვაკანსიები ${cityIn(landing.city)}. სია ყოველდღიურად ახლდება დამსაქმებლებისა და დასაქმების საიტებზე გამოქვეყნებული აქტიური განცხადებებით.`;
  if (landing.category)
    return `${genitive[landing.category]} ვაკანსიები საქართველოში — აქტიური განცხადებები ერთ სიაში. შეადარე ანაზღაურება, სამუშაოს ადგილმდებარეობა და პირობები, შემდეგ კი გაეცანი განცხადებას პირველწყაროზე.`;
  return `ვაკანსიები ${cityIn(landing.city!)} — მოძებნე სამსახური პროფესიის, ანაზღაურებისა და სამუშაო გრაფიკის მიხედვით. შეადარე აქტიური განცხადებები და გაეცანი დამსაქმებლის პირობებს.`;
}
/* The snippet under the link: what the list is and how many it holds, within the
   ~160 characters a result shows. The page copy ran to 235 and repeated its own
   heading ("ბუღალტერის ვაკანსიები საქართველოში. ბუღალტერის აქტიური ვაკანსიები…"),
   so the cut fell mid-sentence and the count — the reason to click — was absent. */
export const descriptionLimit = 160;
export function landingDescription(landing: Choice, count?: number) {
  const heading = landingHeading(landing);
  const lead = count
    ? `${heading}: ${new Intl.NumberFormat('ka-GE').format(count)} აქტიური განცხადება.`
    : `${heading}.`;
  for (const tail of [
    ' სია ყოველდღიურად ახლდება — შეადარე ანაზღაურება, გრაფიკი და პირობები.',
    ' სია ყოველდღიურად ახლდება.',
    '',
  ])
    if ((lead + tail).length <= descriptionLimit) return lead + tail;
  return lead;
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
  if (filters.subcategory) params.set('subcategory', filters.subcategory);
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
type DirectoryLink = { path: string; label: string; count: number };
const directoryIndexes = new WeakMap<
  readonly LandingCount[],
  {
    links: Map<string, DirectoryLink>;
    children: Map<string, DirectoryLink[]>;
  }
>();
function parentLandingPath(choice: Choice) {
  if (choice.trait && (choice.category || choice.city))
    return landingPath({ ...choice, trait: null });
  if (choice.city && (choice.category || choice.role))
    return landingPath({ ...choice, city: null });
  // A subcategory's broader page is its own field.
  if (choice.subcategory) return landingPath({ ...choice, subcategory: null });
  return '/';
}
function directoryIndex(rows: readonly LandingCount[]) {
  const held = directoryIndexes.get(rows);
  if (held) return held;
  const links = new Map<string, DirectoryLink>();
  const children = new Map<string, DirectoryLink[]>();
  for (const row of eligibleLandings(rows)) {
    const link = {
      path: landingPath(row),
      label: landingHeading(row).replace(' საქართველოში', ''),
      count: row.count,
    };
    links.set(link.path, link);
    const parent = parentLandingPath(row);
    const group = children.get(parent) ?? [];
    group.push(link);
    children.set(parent, group);
    // A city reader can narrow by field too, without returning to the footer.
    if (row.category && row.city && !row.trait && !row.subcategory) {
      const cityPath = landingPath({
        category: null,
        city: row.city,
        trait: null,
      });
      const cityGroup = children.get(cityPath) ?? [];
      cityGroup.push(link);
      children.set(cityPath, cityGroup);
    }
  }
  const index = { links, children };
  directoryIndexes.set(rows, index);
  return index;
}
/* Every combination has one broader parent. This makes all sitemap entries
   reachable without a global list of hundreds of links on every page. */
export function relatedLandings(
  landing: Landing,
  rows?: readonly LandingCount[] | null,
) {
  if (rows) {
    const index = directoryIndex(rows);
    const parent = index.links.get(parentLandingPath(landing));
    return [
      ...(parent ? [parent] : []),
      ...(index.children.get(landing.path) ?? []),
    ].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  }
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
  if (landing.subcategory)
    nearby.push(
      ...(landing.city
        ? [
            { ...landing, city: null },
            { category: landing.category, city: landing.city, trait: null },
          ]
        : [
            { category: landing.category, city: null, trait: null },
            ...linkedCities.slice(0, 4).map((city) => ({ ...landing, city })),
          ]),
    );
  else if (landing.category)
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
export function landingLinks(rows?: readonly LandingCount[] | null) {
  if (rows)
    return eligibleLandings(rows)
      .filter(
        (row) =>
          !row.subcategory &&
          [row.category, row.city, row.trait, row.role].filter(Boolean)
            .length === 1,
      )
      .sort(
        (a, b) =>
          b.count - a.count || landingPath(a).localeCompare(landingPath(b)),
      )
      .map((row) => ({
        path: landingPath(row),
        label: landingHeading(row).replace(' საქართველოში', ''),
        count: row.count,
      }));
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
