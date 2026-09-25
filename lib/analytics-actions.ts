/* What a reader does on the public pages beyond searching, reading and contacting, as short
   code names. The codes are the whole record: no vacancy, text or visitor goes with them, so
   they say which controls are used and which errors are met, never who used them. The groups
   are how the admin reads them; a code outside this list is still stored and shown by name. */
export const actionGroups = [
  {
    title: 'სია და ძებნა',
    codes: {
      open_list: 'ვაკანსია სიიდან გახსნა',
      suggest_pick: 'შეთავაზებული ძებნა აირჩია',
      did_you_mean: '„ხომ არ გულისხმობდი“ აირჩია',
      reset_filters: 'ფილტრები გაასუფთავა',
      empty_reset: 'უშედეგოდან ყველა ვაკანსიაზე',
      more_click: '„მეტის ჩვენება“ დააჭირა',
      more_auto: 'სიამ შემდეგი თავად ჩატვირთა',
      page_prev: 'წინა გვერდი',
      page_first: 'სიის დასაწყისში დაბრუნება',
    },
  },
  {
    title: 'შენახული, ნანახი, დამალული',
    codes: {
      saved_open: 'შენახულების სია გახსნა',
      unsave: 'შენახვა გააუქმა',
      undo_save: 'შენახვის ცვლილება დააბრუნა',
      hide: 'ვაკანსია დამალა',
      restore: 'დამალული დააბრუნა',
      open_recent: 'ბოლოს ნანახიდან გახსნა',
      recent_clear: 'ბოლოს ნანახი გაასუფთავა',
    },
  },
  {
    title: 'ვაკანსიის გვერდი',
    codes: {
      share_native: 'გააზიარა',
      share_copy: 'ბმული დააკოპირა',
      share_failed: 'გაზიარება გაუქმდა ან ვერ მოხერხდა',
      copy_email: 'ელფოსტა დააკოპირა',
      translate: 'თარგმანი გახსნა',
      open_similar: 'მსგავსი ვაკანსია გახსნა',
      company_open: 'კომპანიის გვერდზე გადავიდა',
      cv_hint: '„შექმენი CV“ ბმული',
      report_open: 'შეცდომის ფორმა გახსნა',
      report_sent: 'შეცდომა შეატყობინა',
    },
  },
  {
    title: 'კომპანიის გვერდი',
    codes: {
      company_page: 'კომპანიის გვერდი გაიხსნა',
      open_company: 'ვაკანსია კომპანიის გვერდიდან',
    },
  },
  {
    title: 'რუკა და მეტრო',
    codes: {
      map_page: 'რუკის გვერდი გაიხსნა',
      map_pin: 'რუკაზე პინს დააჭირა',
      map_cluster: 'პინების ჯგუფი გაადიდა',
      map_card: 'რუკის სიაში ბარათს დააჭირა',
      map_open: 'ვაკანსია რუკიდან გახსნა',
      map_city: 'რუკაზე ქალაქზე გადავიდა',
      map_locate: 'რუკაზე თავისი მდებარეობა ჩართო',
      map_search: 'რუკაზე ძებნა გამოიყენა',
      map_paid: 'რუკაზე „ხელფასით“ ჩართო',
      map_category: 'რუკაზე მიმართულება აირჩია',
      map_sheet: 'ტელეფონზე რუკის სია გახსნა',
      metro_page: 'მეტროს გვერდი გაიხსნა',
      metro_station: 'მეტროს სადგური გახსნა',
      metro_walk: 'სავალი დრო შეცვალა',
      metro_nearest: 'უახლოესი სადგური მოძებნა',
      metro_open: 'ვაკანსია მეტროს გვერდიდან გახსნა',
    },
  },
  {
    title: 'შეცდომები',
    codes: {
      results_error: 'სია ვერ ჩაიტვირთა',
      more_error: 'შემდეგი ვაკანსიები ვერ ჩაიტვირთა',
      similar_error: 'მსგავსი ვაკანსიები ვერ ჩაიტვირთა',
      not_found: 'გვერდი ვერ მოიძებნა (404)',
    },
  },
  {
    title: 'თემა',
    codes: {
      theme_dark: 'მუქ თემაზე გადართო',
      theme_light: 'ღია თემაზე გადართო',
    },
  },
] as const;

type Codes<G> = G extends { codes: infer C } ? keyof C : never;
/* relax_<filter> is the empty-results offer to drop one filter, named by the filter's key. */
export type ActionCode =
  | Codes<(typeof actionGroups)[number]>
  | `relax_${string}`;

export type ActionRow = { code: string; label: string; count: number };
export type ActionGroup = { title: string; rows: ActionRow[]; total: number };

/* Every known code is listed, counted or not — a control nobody presses is itself a finding —
   busiest first. The empty-results offers join the list group under the filter they drop;
   a code this list does not know yet goes to a last group by its own name, so an event added
   to a page before the admin learns its label is still seen. */
export function groupActions(
  rows: readonly { value: string; count: number }[],
  relaxLabel: (filter: string) => string,
): ActionGroup[] {
  const counts = new Map(rows.map(({ value, count }) => [value, count]));
  const claimed = new Set<string>();
  const groups: ActionGroup[] = actionGroups.map((group, index) => {
    const listed: ActionRow[] = Object.entries(group.codes).map(
      ([code, label]) => {
        claimed.add(code);
        return { code, label, count: counts.get(code) ?? 0 };
      },
    );
    if (index === 0)
      for (const { value, count } of rows)
        if (value.startsWith('relax_')) {
          claimed.add(value);
          listed.push({
            code: value,
            label: relaxLabel(value.slice(6)),
            count,
          });
        }
    return { title: group.title, rows: listed, total: 0 };
  });
  const unknown = rows
    .filter(({ value }) => !claimed.has(value))
    .map(({ value, count }) => ({ code: value, label: value, count }));
  if (unknown.length) groups.push({ title: 'სხვა', rows: unknown, total: 0 });
  for (const group of groups) {
    group.rows.sort(
      (a, b) => b.count - a.count || a.code.localeCompare(b.code),
    );
    group.total = group.rows.reduce((sum, row) => sum + row.count, 0);
  }
  return groups;
}
