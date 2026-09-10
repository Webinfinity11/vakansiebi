/** Shorten only unambiguous wording. Preserve qualifiers, ranges and source language. */
export function compactSalary(value: string) {
  return value
    .trim()
    .replace(
      /^ფიქსირებული ხელფასი\s*\((\d[\d ,.]*\s*(?:ლარი|₾))\)\s*\+\s*ყოველთვიური ბონუსი[.;]?$/,
      '$1 + ყოველთვიური ბონუსი',
    )
    .replace(/^(?:ანაზღაურება|ხელფასი)\s*:\s*/i, '')
    .replace(/(\d)\s*ლარი(?=$|[\s),.;+])/g, '$1 ₾')
    .replace(/^(\d{4,})(?=\s*₾)/, (n) =>
      Number(n)
        .toLocaleString('fr-FR')
        .replace(/\u202f/g, ' '),
    );
}
export function compactSchedule(value: string) {
  return value
    .trim()
    .replace(/ორშაბათი\s*[-–—]\s*პარასკევი/g, 'ორშ–პარ')
    .replace(/კვირაში\s+(\d+)\s+სამუშაო საათი/g, 'კვირაში $1 საათი')
    .replace(/[;.]$/, '');
}
const normalized = (value: string) =>
  value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
export function factAlreadyVisible(
  value: string,
  description: string,
  values: string[],
) {
  const key = normalized(value);
  return (
    !key ||
    normalized(description).includes(key) ||
    values.some((other) => normalized(other).includes(key))
  );
}
