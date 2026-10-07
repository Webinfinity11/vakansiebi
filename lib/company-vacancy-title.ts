import { companyDisplayName } from './company-display-name';
// Reviewed possessives: arbitrary employer names (especially mixed scripts and
// legal names) cannot be safely declined by appending a Georgian suffix.
const possessives = new Map([
  ['თიბისი', 'თიბისის'],
  ['თიბისი ბანკი', 'თიბისი ბანკის'],
  ['კრედო ბანკი', 'კრედო ბანკის'],
  ['საქართველოს ბანკი', 'საქართველოს ბანკის'],
  ['გუდვილი', 'გუდვილის'],
  ['ნიკორა', 'ნიკორას'],
  ['ნიკორა ტრეიდი', 'ნიკორა ტრეიდის'],
  ['ბიბლუსი', 'ბიბლუსის'],
  ['ზღაპარი', 'ზღაპარის'],
  ['ენგადი', 'ენგადის'],
  ['აგროჰაბი', 'აგროჰაბის'],
  ['იფქლი', 'იფქლის'],
]);

export function companyVacancyTitle(name: string): string {
  const clean = companyDisplayName(name);
  const possessive = possessives.get(clean.toLocaleLowerCase('ka'));
  return possessive ? `${possessive} ვაკანსიები` : `${clean} — ვაკანსიები`;
}
