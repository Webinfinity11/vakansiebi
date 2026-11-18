import type { CompanyRole } from './company-portal';

export const companyTabs = ['jobs', 'candidates', 'talent', 'analytics', 'profile', 'billing', 'security', 'team'] as const;
export type CompanyTab = (typeof companyTabs)[number];

/** Match the portal navigation: billing and team are owner-only. */
export function initialCompanyTab(value: string | null, role?: CompanyRole): CompanyTab {
  const tab = companyTabs.find(tab => tab === value) ?? 'jobs';
  return (tab === 'billing' || tab === 'team') && role !== 'owner' ? 'jobs' : tab;
}

/** Where the portal is: a tab, an open candidate, and the candidates filter it was
 * reached with. Kept in the address so links, new tabs and the back button work. */
export type CompanyLocation = {
  tab: CompanyTab;
  entry: string | null;
  job?: string;
  stage?: string;
};
const entryPattern = /^(?:swipe|upload|resume|base):[\w:.-]{1,200}$/;
const stagePattern = /^[a-z_]{2,20}$/;
const jobPattern = /^[\w-]{1,64}$/;
/** Candidates open in the candidates tab and, as a side sheet, over the CV base. */
const entryTabs: CompanyTab[] = ['candidates', 'talent'];

export function readCompanyLocation(search: string, role?: CompanyRole): CompanyLocation {
  const p = new URLSearchParams(search);
  const tab = initialCompanyTab(p.get('tab'), role);
  const entry = p.get('c');
  const job = p.get('job');
  const stage = p.get('stage');
  return {
    tab,
    entry: entryTabs.includes(tab) && entry && entryPattern.test(entry) ? entry : null,
    ...(tab === 'candidates' && job && jobPattern.test(job) ? { job } : {}),
    ...(tab === 'candidates' && stage && stagePattern.test(stage) ? { stage } : {}),
  };
}

export function companyHref(l: CompanyLocation): string {
  const p = new URLSearchParams();
  if (l.tab !== 'jobs') p.set('tab', l.tab);
  if (l.tab === 'candidates') {
    if (l.job) p.set('job', l.job);
    if (l.stage) p.set('stage', l.stage);
  }
  if (l.entry && entryTabs.includes(l.tab)) p.set('c', l.entry);
  const q = p.toString();
  return '/company' + (q ? '?' + q : '');
}

/** Ordinary clicks stay in the app; Cmd/Ctrl/Shift/middle clicks open the link. */
export const plainClick = (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
