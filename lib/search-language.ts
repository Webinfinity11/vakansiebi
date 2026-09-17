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
  ['მცველ', 'მცველი', 'დაცვის თანამშრომ', 'security guard', 'охранник'],
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
const georgianSuffixes = ['ები', 'ებს', 'ის', 'ში', 'ით', 'ს', 'ი'];
export function stemGeorgian(term: string): string {
  if (!isGeorgianWord(term)) return term;
  for (const suffix of georgianSuffixes)
    if (term.endsWith(suffix) && term.length - suffix.length >= 3)
      return term.slice(0, -suffix.length);
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
          )),
    ),
  );
}
/** One group per typed word: how the reader wrote it, and everything it may match. */
export type SearchGroup = { own: string[]; all: string[] };
export function searchMatchGroups(query: string): SearchGroup[] {
  return searchTerms(query).map((term) => {
    const own = writtenForms(term);
    return {
      own,
      all: withoutCoveredTerms(
        [...new Set([...own, ...(roleFor(term) || [])])],
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
export function suggestSearch(query: string): string | null {
  const terms = searchTerms(query);
  let changed = false;
  const corrected = terms.map((term) => {
    // A word the vocabulary already knows is spelled well enough to search with.
    if (term.length < 5 || term.length > 30 || roleFor(term)) return term;
    /* Every reviewed word is a candidate, the Georgian one above all: it is the
       word people mistype. Only the bare stems are held back, so the offer reads
       as a word — "ბუღალტერი", not "ბუღალტერ" — whenever the group has one. */
    const candidates = roles
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
      )
      .map((word) => ({ word, score: distance(term, word) }))
      .filter((x) => x.score <= (term.length >= 9 ? 2 : 1))
      .sort((a, b) => a.score - b.score);
    if (
      !candidates[0] ||
      candidates[0].score === 0 ||
      candidates[1]?.score === candidates[0].score
    )
      return term;
    changed = true;
    return candidates[0].word;
  });
  return changed ? corrected.join(' ') : null;
}
