/** Cities offered as filter options, shared by the board and the search plan. */
export const cities = [
  'თბილისი',
  'ბათუმი',
  'ქუთაისი',
  'რუსთავი',
  'გორი',
  'ზუგდიდი',
  'ფოთი',
  'თელავი',
  'კასპი',
  'მცხეთა',
  'ახალციხე',
  'ბორჯომი',
  'ოზურგეთი',
] as const;
/** The option meaning "a city that is not in the list above", never a literal city name. */
export const otherCity = 'სხვა';
export const cityOptions: readonly string[] = [...cities, otherCity];
/**
 * Georgian place names decline by suffix (თბილისი → თბილისში, თბილისის), so a
 * posting text is matched on the stem: a trailing nominative -ი is dropped.
 */
export function cityStem(name: string) {
  const city = name.normalize('NFKC').trim().toLowerCase();
  return city.length > 3 && city.endsWith('ი') ? city.slice(0, -1) : city;
}
