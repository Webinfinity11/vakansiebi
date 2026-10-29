import type { JobSubmission } from './job-submission';
import { employmentOptions, workModes } from './job-submission';
import { categories, type Vacancy } from './types';
export type CompanyJobForm = Pick<
  JobSubmission,
  | 'title'
  | 'city'
  | 'category'
  | 'mode'
  | 'employmentType'
  | 'salaryFrom'
  | 'salaryTo'
  | 'salaryPeriod'
  | 'salaryBasis'
  | 'deadline'
  | 'description'
  | 'contact'
>;
export function newCompanyJob(): CompanyJobForm {
  return {
    title: '',
    city: 'თბილისი',
    category: '',
    mode: 'ადგილზე',
    employmentType: 'სრული განაკვეთი',
    salaryFrom: '',
    salaryTo: '',
    salaryPeriod: 'თვე',
    salaryBasis: 'ხელზე',
    deadline: '',
    description: '',
    contact: '',
  };
}
export function companyJobForm(v: Vacancy): CompanyJobForm {
  const range = v.salary.match(/(\d[\d ]*)\s*[–-]\s*(\d[\d ]*)/);
  return {
    title: v.title,
    city: v.city,
    category: categories.includes(v.category as (typeof categories)[number])
      ? (v.category as (typeof categories)[number])
      : '',
    mode: workModes.includes(v.mode as (typeof workModes)[number])
      ? (v.mode as (typeof workModes)[number])
      : 'ადგილზე',
    employmentType: employmentOptions.includes(
      v.employmentType as (typeof employmentOptions)[number],
    )
      ? (v.employmentType as (typeof employmentOptions)[number])
      : 'სრული განაკვეთი',
    salaryFrom: v.salaryMin ? String(v.salaryMin) : '',
    salaryTo: range?.[2]?.replaceAll(' ', '') ?? '',
    salaryPeriod: v.salaryPeriod === 'დღე' ? 'დღე' : 'თვე',
    salaryBasis: v.salary.includes('დარიცხული') ? 'დარიცხული' : 'ხელზე',
    deadline: v.deadline,
    description: v.description,
    contact:
      v.applicationLinks?.[0]?.url ||
      v.facts?.find((f) => /ელფოსტა|ტელეფონი/.test(f.label))?.value ||
      '',
  };
}
