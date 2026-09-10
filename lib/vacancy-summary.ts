import type { Vacancy } from './types';

/** Extract short, attributable excerpts. Never infer missing terms or translate them. */
export function vacancySummary(job: Pick<Vacancy, 'description' | 'facts'>) {
  const lines = job.description
    .split('\n')
    .map((line) => line.trim().replace(/^[•*–—-]+\s*/, ''))
    .filter(Boolean);
  const result: { label: string; value: string }[] = [];
  for (const [label, pattern] of [
    [
      'გამოცდილება',
      /^(?:(?:სამუშაო|საჭირო|მოთხოვნილი)\s+)?გამოცდილება\s*[:–—-]\s*(.+)$|^(?:work\s+)?experience\s*[:–—-]\s*(.+)$/i,
    ],
    [
      'მისამართი',
      /^(?:სამუშაო\s+)?(?:მისამართი|ადგილმდებარეობა|სამუშაო ადგილი|address|location)\s*[:–—-]\s*(.+)$/i,
    ],
    [
      'ბენეფიტები',
      /^(?:ბენეფიტები|ჩვენ გთავაზობთ|კომპანია გთავაზობთ|შეთავაზება|benefits|we offer)(?:\s*[:–—-]\s*(.*)|\s*)$/i,
    ],
    ['მთავარი მოთხოვნა', /^(?:აუცილებელია|სავალდებულოა)\s*[:–—-]?\s+(.+)$/i],
  ] as const) {
    const fact = job.facts?.find((f) =>
      (label === 'გამოცდილება'
        ? /^(?:სამუშაო )?გამოცდილება$|^(?:work )?experience$/i
        : label === 'მისამართი'
          ? /^(?:სამუშაო )?მისამართი$|^ადგილმდებარეობა$|^address$|^location$/i
          : label === 'ბენეფიტები'
            ? /^ბენეფიტები$|^benefits$/i
            : /^მთავარი მოთხოვნა$/i
      ).test(f.label.trim()),
    );
    if (fact?.value.trim() && fact.value.length <= 260) {
      result.push({ label, value: fact.value.trim() });
      continue;
    }
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(pattern);
      if (!match) continue;
      let value = match[1] || match[2] || '';
      if (label === 'ბენეფიტები' && !value) {
        const benefits: string[] = [];
        for (const next of lines.slice(i + 1, i + 6)) {
          if (
            /მოთხოვნ|მოვალეობ|გამოგვიგზავ|რეზიუმ|\bCV\b|responsibilit|requirements|apply|@|:\s*$|\?$|^(?:მისამართი|გრაფიკი|სამუშაო საათები)/i.test(
              next,
            )
          )
            break;
          if (
            next.length > 140 ||
            benefits.join(' · ').length + next.length > 260
          )
            break;
          benefits.push(next);
          if (benefits.length === 3) break;
        }
        value = benefits.join(' · ');
      }
      if (value && value.length <= 260) {
        result.push({ label, value });
        break;
      }
    }
  }
  return result;
}
