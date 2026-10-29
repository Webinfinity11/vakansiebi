import { latinGeorgianSearch, searchGroups } from './search-language';
import { termPattern } from './job-intelligence';

const normalized = (value: string) => value.normalize('NFKC').toLowerCase();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The catalogue's word boundaries and vocabulary, compiled once per client-side query. */
export function textSearch(query: string): (text: string) => boolean {
  const groups = searchGroups(query).map((terms) => {
    const alternatives = new Set(terms);
    for (const term of terms) {
      if (!/^[a-z]{3,}$/.test(term)) continue;
      const reading = latinGeorgianSearch(term);
      if (reading)
        for (const group of searchGroups(reading))
          for (const variant of group) alternatives.add(variant);
    }
    return [...alternatives].map((term) => {
      if (termPattern(term) === null)
        return (text: string) => text.includes(term);
      const georgian = /^[ა-ჰ][ა-ჰ\s-]*$/u.test(term);
      const whole = !georgian && term.length < 5 && !/[Ѐ-ӿ]/u.test(term);
      const lead = /^[\p{L}\p{N}]/u.test(term) ? '(?<![\\p{L}\\p{N}_])' : '';
      const tail = whole
        ? (/^[a-z]+$/.test(term) ? '(e?s)?' : '') + '(?![\\p{L}\\p{N}_])'
        : '';
      const pattern = new RegExp(lead + escape(term) + tail, 'u');
      return (text: string) => pattern.test(text);
    });
  });
  return (text) => {
    const value = normalized(text);
    return groups.every((alternatives) =>
      alternatives.some((match) => match(value)),
    );
  };
}
