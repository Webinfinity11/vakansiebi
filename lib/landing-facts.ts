/** A landing page's list, summed up: shared by the server and the board. */
export type LandingFacts = {
  total: number;
  /** Posted in the last seven days, today included. */
  fresh: number;
  /** Quartiles of the stated pay in GEL, or null below eight figures. */
  salary: {
    period: 'month' | 'day';
    count: number;
    low: number;
    median: number;
    high: number;
  } | null;
  /** The employers with the most vacancies in the list, two or more each. */
  employers: { slug: string; name: string; count: number }[];
};

/* Grouped by hand rather than by Intl: Node and the browser group "ka-GE"
   digits differently (1000 / 1,000), which breaks hydration. */
export const groupDigits = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* The figures in words that stay true whatever the list holds: none, one, or
   thousands, all new or none new, pay stated or not. The employer names are
   left to the caller, which links them; `employers` only says how they are
   introduced. */
export function factsText(
  facts: LandingFacts,
  total = facts.total,
  /** The page's keyword phrase ("ავტოსამრეცხაოს ვაკანსიები"), named once more
      in the figures so the text says what the page is about, not "these". */
  name = '',
) {
  if (total <= 0)
    return {
      lead: 'ამ ეტაპზე აქტიური განცხადება არ არის; ახალი ვაკანსიები სიაში გამოქვეყნებისთანავე გამოჩნდება.',
      salary: '',
      employers: '',
    };
  // The figures are held for half an hour; the count on screen is live.
  // If the live list changed since this snapshot, its age distribution is
  // unknown. Clamping could falsely claim every remaining job was newly added.
  const fresh = total === facts.total ? facts.fresh : 0;
  const lead =
    (name ? `${name}: ` : '') +
    `ახლა აქტიურია ${groupDigits(total)} განცხადება` +
    (fresh === 0
      ? '.'
      : fresh === total
        ? total === 1
          ? ', რომელიც ბოლო კვირაში დაემატა.'
          : ', ყველა ბოლო კვირაში დაემატა.'
        : // The count last: "მათ შორის 1 ბოლო 7 დღეში" read as one run of numbers.
          `, ბოლო კვირაში დაემატა ${groupDigits(fresh)}.`);
  const salary =
    facts.salary && facts.salary.count <= total ? facts.salary : null;
  const per = salary?.period === 'day' ? 'დღეში' : 'თვეში';
  // "1 275 ₾" is a statistic; a reader quotes pay in round figures.
  const step = salary?.period === 'day' ? 5 : 50;
  const round = (value: number) => Math.round(value / step) * step || value;
  const pay = !salary
    ? ''
    : round(salary.low) === round(salary.high)
      ? `${groupDigits(salary.count)} განცხადებაში მითითებული ხელფასების შუა 50% დაახლოებით ${groupDigits(round(salary.low))} ₾-ია ${per}.`
      : `${groupDigits(salary.count)} განცხადებაში მითითებული ხელფასების შუა 50% ${groupDigits(round(salary.low))}-დან ${groupDigits(round(salary.high))} ₾-მდეა ${per}.`;
  // A name list after a colon reads the same for one employer or three.
  const employers =
    facts.employers.length === 0
      ? ''
      : facts.employers.length === 1
        ? 'ყველაზე აქტიური დამსაქმებელი:'
        : 'ყველაზე აქტიური დამსაქმებლები:';
  return { lead, salary: pay, employers };
}
