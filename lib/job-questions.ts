import { z } from 'zod';

export const jobQuestionSchema = z
  .object({
    id: z.uuid(),
    text: z.string().trim().min(1).max(300),
    kind: z.enum(['yes_no', 'choice', 'text']),
    options: z.array(z.string().trim().min(1).max(150)).max(8).default([]),
    preferred: z.string().trim().max(500).default(''),
  })
  .superRefine((q, ctx) => {
    const options = q.kind === 'yes_no' ? ['კი', 'არა'] : q.options;
    if (
      q.kind === 'choice' &&
      (options.length < 2 || new Set(options).size !== options.length)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'მიუთითე 2–8 განსხვავებული პასუხი.',
        path: ['options'],
      });
    if (q.kind !== 'text' && q.preferred && !options.includes(q.preferred))
      ctx.addIssue({
        code: 'custom',
        message: 'სასურველი პასუხი აირჩიე ვარიანტებიდან.',
        path: ['preferred'],
      });
  });
export const jobQuestionsSchema = z
  .array(jobQuestionSchema)
  .max(5)
  .refine(
    (questions) =>
      new Set(questions.map((q) => q.id)).size === questions.length,
    'კითხვების იდენტიფიკატორები უნდა განსხვავდებოდეს.',
  );
export type JobQuestion = z.infer<typeof jobQuestionSchema>;
export type PublicJobQuestion = Omit<JobQuestion, 'preferred'>;
export type ApplicationAnswer = {
  id: string;
  question: string;
  answer: string;
  preferred: string;
  matches: boolean | null;
};
export function answerQuestions(
  questions: JobQuestion[],
  values: unknown,
): ApplicationAnswer[] {
  const answers = z
    .record(z.string(), z.string().trim().max(500))
    .parse(values ?? {});
  if (Object.keys(answers).some((id) => !questions.some((q) => q.id === id)))
    throw Error('კითხვარი შეიცვალა. განაახლე გვერდი და შეავსე ხელახლა.');
  return questions.map((q) => {
    const answer = answers[q.id];
    const options = q.kind === 'yes_no' ? ['კი', 'არა'] : q.options;
    if (!answer || (q.kind !== 'text' && !options.includes(answer)))
      throw Error('უპასუხე ვაკანსიის ყველა კითხვას.');
    return {
      id: q.id,
      question: q.text,
      answer,
      preferred: q.preferred,
      matches: q.preferred
        ? answer.toLocaleLowerCase() === q.preferred.toLocaleLowerCase()
        : null,
    };
  });
}
export function requirementsMatch(
  answers: ApplicationAnswer[],
): boolean | null {
  const checked = answers.filter((a) => a.matches !== null);
  return checked.length ? checked.every((a) => a.matches) : null;
}
