import { z } from 'zod';

export const rejectionReasons = ['incomplete', 'no_contact', 'duplicate', 'rules', 'other'] as const;
export type RejectionReason = typeof rejectionReasons[number];
export const rejectionLabels: Record<RejectionReason, string> = {
  incomplete: 'არასრული აღწერა',
  no_contact: 'საკონტაქტო ინფორმაცია არ არის',
  duplicate: 'დუბლიკატი',
  rules: 'წესების დარღვევა',
  other: 'სხვა',
};
export const rejectionGuidance: Record<RejectionReason, string> = {
  incomplete: 'გთხოვთ, შეავსოთ ვაკანსიის აღწერა: მიუთითეთ მოვალეობები, მოთხოვნები და სამუშაო პირობები.',
  no_contact: 'გთხოვთ, მიუთითოთ ელფოსტა ან განაცხადის გასაგზავნი ბმული, რომ კანდიდატებმა დაკავშირება შეძლონ.',
  duplicate: 'ეს ვაკანსია უკვე განთავსებულია. გთხოვთ, განაახლოთ არსებული განცხადება ან განმარტოთ, რით განსხვავდება ახალი ვაკანსია.',
  rules: 'გთხოვთ, გადაამოწმოთ განცხადება განთავსების წესებთან და გაასწოროთ მითითებული დარღვევა.',
  other: 'გთხოვთ, გაითვალისწინოთ მითითებული შენიშვნა და გასწორებული განცხადება ხელახლა გამოგზავნოთ.',
};
export const rejectionSchema = z.object({
  reason: z.enum(rejectionReasons),
  note: z.string().trim().max(500, 'შენიშვნა არ უნდა აღემატებოდეს 500 სიმბოლოს.').default(''),
}).refine(value => value.reason !== 'other' || value.note.length > 0, {
  path: ['note'], message: 'მიუთითეთ უარყოფის მიზეზი.',
});
export type JobRejection = z.infer<typeof rejectionSchema> & { createdAt: string };
export function rejectionText(reason: RejectionReason, note = '') {
  return `${rejectionLabels[reason]}${note.trim() ? ` — ${note.trim()}` : ''}`;
}
