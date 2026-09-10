import type { Vacancy } from '../lib/types';
import { explicitWorkCity } from '../lib/work-location';
import { visibleFields } from './visible-fields';
export function enrichVacancy(input: Vacancy): Vacancy {
  const fields = visibleFields(input.description);
  const city = input.city || explicitWorkCity(input);
  let result = city !== input.city ? { ...input, city } : input;
  if (!input.salary && fields.salary && !fields.warning)
    result = {
      ...result,
      salary: fields.salary,
      salaryMin: fields.salaryMin,
      currency: fields.currency,
      salaryPeriod: fields.salaryPeriod,
    };
  if (
    input.salary &&
    input.salaryMin === null &&
    fields.salary === input.salary &&
    fields.salaryMin !== null &&
    !fields.warning
  )
    result = {
      ...result,
      salaryMin: fields.salaryMin,
      currency: fields.currency,
      salaryPeriod: fields.salaryPeriod || input.salaryPeriod,
    };
  const pay = fields.payExcerpts.join('\n');
  if (
    pay &&
    pay.length <= 1500 &&
    !input.facts?.some((f) => f.label === 'ანაზღაურების პირობები') &&
    (input.facts?.length || 0) < 30
  )
    result = {
      ...result,
      facts: [
        ...(result.facts || []),
        { label: 'ანაზღაურების პირობები', value: pay },
      ],
    };
  return result;
}
