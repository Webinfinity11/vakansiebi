import type { SearchFilters } from './personal-space';

// The control can receive a whole search at runtime. Never copy query/category/city into
// advanced state: its later spread would overwrite edits to those independent filters.
export function advancedValues(
  value:
    | SearchFilters
    | Pick<
        SearchFilters,
        | 'salaryPeriod'
        | 'salaryFrom'
        | 'salaryTo'
        | 'employment'
        | 'entryLevel'
        | 'postedWithin'
        | 'deep'
      >,
) {
  return {
    salaryPeriod: value.salaryPeriod,
    salaryFrom: value.salaryFrom,
    salaryTo: value.salaryTo,
    employment: value.employment,
    entryLevel: value.entryLevel,
    postedWithin: value.postedWithin,
    deep: value.deep,
  };
}
