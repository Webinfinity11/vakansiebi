import { z } from 'zod';
export const premiumPriceGEL = 20;
export const premiumDays = 14;
export const invoiceContact = {
  email: 'invoice@jobx.ge',
  phone: '579 53 53 20',
  telephone: '+995579535320',
} as const;
export const invoiceStatuses = {
  pending: 'გადახდის მოლოდინში',
  paid: 'გადახდილია',
  cancelled: 'გაუქმებულია',
  refund_required: 'თანხა დასაბრუნებელია',
  refunded: 'თანხა დაბრუნებულია',
} as const;
export function validGeorgianIban(value: string) {
  if (!/^GE\d{2}[A-Z]{2}\d{16}$/.test(value)) return false;
  const numeric = (value.slice(4) + value.slice(0, 4)).replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const digit of numeric)
    remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}
export const billingSettingsSchema = z.object({
  payee_name: z
    .string()
    .trim()
    .min(3, 'მიუთითე მიმღების სახელი და გვარი')
    .max(200),
  bank_name: z.string().trim().min(2, 'მიუთითე ბანკი').max(120),
  iban: z
    .string()
    .transform((v) => v.replace(/\s/g, '').toUpperCase())
    .refine(validGeorgianIban, 'შეამოწმე ქართული IBAN-ის სისწორე'),
});
export function invoiceNumber(number: string | number, date: string | Date) {
  const issuedAt = new Date(date);
  const code = String(number).padStart(6, '0');
  // Keep the payment references on invoices issued before this format change.
  if (issuedAt < new Date('2026-09-15T14:15:47Z'))
    return `JOBX-${issuedAt.getUTCFullYear()}-${code}`;
  // The database sequence never resets; do not truncate or reuse a code.
  return code;
}
export type JobInvoice = {
  id: string;
  number: string;
  token: string;
  job_id: string;
  amount_gel: number;
  service_days: number;
  payer_name: string;
  vacancy_title: string;
  payee_name: string;
  bank_name: string;
  iban: string;
  status: keyof typeof invoiceStatuses;
  created_at: string;
  paid_at: string | null;
  activated_at: string | null;
};
