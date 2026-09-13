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
/* Georgian adds ი to a borrowed name that ends in a consonant — გრუპ and გრუპი, ვენდის and
   ვენდისი — so that closing ი after a consonant is not part of the name. Latin letters cannot tell
   Georgian's paired consonants apart (t is თ or ტ, p is ფ or პ, k is ქ or კ, ts is ც or წ, ch is ჩ
   or ჭ), so each pair counts as one letter: "Bene Comfort" and "ბენე კომფორტი" meet. */
export function scriptKey(key: string) {
  return key
    .replace(/sh|ch|ts|kh|gh|zh|[a-z]/g, (m) => latin[m])
    .replace(/[კყ]/g, 'ქ')
    .replace(/ტ/g, 'თ')
    .replace(/ფ/g, 'პ')
    .replace(/წ/g, 'ც')
    .replace(/ჭ/g, 'ჩ')
    .replace(/(?<=[^აეიოუ])ი$/u, '');
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

/* Names that may be one employer but cannot be proven so by spelling alone: the same consonants
   ("ჯიბე ქეშ & ქერი" and "Jibe Cash & Carry" as ჯბქშქრ), or one letter apart in a longer name.
   These are only offered to a person; nothing here joins two employers by itself. */
export function skeleton(identity: string) {
  return identity.replace(/[აეიოუ]/g, '').replace(/(.)\1+/gu, '$1');
}
function oneEditApart(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return (
    a.slice(i + 1) === b.slice(i + 1) ||
    a.slice(i + 1) === b.slice(i) ||
    a.slice(i) === b.slice(i + 1)
  );
}
export function candidatePairs(identities: readonly string[]) {
  const pairs = new Set<string>();
  const add = (a: string, b: string) => {
    if (a !== b) pairs.add(a < b ? `${a}\n${b}` : `${b}\n${a}`);
  };
  const bySkeleton = new Map<string, string[]>();
  const byStart = new Map<string, string[]>();
  for (const id of identities) {
    const s = skeleton(id);
    if (s.length >= 3) bySkeleton.set(s, [...(bySkeleton.get(s) || []), id]);
    if (id.length >= 6)
      byStart.set(id.slice(0, 2), [...(byStart.get(id.slice(0, 2)) || []), id]);
  }
  for (const ids of bySkeleton.values())
    for (const a of ids) for (const b of ids) add(a, b);
  for (const ids of byStart.values())
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        if (oneEditApart(ids[i], ids[j])) add(ids[i], ids[j]);
  return [...pairs].map((p) => p.split('\n') as [string, string]);
}

/* Each identity's representative once a person has joined some of them: the alphabetically first
   member of its joined set, so the answer does not depend on the order decisions were made in. */
export function mergedIdentities(
  merges: readonly (readonly [string, string])[],
) {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    return p === x ? x : find(p);
  };
  for (const [a, b] of merges) {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }
  return (id: string) => find(id);
}
