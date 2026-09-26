import {
  isCyrillicWord,
  isGeorgianWord,
  searchTerms,
  termPattern,
} from './job-intelligence';

// A small reviewed vocabulary, not automatic translation or unrestricted stemming.
// The first entry of each group is the Georgian stem a query is compared with.
const roles = [
  [
    'ბუღალტერ',
    'ბუღალტერი',
    'ბუღალტერია',
    'ბუღალტრ',
    'buxgalter',
    'bugalter',
    'accountant',
    'accounting',
    'бухгалтер',
  ],
  [
    'დეველოპერ',
    'დეველოპერი',
    'developer',
    'პროგრამისტ',
    'პროგრამისტი',
    'programmer',
    'программист',
  ],
  ['დიზაინერ', 'დიზაინერი', 'designer', 'дизайнер'],
  ['მოლარე', 'cashier', 'кассир'],
  ['მიმტან', 'მიმტანი', 'ოფიციანტ', 'waiter', 'waitress', 'официант'],
  ['ბარისტა', 'barista', 'бариста'],
  ['მძღოლ', 'მძღოლი', 'driver', 'водитель'],
  ['კურიერ', 'კურიერი', 'courier', 'курьер'],
  ['მზარეულ', 'მზარეული', 'cook', 'chef', 'повар'],
  ['ექთან', 'ექთანი', 'nurse', 'медсестра'],
  ['ექიმ', 'ექიმი', 'doctor', 'physician', 'врач'],
  ['ფარმაცევტ', 'ფარმაცევტი', 'pharmacist', 'фармацевт'],
  ['რეკრუტერ', 'რეკრუტერი', 'recruiter', 'рекрутер'],
  ['მარკეტინგ', 'მარკეტინგი', 'marketing', 'маркетинг'],
  ['გამყიდველ', 'გამყიდველი', 'salesperson', 'продавец'],
  ['გაყიდვ', 'გაყიდვები', 'გაყიდვების', 'sales', 'продаж'],
  ['მენეჯერ', 'მენეჯერი', 'manager', 'менеджер'],
  ['იურისტ', 'იურისტი', 'lawyer', 'юрист'],
  ['მასწავლებელ', 'მასწავლებელი', 'teacher', 'учитель'],
  [
    'მცველ',
    'მცველი',
    'დაცვის თანამშრომ',
    'დარაჯ',
    'დარაჯი',
    'guard',
    'security',
    'security guard',
    'охранник',
    'сторож',
  ],
  ['ადმინისტრატორ', 'ადმინისტრატორი', 'administrator', 'администратор'],
  ['ოპერატორ', 'ოპერატორი', 'operator', 'оператор'],
  ['ასისტენტ', 'ასისტენტი', 'assistant', 'ассистент'],
  ['კონსულტანტ', 'კონსულტანტი', 'consultant', 'консультант'],
  ['სპეციალისტ', 'სპეციალისტი', 'specialist', 'специалист'],
  ['ელექტრიკოს', 'ელექტრიკოსი', 'electrician', 'электрик'],
  ['შემდუღებელ', 'შემდუღებელი', 'welder', 'сварщик'],
  ['მტვირთავ', 'მტვირთავი', 'loader', 'грузчик'],
  ['დამლაგებელ', 'დამლაგებელი', 'დასუფთავებ', 'cleaner', 'уборщица', 'уборщик'],
  ['ბარმენ', 'ბარმენი', 'bartender', 'бармен'],
  ['ინჟინერ', 'ინჟინერი', 'engineer', 'инженер'],
  ['ტექნიკოს', 'ტექნიკოსი', 'technician', 'техник'],
  ['ანალიტიკოს', 'ანალიტიკოსი', 'analyst', 'аналитик'],
  ['დისპეჩერ', 'დისპეჩერი', 'dispatcher', 'диспетчер'],
  ['კონდიტერ', 'კონდიტერი', 'confectioner', 'кондитер'],
  ['მკერავ', 'მკერავი', 'seamstress', 'швея'],
  ['დალაქ', 'დალაქი', 'პარიკმახერ', 'barber', 'hairdresser', 'парикмахер'],
  ['მთარგმნელ', 'მთარგმნელი', 'თარჯიმან', 'translator', 'переводчик'],
  ['კოპირაიტერ', 'კოპირაიტერი', 'copywriter', 'копирайтер'],
  ['ჟურნალისტ', 'ჟურნალისტი', 'journalist', 'журналист'],
  ['მასაჟისტ', 'მასაჟისტი', 'massage', 'массажист'],
  ['მებაღე', 'gardener', 'садовник'],
];
/* The reviewed roles, each as the word a reader would tap and the stem that
   finds it in a title. They are the vocabulary behind "popular searches": every
   one of them is a phrase this catalogue answers, unlike a raw search log,
   which is mostly typos and one-off phrasings. */
export const roleVocabulary = roles.map((group) => {
  const stem = group[0];
  const written = group[1];
  const label =
    written && written.startsWith(stem) && /^[ა-ჰ]/.test(written)
      ? written
      : stem;
  return { stem, label, genitive: genitiveOf(label) };
});
/* "მოლარის ვაკანსიები" — the form a heading needs. Georgian is regular here for
   occupation names: the nominative -ი or -e gives way to -ის and -ა takes -ს.
   The -ებელი suffix is the one that also drops its own vowel: მასწავლებელი →
   მასწავლებლის, never მასწავლებელის. */
function genitiveOf(word: string) {
  if (word.endsWith('ებელი')) return word.slice(0, -5) + 'ებლის';
  if (word.endsWith('ი') || word.endsWith('ე')) return word.slice(0, -1) + 'ის';
  if (word.endsWith('ა')) return word + 'ს';
  return word + 'ის';
}
// Longest suffix first; a case ending is removed once and only from a word that
// keeps a stem of at least three letters.
// "ოფისებში" is plural and locative at once; -ა and -ია end nouns people type in the
// nominative ("მედიცინა", "სტომატოლოგია") that titles decline ("მედიცინის").
const georgianSuffixes = [
  'ებში',
  'ები',
  'ებს',
  'ის',
  'ში',
  'ით',
  'ია',
  'ს',
  'ი',
  'ა',
  'ე',
];
/* A bare -ს and -ია come off only when four letters remain: "ოფის" is not "ოფი-" (ოფიციანტი),
   "მედია" is not "მედ-" (მედიცინა). A short stem is matched only at a word start, so
   "ძიძა", "პიცა" and "მუშა" may still reach "ძიძის", "პიცის" and "მუშები". */
const letterEndings = new Set(['ია', 'ს']);
export function stemGeorgian(term: string): string {
  if (!isGeorgianWord(term)) return term;
  for (const suffix of georgianSuffixes) {
    if (!term.endsWith(suffix)) continue;
    if (term.length - suffix.length >= (letterEndings.has(suffix) ? 4 : 3))
      return term.slice(0, -suffix.length);
    // A too-short -ია is not retried as -ა: "მედია" stays whole.
    if (suffix === 'ია') return term;
  }
  return term;
}
const vowels = 'აეიოუ';
const consonant = (letter: string | undefined) =>
  !!letter && /[ა-ჰ]/u.test(letter) && !vowels.includes(letter);
/**
 * The same word, written the other way round. Georgian drops the vowel of the
 * last syllable when a noun in -ერი or -ელი is declined — ბუღალტერი becomes
 * ბუღალტრის, მასწავლებელი becomes მასწავლებლის — so a stem taken from one form
 * never occurs in the other, and the two searches used to return different
 * vacancies. The vowel only drops between two consonants, which is why კურიერი
 * (a vowel before the ე) keeps it, and short stems are left alone.
 */
export function syncopeVariant(stem: string): string | null {
  if (!isGeorgianWord(stem) || stem.length < 6) return null;
  const last = stem.at(-1)!;
  if (!'რლ'.includes(last)) return null;
  const before = stem.at(-2);
  if (before === 'ე' && consonant(stem.at(-3))) return stem.slice(0, -2) + last;
  if (consonant(before)) return stem.slice(0, -1) + 'ე' + last;
  return null;
}
/**
 * Alternatives a document can be searched for without changing what matches: a
 * Georgian stem is looked for as plain text, so any longer alternative that
 * contains it is already covered by it and only costs another pass over every
 * description. The reader's own spelling is never dropped — the order reads it
 * back, and relevance ranks a title that carries it above one that only has an
 * equivalent.
 */
function withoutCoveredTerms(terms: string[], keep: readonly string[]) {
  return terms.filter(
    (term, index) =>
      keep.includes(term) ||
      !terms.some(
        (other, position) =>
          position !== index &&
          termPattern(other) === null &&
          term.includes(other),
      ),
  );
}
/** How a word is written here, before any vocabulary is consulted. */
const writtenForms = (term: string) => {
  const stem = stemGeorgian(term);
  const variant = syncopeVariant(stem);
  return variant ? [stem, variant] : [stem];
};
/** The reviewed group a word belongs to, if the vocabulary knows the role. */
export function roleFor(term: string): string[] | undefined {
  const words = [term, ...writtenForms(term)];
  return roles.find((group) =>
    words.some(
      (word) =>
        group.includes(word) ||
        (isGeorgianWord(word) && word.startsWith(group[0])) ||
        (isCyrillicWord(word) &&
          group.some(
            (known) => isCyrillicWord(known) && word.startsWith(known),
          )) ||
        // Georgian typed in Latin letters takes Georgian endings: buxgalteri, bugalteris.
        (/^[a-z]+$/.test(word) &&
          group.some(
            (known) =>
              /^[a-z]{5,}$/.test(known) &&
              word.startsWith(known) &&
              /^(i|is|ebi|ebis|s)$/.test(word.slice(known.length)),
          )),
    ),
  );
}
/** One group per typed word: how the reader wrote it, and everything it may match. */
export type SearchGroup = { own: string[]; all: string[] };
/* Spellings of one name that are not an occupation, so they stay out of the role
   vocabulary (which also names landing pages): a word written joined or apart, and
   employers people type in the other script. */
const aliases = [
  [
    'ქოლცენტრ',
    'ქოლ-ცენტრ',
    'ქოლ ცენტრ',
    'კონტაქტ ცენტრ',
    'კონტაქტ-ცენტრ',
    'call center',
    'call centre',
  ],
  ['tbc', 'თიბისი'],
  ['wissol', 'ვისოლ'],
  ['rompetrol', 'რომპეტროლ'],
  ['lukoil', 'ლუკოილ'],
  ['waikiki', 'ვაიკიკი'],
];
function aliasFor(forms: string[]) {
  return aliases.find((group) =>
    forms.some((form) => group.some((alias) => form.startsWith(alias))),
  );
}
export function searchMatchGroups(query: string): SearchGroup[] {
  return searchTerms(query).map((term) => {
    const own = writtenForms(term);
    return {
      own,
      all: withoutCoveredTerms(
        [
          ...new Set([
            ...own,
            ...(roleFor(term) || []),
            ...(aliasFor([term, ...own]) || []),
          ]),
        ],
        own,
      ),
    };
  });
}
export function searchGroups(query: string): string[][] {
  return searchMatchGroups(query).map((group) => group.all);
}
// Bounded Damerau–Levenshtein: adjacent transpositions count as one edit.
function distance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[a.length][b.length];
}
/**
 * A correction for a query that found nothing. The reviewed roles are the first
 * candidates; `lexicon` adds the words vacancy titles actually use, with how many
 * titles carry each, so "დისსახლისი" and "აღნზრდელი" reach words no reviewer listed.
 * A tie between two equally close words is broken only by a clear majority in the
 * titles; otherwise nothing is guessed.
 */
export function suggestSearch(
  query: string,
  lexicon: ReadonlyMap<string, number> = new Map(),
): string | null {
  const terms = searchTerms(query);
  let changed = false;
  const corrected = terms.map((term) => {
    // A word the vocabulary already knows is spelled well enough to search with.
    if (term.length < 5 || term.length > 30 || roleFor(term)) return term;
    if (lexicon.has(term)) return term;
    /* Every reviewed word is a candidate, the Georgian one above all: it is the
       word people mistype. Only the bare stems are held back, so the offer reads
       as a word — "ბუღალტერი", not "ბუღალტერ" — whenever the group has one. */
    const reviewed = roles
      .flatMap((group) =>
        group.filter(
          (word, index) =>
            index > 0 ||
            !group.some(
              (other, position) =>
                position > 0 && isGeorgianWord(other) && other.startsWith(word),
            ),
        ),
      )
      .filter(
        (word) =>
          isGeorgianWord(word) === isGeorgianWord(term) &&
          isCyrillicWord(word) === isCyrillicWord(term) &&
          !word.includes(' ') &&
          Math.abs(word.length - term.length) <= 2,
      );
    const seen = new Set(reviewed);
    const titled = [...lexicon.keys()].filter(
      (word) =>
        !seen.has(word) &&
        isGeorgianWord(word) === isGeorgianWord(term) &&
        Math.abs(word.length - term.length) <= 2,
    );
    const candidates = [...reviewed, ...titled]
      .map((word) => ({
        word,
        // Declined forms count as the same word: "საატუმრო" is one letter from "სასტუმროს".
        score:
          stemGeorgian(term).length >= 5 && stemGeorgian(word).length >= 5
            ? Math.min(
                distance(term, word),
                distance(stemGeorgian(term), stemGeorgian(word)),
              )
            : distance(term, word),
        // A reviewed role outranks any title word at the same distance.
        weight: seen.has(word) ? Infinity : (lexicon.get(word) ?? 0),
      }))
      .filter((x) => x.score <= (term.length >= 9 ? 2 : 1))
      .sort((a, b) => a.score - b.score || b.weight - a.weight)
      // Two forms of one word (ბუღალტერი, ბუღალტერია) are not a tie between two words.
      .filter(
        (x, i, all) =>
          all.findIndex(
            (y) => stemGeorgian(y.word) === stemGeorgian(x.word),
          ) === i,
      );
    const [best, next] = candidates;
    if (
      !best ||
      best.score === 0 ||
      (next?.score === best.score &&
        (next.weight === Infinity || best.weight < next.weight * 3))
    )
      return term;
    changed = true;
    return best.word;
  });
  return changed ? corrected.join(' ') : null;
}

/* How Georgian is commonly typed on a Latin keyboard. Digraphs are read first; a letter
   that stands for two Georgian ones (t: თ/ტ, k: კ/ქ, p: პ/ფ) takes its usual reading and
   the title lexicon settles the rest through the ordinary spelling correction. */
const latinDigraphs: [string, string][] = [
  ['sh', 'შ'],
  ['ch', 'ჩ'],
  ['gh', 'ღ'],
  ['zh', 'ჟ'],
  ['kh', 'ხ'],
  ['ts', 'ც'],
  ['dz', 'ძ'],
];
const latinLetters: Record<string, string> = {
  a: 'ა',
  b: 'ბ',
  g: 'გ',
  d: 'დ',
  e: 'ე',
  v: 'ვ',
  z: 'ზ',
  t: 'თ',
  i: 'ი',
  k: 'კ',
  l: 'ლ',
  m: 'მ',
  n: 'ნ',
  o: 'ო',
  p: 'პ',
  r: 'რ',
  s: 'ს',
  u: 'უ',
  f: 'ფ',
  q: 'ქ',
  y: 'ყ',
  c: 'ც',
  x: 'ხ',
  j: 'ჯ',
  h: 'ჰ',
  w: 'წ',
};
export function georgianFromLatin(word: string): string {
  let out = '';
  for (let i = 0; i < word.length;) {
    const pair = latinDigraphs.find(([latin]) => word.startsWith(latin, i));
    if (pair) {
      out += pair[1];
      i += 2;
      continue;
    }
    out += latinLetters[word[i]] ?? word[i];
    i++;
  }
  return out;
}
/**
 * A Latin query that found nothing, read as Georgian typed on a Latin keyboard
 * ("mzareuli" → "მზარეული"), then corrected against the titles for the letters
 * the keyboard cannot tell apart. Null for anything that is not all Latin letters.
 */
export function latinGeorgianSearch(
  query: string,
  lexicon: ReadonlyMap<string, number> = new Map(),
): string | null {
  const terms = searchTerms(query);
  if (!terms.length || !terms.every((term) => /^[a-z]{3,}$/.test(term)))
    return null;
  const georgian = terms.map(georgianFromLatin).join(' ');
  return suggestSearch(georgian, lexicon) ?? georgian;
}
