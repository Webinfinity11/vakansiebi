import {
  isCyrillicWord,
  isGeorgianWord,
  searchTerms,
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
  ['მიმტან', 'მიმტანი', 'waiter', 'waitress', 'официант'],
  ['ბარისტა', 'barista'],
  ['მძღოლ', 'მძღოლი', 'driver', 'водитель'],
  ['კურიერ', 'კურიერი', 'courier', 'курьер'],
  ['მზარეულ', 'მზარეული', 'cook', 'chef', 'повар'],
  ['ექთან', 'ექთანი', 'nurse', 'медсестра'],
  ['ექიმ', 'ექიმი', 'doctor', 'physician', 'врач'],
  ['ფარმაცევტ', 'ფარმაცევტი', 'pharmacist', 'фармацевт'],
  ['რეკრუტერ', 'რეკრუტერი', 'recruiter'],
  ['მარკეტინგ', 'მარკეტინგი', 'marketing', 'маркетинг'],
  ['გამყიდველ', 'გამყიდველი', 'salesperson', 'продавец'],
  ['გაყიდვ', 'გაყიდვები', 'გაყიდვების', 'sales', 'продаж'],
  ['მენეჯერ', 'მენეჯერი', 'manager', 'менеджер'],
  ['იურისტ', 'იურისტი', 'lawyer', 'юрист'],
  ['მასწავლებელ', 'მასწავლებელი', 'teacher', 'учитель'],
  ['მცველ', 'მცველი', 'დაცვის თანამშრომ', 'security guard', 'охранник'],
];
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
export function searchGroups(query: string): string[][] {
  return searchTerms(query).map((term) => {
    const stem = stemGeorgian(term);
    const role = roles.find(
      (group) =>
        group.includes(term) ||
        group.includes(stem) ||
        (isGeorgianWord(stem) && stem.startsWith(group[0])) ||
        (isCyrillicWord(term) &&
          group.some((word) => isCyrillicWord(word) && term.startsWith(word))),
    );
    return [...new Set([stem, ...(role || [])])];
  });
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
    if (
      term.length < 5 ||
      term.length > 30 ||
      searchGroups(term)[0]?.length > 1
    )
      return term;
    const candidates = roles
      .flatMap((group) => group.slice(1))
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
