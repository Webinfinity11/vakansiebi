import { searchTerms } from './job-intelligence';
import { workSchedule } from './vacancy-details';
import type { PublicJob } from './types';
const normalize = (value: string) =>
  value.normalize('NFKC').toLowerCase().trim();
export function roleTerms(title: string) {
  return searchTerms(title).filter(
    (term) =>
      term.length >= 3 &&
      ![
        'ვაკანსია',
        'ვეძებთ',
        'საჭიროა',
        'დასაქმება',
        'სამუშაო',
        'თანამშრომელი',
        'დღიური',
        'ერთდღიანი',
        'დროებითი',
        'სრული',
        'განაკვეთი',
        'the',
        'and',
        'for',
      ].includes(term),
  );
}
export function similarity(job: PublicJob, candidate: PublicJob) {
  if (job.id === candidate.id) return null;
  const title = normalize(candidate.title);
  const terms = roleTerms(job.title);
  const overlap = terms.filter((term) => title.includes(term)).length;
  const city = Boolean(
    job.city &&
    !['სხვა', 'საქართველო'].includes(job.city) &&
    normalize(job.city) === normalize(candidate.city),
  );
  const category = Boolean(
    job.category &&
    job.category !== 'სხვა' &&
    job.category === candidate.category,
  );
  const roleMatch = overlap >= (terms.length >= 3 ? 2 : 1);
  if (!roleMatch && !(category && city)) return null;
  const schedule = workSchedule(job)
    .map(normalize)
    .filter((value) => !/შეთანხმ|არ არის|negotiab|not specified/i.test(value));
  const sameSchedule =
    schedule.length > 0 &&
    workSchedule(candidate).some((value) =>
      schedule.includes(normalize(value)),
    );
  const reasons = [
    roleMatch
      ? 'მსგავსი პოზიცია'
      : category
        ? `მიმართულება: ${job.category}`
        : '',
    city ? `ქალაქი: ${job.city}` : '',
    sameSchedule ? 'გრაფიკი ემთხვევა' : '',
  ].filter(Boolean);
  return {
    score:
      overlap * 5 +
      Number(city) * 3 +
      Number(category) * 2 +
      Number(sameSchedule) * 2,
    reasons,
  };
}
export type SimilarVacancy = { job: PublicJob; reasons: string[] };
