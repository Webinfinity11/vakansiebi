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
  .min(8, 'პაროლი სულ მცირე 8 სიმბოლოს უნდა შეიცავდეს.')
  .max(128, 'პაროლი მაქსიმუმ 128 სიმბოლოა.');
export type CompanyIdentity = {
  id: string;
  companyKey: string;
  name: string;
  username: string;
  email: string;
  mustChangePassword: boolean;
  role: CompanyRole;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  emailVerified: boolean;
  representativeName: string;
  /** The details a review needs; blank ones are still to be filled in. */
  details?: { code: string; representativeName: string; position: string; phone: string };
};
export type CompanyAccount = {
  trustedMode: 'auto' | 'on' | 'off';
  trusted: boolean;
  id: string;
  company_key: string;
  name: string;
  username: string;
  email: string;
  enabled: boolean;
  must_change_password: boolean;
  version: number;
  approval_status: string;
  registration_code: string | null;
  representative_name: string;
  position: string;
  phone: string;
  email_verified: boolean;
  role: CompanyRole;
  /** Other names the company's vacancies appear under. */
  aliases: string[];
  /** JOBX CV base people whose contact or CV the company opened in the last 30 days. */
  baseViews: number;
  createdAt: string;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  /** Vacancies attached to the company, and those live on the site now. */
  jobs: number;
  liveJobs: number;
  /** CVs sent to its vacancies (uploads by the company are not applications): all time and last 30 days. */
  applications: number;
  recentApplications: number;
  team: number;
};

export type CompanyAccountJob = {
  id: string;
  title: string;
  company: string;
  status: string;
  deadline: string | null;
  publishedAt: string | null;
  sources: string | null;
};

export type CompanyRole = 'owner' | 'recruiter' | 'viewer';
