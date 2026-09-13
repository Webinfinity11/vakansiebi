import { companyKey } from './company-key';
import { genericCompanyKeys } from './company-logo-identity';

/* One employer, however a source spells it. Only the spelling is folded: case, quotes, dashes,
   dots and a legal form (შპს, სს, ააიპ, სსიპ, ი/მ, LLC, Ltd, JSC). The legal form is removed as a
   whole word only, so "იმედი" keeps its "იმ". */
const legalForm =
  /(^|[^\p{L}\p{N}])(შ\.?\s?პ\.?\s?ს|ს\.?\s?ს\.?\s?ი\.?\s?პ|ა\.?\s?ა\.?\s?ი\.?\s?პ|ს\.?\s?ს|ი\s?[/.]\s?მ|llc|ltd|jsc|inc)\.?(?=[^\p{L}\p{N}]|$)/giu;
export function employerKey(name: string) {
  return companyKey(name.normalize('NFKC').replace(legalForm, '$1 '));
}

/* A Latin spelling written in Georgian letters, so "Midea" and "მიდეა" meet. Exact letters only:
   "cash" becomes "ქაშ", not "ქეშ" — a guess at vowels would join names that are not the same. */
const latin: Record<string, string> = {
  sh: 'შ',
  ch: 'ჩ',
  ts: 'ც',
  kh: 'ხ',
  gh: 'ღ',
  zh: 'ჟ',
  a: 'ა',
  b: 'ბ',
  c: 'ქ',
  d: 'დ',
  e: 'ე',
  f: 'ფ',
  g: 'გ',
  h: 'ჰ',
  i: 'ი',
  j: 'ჯ',
  k: 'კ',
  l: 'ლ',
  m: 'მ',
  n: 'ნ',
  o: 'ო',
  p: 'პ',
  q: 'ქ',
  r: 'რ',
  s: 'ს',
  t: 'თ',
  u: 'უ',
  v: 'ვ',
  w: 'ვ',
  x: 'ქს',
  y: 'ი',
  z: 'ზ',
};
export function scriptKey(key: string) {
  return key
    .replace(/sh|ch|ts|kh|gh|zh|[a-z]/g, (m) => latin[m])
    .replace(/კ/g, 'ქ');
}

/* ss.ge puts the poster's own name where an employer would be. One word with no legal form and no
   logo, seen only there, is a person: twelve ads by "ნინო" carry no logo, while SOCAR, ტორტინი and
   შანგრილა carry one on every ad. Twelve people called ნინო are not one company. */
export function personalName(
  name: string,
  sources: readonly string[],
  hasLogo = false,
) {
  const words = name
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/);
  legalForm.lastIndex = 0;
  return (
    !hasLogo &&
    sources.length > 0 &&
    sources.every((s) => s === 'ss') &&
    words.length === 1 &&
    !legalForm.test(name)
  );
}

export function employerIdentity(
  name: string,
  sources: readonly string[],
  hasLogo = false,
) {
  const key = employerKey(name);
  if (
    key.length < 2 ||
    genericCompanyKeys.has(key) ||
    personalName(name, sources, hasLogo)
  )
    return null;
  return scriptKey(key);
}
