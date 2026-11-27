export const templateKinds = ['received', 'interview', 'information', 'rejected', 'accepted'] as const;
export type TemplateKey = (typeof templateKinds)[number];
export type MessageTemplate = { subject: string; body: string };
export type MessageTemplates = Record<TemplateKey, MessageTemplate>;
export const templateLabels: Record<TemplateKey, string> = {
  received: 'განაცხადი მივიღეთ', interview: 'გასაუბრებაზე მოწვევა',
  information: 'დამატებითი ინფორმაცია', rejected: 'უარი', accepted: 'მიღება',
};
export const templateLimits = { subject: 200, body: 5000 };
export const defaultTemplates: MessageTemplates = {
  received: { subject: 'განაცხადი მივიღეთ — {ვაკანსია}', body: 'გამარჯობა, {სახელი}!\n\nმადლობა ინტერესისთვის. თქვენი განაცხადი ვაკანსიაზე „{ვაკანსია}“ მივიღეთ. შერჩევის შემდეგ დაგიკავშირდებით.\n\nპატივისცემით,\n{კომპანია}' },
  interview: { subject: 'გასაუბრებაზე მოწვევა — {ვაკანსია}', body: 'გამარჯობა, {სახელი}!\n\nგიწვევთ გასაუბრებაზე ვაკანსიისთვის „{ვაკანსია}“. {თარიღი}\nგთხოვთ, დაგვიდასტუროთ, შეძლებთ თუ არა დასწრებას.\n\nპატივისცემით,\n{კომპანია}' },
  information: { subject: 'დამატებითი ინფორმაცია — {ვაკანსია}', body: 'გამარჯობა, {სახელი}!\n\nვაკანსიაზე „{ვაკანსია}“ თქვენი განაცხადის განსახილველად დამატებითი ინფორმაცია გვჭირდება: [მიუთითეთ, რა ინფორმაციაა საჭირო].\n\nპატივისცემით,\n{კომპანია}' },
  rejected: { subject: 'შერჩევის შედეგი — {ვაკანსია}', body: 'გამარჯობა, {სახელი}!\n\nმადლობა ვაკანსიით „{ვაკანსია}“ დაინტერესებისთვის და დათმობილი დროისთვის. ამ ეტაპზე არჩევანი სხვა კანდიდატზე შევაჩერეთ. წარმატებას გისურვებთ!\n\nპატივისცემით,\n{კომპანია}' },
  accepted: { subject: 'შერჩევის შედეგი — {ვაკანსია}', body: 'გამარჯობა, {სახელი}!\n\nმოხარული ვართ, რომ ვაკანსიაზე „{ვაკანსია}“ თქვენი კანდიდატურა შეირჩა. სამუშაო პირობებისა და დაწყების თარიღის შესათანხმებლად დაგიკავშირდებით.\n\nპატივისცემით,\n{კომპანია}' },
};
export function validTemplate(value: unknown): value is MessageTemplate {
  if (!value || typeof value !== 'object') return false;
  const t = value as MessageTemplate;
  return typeof t.subject === 'string' && !!t.subject.trim() && t.subject.length <= templateLimits.subject && !/[\r\n]/.test(t.subject)
    && typeof t.body === 'string' && !!t.body.trim() && t.body.length <= templateLimits.body;
}
export function render(template: Partial<MessageTemplate> | null | undefined, data: { name?: string | null; jobTitle?: string | null; companyName?: string | null; date?: string | null } = {}): MessageTemplate {
  const clean = (v: unknown) => typeof v === 'string' ? v : '';
  const values: Record<string, string> = { სახელი: clean(data?.name).trim().split(/\s+/)[0] || '', ვაკანსია: clean(data?.jobTitle), კომპანია: clean(data?.companyName) };
  if (data?.date != null) values.თარიღი = clean(data.date);
  const fill = (v: unknown) => clean(v).replace(/\{([^{}]+)\}/g, (match, key: string) => values[key] ?? match);
  return { subject: fill(template?.subject), body: fill(template?.body) };
}
