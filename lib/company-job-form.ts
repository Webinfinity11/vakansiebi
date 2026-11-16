import type { JobQuestion } from './job-questions';
import type { JobSubmission } from './job-submission';
import {
  submissionDate,
  employmentOptions,
  workModes,
  experienceOptions,
  languageOptions,
  languageLevels,
} from './job-submission';
import { categories, type Vacancy } from './types';
export type CompanyJobForm = Pick<
  JobSubmission,
  | 'experience'
  | 'languages'
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
> & {
  placement?: JobSubmission['placement'];
  questions?: JobQuestion[];
};
export function newCompanyJob(): CompanyJobForm {
  return {
    experience: '',
    languages: [],
    placement: 'standard',
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
  const experience =
    v.facts?.find((f) => f.label === 'გამოცდილება')?.value ?? '';
  const languages: CompanyJobForm['languages'] = [];
  for (const value of (
    v.facts?.find((f) => f.label === 'ენები')?.value ?? ''
  ).split(',')) {
    const match = value
      .trim()
      .match(/^([^()]+?)(?: \((A1|A2|B1|B2|C1|C2)\))?$/);
    if (!match) continue;
    const name = languageOptions.find((n) => n === match[1]);
    const level = languageLevels.find((l) => l === match[2]) ?? '';
    if (name && !languages.some((l) => l.name === name) && languages.length < 5)
      languages.push({ name, level });
  }
  return {
    experience: experienceOptions.find((e) => e === experience) ?? '',
    languages,
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

// Only the plain-new path calls this; copies, edits and drafts keep their data.
export function newCompanyJobDefaults({ accountEmail = '', lastJob, today = submissionDate() }: { accountEmail?: string; lastJob?: CompanyJobForm; today?: string } = {}): CompanyJobForm {
  return {
    ...newCompanyJob(),
    city: lastJob?.city ?? newCompanyJob().city,
    mode: lastJob?.mode ?? newCompanyJob().mode,
    category: lastJob?.category ?? '',
    contact: lastJob?.contact.trim() || accountEmail,
    deadline: new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10),
  };
}
export function suggestJobCategory(title: string): CompanyJobForm['category'] {
  const rules: [RegExp, CompanyJobForm['category']][] = [
    [/დეველოპერ|პროგრამისტ|\b(developer|programmer)\b/i, 'ტექნოლოგიები'],
    [/ბუღალტერ|ფინანსისტ|\baccountant\b/i, 'ფინანსები'],
    [/გაყიდვ|\bsales\b/i, 'გაყიდვები'],
    [/მასწავლებელ|პედაგოგ|\bteacher\b/i, 'განათლება'],
    [/ექთან|ექიმ|\bnurse\b/i, 'სამედიცინო'],
    [/იურისტ|ადვოკატ|\blawyer\b/i, 'იურიდიული'],
  ];
  return rules.find(([pattern]) => pattern.test(title))?.[1] ?? '';
}
export function shortCompanyDescription(text: string, limit = 200): string {
  const value = text.trim();
  if (value.length <= limit) return value;
  const excerpt = value.slice(0, limit + 1);
  const boundary = excerpt.lastIndexOf(' ');
  return (boundary > 0 ? excerpt.slice(0, boundary) : value.slice(0, limit)).trimEnd() + '…';
}
