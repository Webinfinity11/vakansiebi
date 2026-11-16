import type { CompanyRole } from './company-portal';

export const companyTabs = ['jobs', 'candidates', 'talent', 'analytics', 'profile', 'billing', 'security', 'team'] as const;
export type CompanyTab = (typeof companyTabs)[number];

/** Match the portal navigation: billing and team are owner-only. */
export function initialCompanyTab(value: string | null, role?: CompanyRole): CompanyTab {
  const tab = companyTabs.find(tab => tab === value) ?? 'jobs';
  return (tab === 'billing' || tab === 'team') && role !== 'owner' ? 'jobs' : tab;
}
