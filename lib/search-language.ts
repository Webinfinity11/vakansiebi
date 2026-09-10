import { searchTerms } from './job-intelligence';

// A small reviewed vocabulary, not automatic translation or unrestricted stemming.
const roles = [
  ['ბუღალტერ', 'ბუღალტერი', 'ბუღალტერია', 'accountant', 'accounting'],
  [
    'დეველოპერ',
    'დეველოპერი',
    'developer',
    'პროგრამისტ',
    'პროგრამისტი',
    'programmer',
  ],
  ['დიზაინერ', 'დიზაინერი', 'designer'],
  ['მოლარე', 'cashier'],
  ['მიმტან', 'მიმტანი', 'waiter', 'waitress'],
  ['ბარისტა', 'barista'],
  ['მძღოლ', 'მძღოლი', 'driver'],
  ['კურიერ', 'კურიერი', 'courier'],
  ['მზარეულ', 'მზარეული', 'cook', 'chef'],
  ['ექთან', 'ექთანი', 'nurse'],
  ['ფარმაცევტ', 'ფარმაცევტი', 'pharmacist'],
  ['რეკრუტერ', 'რეკრუტერი', 'recruiter'],
  ['მარკეტინგ', 'მარკეტინგი', 'marketing'],
];
export function searchGroups(query: string): string[][] {
  return searchTerms(query).map((term) => {
    const role = roles.find(
      (group) =>
        group.includes(term) ||
        (/^[ა-ჰ]+$/.test(term) && term.startsWith(group[0])),
    );
    return [...new Set([term, ...(role || [])])];
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
          /^[ა-ჰ]+$/.test(word) === /^[ა-ჰ]+$/.test(term) &&
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
