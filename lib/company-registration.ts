import { z } from 'zod';
import { companyPassword } from './company-portal';

const code = z
  .string()
  .trim()
  .regex(/^[0-9]{9}$/, 'საიდენტიფიკაციო კოდი 9 ციფრს უნდა შეიცავდეს.');
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{9,25}$/, 'მიუთითეთ სწორი ტელეფონის ნომერი.');
const person = z.string().trim().min(2, 'მიუთითეთ სახელი და გვარი.').max(120);
const position = z.string().trim().min(2, 'მიუთითეთ თანამდებობა.').max(120);
/** Blank means "not yet given"; anything typed must be valid. */
const later = <T extends z.ZodType<string>>(schema: T) =>
  z.union([z.literal(''), schema]).optional().default('');

/* Registration asks only for what an account needs. The details the review needs
   (identification code, contact person, phone) can come later from the account
   page; older clients that still send them are accepted. */
export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.email().trim().toLowerCase().max(254),
  password: companyPassword,
  code: later(code),
  representativeName: later(person),
  position: later(position),
  phone: later(phone),
});

export const companyDetailsSchema = z.object({
  code: later(code),
  representativeName: later(person),
  position: later(position),
  phone: later(phone),
});
export type CompanyDetails = z.infer<typeof companyDetailsSchema>;

export const companyDetailLabels: Record<keyof CompanyDetails, string> = {
  code: 'საიდენტიფიკაციო კოდი',
  representativeName: 'საკონტაქტო პირი',
  position: 'თანამდებობა',
  phone: 'ტელეფონი',
};
/** The details a review needs. The identification code helps the review but is optional. */
export const requiredCompanyDetails: (keyof CompanyDetails)[] = ['representativeName', 'position', 'phone'];
/** What the company still has to give before it can be reviewed. */
export function missingCompanyDetails(d: Partial<Record<keyof CompanyDetails, string | null>>) {
  return requiredCompanyDetails
    .filter((key) => !(d[key] ?? '').trim())
    .map((key) => companyDetailLabels[key]);
}

export const invitationSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  role: z.enum(['recruiter', 'viewer']),
});
