import type { Candidate } from './company-candidates';

export type AnalyticsCandidate = Pick<Candidate, 'source' | 'jobId' | 'appliedAt' | 'stage' | 'hiredAt'>;
export type CandidatePeriod = { first: string; last: string; jobId?: string };

/** Same inclusive UTC calendar days as the vacancy chart; counts entries, not people. */
export function candidatesInPeriod(candidates: readonly AnalyticsCandidate[], period: CandidatePeriod) {
  return candidates.filter((candidate) => {
    const timestamp = Date.parse(candidate.appliedAt);
    if (!Number.isFinite(timestamp)) return false;
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return day >= period.first && day <= period.last &&
      (!period.jobId || candidate.jobId === period.jobId);
  });
}

export function candidateSources(candidates: readonly AnalyticsCandidate[], period: CandidatePeriod) {
  const scoped = candidatesInPeriod(candidates, period);
  const counts = { applied: 0, upload: 0, cv_box: 0, base: 0 };
  for (const candidate of scoped) {
    const source = candidate.source === 'swipe' || candidate.source === 'resume'
      ? 'applied' : candidate.source;
    counts[source]++;
  }
  // People taken from the JOBX CV base are listed only when there are some.
  return (['applied', 'upload', 'cv_box', 'base'] as const)
    .filter((source) => source !== 'base' || counts.base > 0)
    .map((source) => ({
      source,
      count: counts[source],
      share: scoped.length ? counts[source] / scoped.length : 0,
    }));
}

/** Average for the application's chart cohort, using only recorded hire dates. */
export function candidateHireTime(candidates: readonly AnalyticsCandidate[], period: CandidatePeriod) {
  const hired = candidatesInPeriod(candidates, period).filter((candidate) => candidate.stage === 'hired');
  const durations = hired.flatMap((candidate) => {
    if (!candidate.hiredAt) return [];
    const days = (Date.parse(candidate.hiredAt) - Date.parse(candidate.appliedAt)) / 864e5;
    return Number.isFinite(days) && days >= 0 ? [days] : [];
  });
  return {
    averageDays: durations.length ? durations.reduce((sum, days) => sum + days, 0) / durations.length : null,
    measuredHires: durations.length,
    hiredCount: hired.length,
  };
}
