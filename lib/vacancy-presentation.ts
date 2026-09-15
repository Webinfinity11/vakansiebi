import { salarySummary } from './salary-summary';

/** One concise salary label across cards, detail facts and sharing. */
export function compactSalary(value: string, period = '') {
  return salarySummary(value, period);
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
