import type { ApplicationAnswer } from './job-questions';
/* Shared between the company workspace UI and its API: hiring stages and the candidate shape. */
export const candidateStages = [
  'new',
  'interview',
  'offer',
  'hired',
  'rejected',
] as const;
/** Legacy stages remain stored unchanged; every read and stage request uses this mapping. */
export function normalizeCandidateStage(stage: string): CandidateStage {
  return stage === 'review' || stage === 'shortlist' ? 'new' : stage as CandidateStage;
}
export type CandidateStage = (typeof candidateStages)[number];
export const stageLabels: Record<CandidateStage, string> = {
  new: 'ახალი',
  interview: 'გასაუბრება',
  offer: 'შეთავაზება',
  hired: 'აყვანილი',
  rejected: 'უარი',
};
export type CandidateSource = 'swipe' | 'resume' | 'upload' | 'cv_box' | 'base';
export const languageLevels = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'] as const;
export type CandidateLanguageLevel = (typeof languageLevels)[number];
export const educationLevels = [
  'secondary',
  'vocational',
  'bachelor',
  'master',
  'phd',
] as const;
export type EducationLevel = (typeof educationLevels)[number];
export const educationLabels: Record<EducationLevel, string> = {
  secondary: 'საშუალო',
  vocational: 'პროფესიული',
  bachelor: 'ბაკალავრი',
  master: 'მაგისტრი',
  phd: 'დოქტორი',
};
/** Where a profile's facts came from: the JOBX resume form, rules applied to the CV file's
    text, or a person at the company who corrected it. */
export type ProfileOrigin = 'jobx' | 'parsed' | 'edited';
/** What the candidate's CV says, reduced for filtering the CV base. Built from the JOBX resume,
    or extracted from an uploaded PDF/DOCX/DOC by rules (no external service), and correctable
    by the company. Null when nothing could be read (e.g. a scanned image without text). */
export type CandidateProfile = {
  origin: ProfileOrigin;
  name?: string;
  email?: string;
  phone?: string;
  certifications?: string[];
  positions?: { title: string; company: string; start: string; end: string }[];
  parse?: { confidence: number; reason: string | null; nameMissing?: boolean };
  /** Total work experience in whole years, overlapping jobs counted once. */
  years: number | null;
  /** Most recent first: "role — company". */
  roles: string[];
  /** Canonical labels ("Excel", "1C", "მართვის მოწმობა B"), no duplicates. */
  skills: string[];
  /** Canonical Georgian language names ("ინგლისური"), level when known. */
  languages: { name: string; level: CandidateLanguageLevel | null }[];
  education: string[];
  /** Highest level reached, when it can be told. */
  educationLevel: EducationLevel | null;
  /** City from the CV, canonical Georgian name when known. */
  city: string;
  /** Text of the whole CV for keyword search (compare case-insensitively). */
  text: string;
};
/** Fields a company may correct on a candidate's profile. */
export type CandidateProfileEdit = { name?: string; title?: string } & Partial<
  Pick<
    CandidateProfile,
    'years' | 'skills' | 'languages' | 'educationLevel' | 'city' | 'roles'
  >
>;
export type Candidate = {
  saved?: boolean;
  added?: { jobId: string | null; jobTitle: string } | null;
  entry: string;
  source: CandidateSource;
  jobId: string | null;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  city: string;
  appliedAt: string;
  hiredAt?: string | null;
  interviewAt: string | null;
  interviewNote: string;
  stage: CandidateStage;
  rating: number | null;
  seen: boolean;
  notes: number;
  hasCv: boolean;
  /** The candidate's JOBX resume has a photo. */
  photo: boolean;
  profile: CandidateProfile | null;
  answers?: ApplicationAnswer[];
  requirementsMatch?: boolean | null;
  /** Opaque key of the email, to tell the same person apart without showing the address. */
  person?: string;
  /** A JOBX CV base person whose phone and email the company has not opened yet. */
  contactHidden?: boolean;
};
export type CandidateNote = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};
/** Who a person is across entries: the same address on several vacancies is one person. */
export function personKey(c: Pick<Candidate, 'email' | 'name' | 'entry' | 'person'>) {
  return c.person || c.email.trim().toLowerCase() || c.entry;
}

/** Georgian mobile numbers are often entered without the country code. */
export function candidatePhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^5\d{8}$/.test(digits)) digits = '995' + digits;
  return digits ? '+' + digits : '';
}
