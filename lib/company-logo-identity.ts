/* Names that do not identify an employer: a placeholder a form was filled with, a kind of
   business, or a first name. Two vacancies sharing one of these are not the same employer, so
   neither a logo nor duplicate grouping may join them on it. Keys are lower case letters and
   digits only, as produced by the normalisation below and by the grouping in search-plan. */
export const genericCompanyKeys = new Set([
  'კომპანია',
  'company',
  'კერძოპირი',
  'ფიზიკურიპირი',
  'დამსაქმებელი',
  'employer',
  'privateperson',
  'რესტორანი',
  'restaurant',
  'სასტუმრო',
  'hotel',
  'მაღაზია',
  'shop',
  'ირინა',
  'გიორგი',
  'ნიკა',
  'თამარი',
]);
// Conservative exact identities only. Do not use substring/fuzzy matches for branding.
export function logoCompanyKey(name: string) {
  const normalized = name
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/^(შპს|სსიპ|სს|llc|ltd|jsc)\s+/, '')
    .replace(/[\s,.]+(llc|ltd|jsc)\.?$/, '');
  // Unsupported alphabets remain unlinked, rather than collapsing different names.
  if (/[^a-z0-9ა-ჰ\p{P}\p{Z}\p{S}]/u.test(normalized)) return '';
  const key = normalized.replace(/[^a-z0-9ა-ჰ]/g, '');
  if (key.length < 3 || genericCompanyKeys.has(key)) return '';
  return key;
}
// Verified on the bank's own site, not inferred from the vacancy description.
// https://bankofgeorgia.ge/blog/ supplies this logo in its header.
export function officialCompanyLogo(
  name: string,
): { logoUrl: string; origin: string } | null {
  const key = logoCompanyKey(name);
  // Public logo labelled "Credo Logo" on https://credobank.ge/.
  if (['კრედობანკი', 'credobank'].includes(key))
    return {
      logoUrl:
        'https://imagedelivery.net/d_EE26O5eWcJDRYn-qMBOg/3732102c-3667-4edc-cc08-b44198044600/public',
      origin: 'https://credobank.ge/',
    };
  if (['საქართველოსბანკი', 'bankofgeorgia'].includes(key))
    return {
      logoUrl:
        'https://bankofgeorgia.ge/blog/app/uploads/2025/08/orange_logo.svg',
      origin: 'https://bankofgeorgia.ge/blog/',
    };
  return null;
}
