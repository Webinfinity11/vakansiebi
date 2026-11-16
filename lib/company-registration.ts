import { z } from 'zod';
import { companyPassword } from './company-portal';
export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z
    .string()
    .regex(/^[0-9]{9}$/, 'საიდენტიფიკაციო კოდი 9 ციფრს უნდა შეიცავდეს.'),
  representativeName: z.string().trim().min(2).max(120),
  position: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{9,25}$/, 'მიუთითეთ სწორი ტელეფონის ნომერი.'),
  password: companyPassword,
});
export const invitationSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  role: z.enum(['recruiter', 'viewer']),
});
