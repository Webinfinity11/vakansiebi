import { z } from 'zod';
export const companyUsername = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,63}$/,
    'მომხმარებლის სახელი: 3–64 ლათინური ასო, ციფრი, წერტილი, ტირე ან ქვედა ტირე.',
  );
export const companyPassword = z
  .string()
  .min(12, 'პაროლი სულ მცირე 12 სიმბოლოს უნდა შეიცავდეს.')
  .max(128, 'პაროლი მაქსიმუმ 128 სიმბოლოა.');
export type CompanyIdentity = {
  id: string;
  companyKey: string;
  name: string;
  username: string;
  email: string;
  mustChangePassword: boolean;
};
export type CompanyAccount = {
  id: string;
  company_key: string;
  name: string;
  username: string;
  email: string;
  enabled: boolean;
  must_change_password: boolean;
  version: number;
};
