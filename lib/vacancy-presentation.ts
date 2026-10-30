import { salarySummary } from './salary-summary';

/** One concise salary label across cards, detail facts and sharing. */
export function compactSalary(
  value: string,
  period = '',
  locale: 'ka' | 'en' = 'ka',
) {
  const label = salarySummary(value, period);
  if (locale !== 'en') return label;
  if (label === 'შეთანხმებით') return 'Negotiable';
  const units: Record<string, string> = {
    თვე: 'month',
    დღე: 'day',
    სთ: 'hour',
    კვირა: 'week',
    წელი: 'year',
    ცვლა: 'shift',
    'საკონტაქტო სთ': 'contact hour',
    'მ²': 'm²',
  };
  return label.replace(
    / \/ (.+)$/,
    (_, unit: string) => ` / ${units[unit] ?? unit}`,
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
