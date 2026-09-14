/** Format the amount without dropping the source's pay conditions. */
export function compactSalary(value: string, period = '') {
  value = value
    .replace(/\bnet\b/gi, 'ხელზე ასაღები')
    .replace(/\bgross\b/gi, 'დარიცხული')
    .trim()
    .replace(/[;.]$/, '');
  const number = String.raw`\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?`;
  const currency = String.raw`(?:₾|ლარი|ლ\.?|GEL|USD|EUR|\$|€)`;
  const match = value.match(
    new RegExp(
      `(${number})(?:\\s*(?:${currency})?\\s*[-–—]\\s*(${number}))?\\s*(${currency})(?![a-zA-Zა-ჰ])`,
      'i',
    ),
  );
  if (!match) return value.trim();
  const format = (amount: string) => {
    const clean = amount.replace(/[ \u00a0\u202f]/g, '');
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  const unit = /^(?:₾|ლარი|ლ\.?|GEL)$/i.test(match[3])
    ? '₾'
    : match[3].toUpperCase();
  const amount = `${format(match[1])}${match[2] ? `–${format(match[2])}` : ''} ${unit}`;
  const label = value.replace(match[0], amount).trim();
  const periodLabel: Record<string, string> = {
    თვე: 'თვეში',
    დღე: 'დღეში',
    საათი: 'საათში',
    month: 'თვეში',
    day: 'დღეში',
    hour: 'საათში',
  };
  const hasPeriod = /თვე|თვიურ|დღე|დღიურ|საათ|month|day|daily|hour/i.test(
    label,
  );
  return !hasPeriod && periodLabel[period]
    ? `${label} · ${periodLabel[period]}`
    : label;
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
