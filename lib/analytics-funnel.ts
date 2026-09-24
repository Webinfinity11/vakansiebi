import type { Ranked } from './server/analytics';

export type FunnelStep = {
  name: string;
  label: string;
  count: number;
  share: number;
  drop: number;
};

export type FunnelReport = {
  steps: FunnelStep[];
  opened: number;
  left: { name: string; label: string; count: number }[];
  refused: { name: string; count: number }[];
};

export function buildFunnel(
  rows: Ranked[],
  ladder: readonly (readonly [string, string])[],
  labels: Record<string, string>,
): FunnelReport {
  const counts = new Map(rows.map(({ value, count }) => [value, count]));
  const opened = counts.get(ladder[0]?.[0]) ?? 0;
  let previous = 0;
  const steps = ladder.map(([name, label]) => {
    const count = counts.get(name) ?? 0;
    const step = {
      name,
      label,
      count,
      share: opened > 0 ? Math.round((count / opened) * 100) : 0,
      drop:
        previous > 0
          ? Math.max(0, Math.round(((previous - count) / previous) * 100))
          : 0,
    };
    previous = count;
    return step;
  });
  const left = rows
    .filter(({ value }) => value.startsWith('left_'))
    .map(({ value, count }) => {
      const name = value.slice(5);
      return { name, label: labels[name] ?? name, count };
    })
    .sort((a, b) => b.count - a.count);
  const refused = rows
    .filter(({ value }) => value.startsWith('invalid_'))
    .map(({ value, count }) => ({ name: value.slice(8), count }))
    .sort((a, b) => b.count - a.count);
  return { steps, opened, left, refused };
}

export const postLadder = [
  ['opened', 'ფორმა გაიხსნა'],
  ['started', 'შევსება დაიწყო'],
  ['details', 'დეტალებამდე მივიდა'],
  ['plans', 'განთავსების არჩევამდე'],
  ['submitted', 'გაგზავნას დააჭირა'],
  ['done', 'გაიგზავნა'],
] as const;

export const postLabels: Record<string, string> =
  Object.fromEntries(postLadder);

/* The posting form's fields as the form itself names them, for "which field stopped it". */
export const postFieldLabels: Record<string, string> = {
  title: 'პოზიციის დასახელება',
  company: 'კომპანიის დასახელება',
  city: 'ქალაქი',
  cityOther: 'დასახლების სახელი',
  description: 'ვაკანსიის აღწერა',
  contact: 'კანდიდატების მიმართვის გზა',
  logo: 'კომპანიის ლოგო',
  salaryFrom: 'ხელფასი — მინიმუმი',
  salaryTo: 'ხელფასი — მაქსიმუმი',
  salaryPeriod: 'ანაზღაურების სიხშირე',
  salaryBasis: 'ანაზღაურების ტიპი',
  mode: 'მუშაობის ფორმატი',
  employmentType: 'დასაქმების ტიპი',
  deadline: 'განაცხადების ბოლო ვადა',
  category: 'კატეგორია',
  placement: 'განთავსების ტიპი',
  billingEmail: 'ელფოსტა ინვოისისთვის',
  consent: 'თანხმობა',
  requestId: 'მოთხოვნის ნომერი (გვერდის განახლება)',
};

/* What else the posting form reports, beside its steps. */
export const postExtraLabels: Record<string, string> = {
  draft_restored: 'მონახაზი აღდგა',
  logo_added: 'ლოგო აიტვირთა',
  logo_failed: 'ლოგო ვერ დამუშავდა',
  refused: 'სერვერმა ველები არ მიიღო',
  failed: 'გაგზავნა ჩავარდა (კავშირი ან სერვერი)',
};

export const resumeLadder = [
  ['opened', 'გვერდი გაიხსნა'],
  ['started', 'შევსება დაიწყო'],
  ['section_experience', 'გამოცდილებამდე მივიდა'],
  ['section_education', 'განათლებამდე მივიდა'],
  ['section_skills', 'უნარებამდე მივიდა'],
  ['section_languages', 'ენებამდე მივიდა'],
  ['printed', 'PDF-ად შეინახა'],
] as const;

export const resumeLabels: Record<string, string> = {
  opened: 'გვერდი გაიხსნა',
  started: 'შევსება დაიწყო',
  contact: 'პირადი მონაცემები',
  summary: 'შესავალი',
  experience: 'გამოცდილება',
  education: 'განათლება',
  skills: 'უნარები',
  languages: 'ენები',
  section_contact: 'პირადი მონაცემები',
  section_summary: 'შესავალი',
  section_experience: 'გამოცდილება',
  section_education: 'განათლება',
  section_skills: 'უნარები',
  section_languages: 'ენები',
  preview: 'წინასწარი ნახვა',
  template_classic: 'კლასიკური',
  template_modern: 'თანამედროვე',
  template_compact: 'კომპაქტური',
  template_bold: 'გამოკვეთილი',
  style_accent: 'აქცენტის ფერი',
  style_text: 'ტექსტის ფერი',
  style_font: 'შრიფტი',
  style_photo_shape: 'ფოტოს ფორმა',
  photo_added: 'ფოტო დაემატა',
  photo_removed: 'ფოტო წაიშალა',
  language_ka: 'ქართული',
  language_en: 'ინგლისური',
  printed: 'PDF-ად შეინახა',
  cleared: 'გასუფთავება',
  left_contact: 'პირადი მონაცემები',
  left_summary: 'შესავალი',
  left_experience: 'გამოცდილება',
  left_education: 'განათლება',
  left_skills: 'უნარები',
  left_languages: 'ენები',
};
