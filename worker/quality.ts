import { createHash } from 'node:crypto';
import type { Vacancy } from '../lib/types';
import { vacancySchema } from '../lib/vacancy-schema';

type Observation = {
  signature: string | null;
  firstSeen: Date | string | null;
  lastSeen: Date | string | null;
  observations: number;
};
export type QualityDecision = {
  hold: boolean;
  warning: string | null;
  signature: string;
  firstSeen: Date;
  lastSeen: Date;
  observations: number;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
function signature(value: unknown) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
const normalized = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
const has = (value: unknown) =>
  typeof value === 'string'
    ? value.trim().length > 0
    : Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined;
function observation(
  key: string,
  previous: Observation,
  now: Date,
  gap: number,
) {
  const same =
    previous.signature === key && previous.firstSeen && previous.lastSeen;
  const firstSeen = same ? new Date(previous.firstSeen!) : now;
  const elapsed = same
    ? now.getTime() - new Date(previous.lastSeen!).getTime()
    : 0;
  const increment = Boolean(same && elapsed >= gap);
  return {
    signature: key,
    firstSeen,
    lastSeen: same && !increment ? new Date(previous.lastSeen!) : now,
    observations: same ? previous.observations + (increment ? 1 : 0) : 1,
  };
}
export const noObservation: Observation = {
  signature: null,
  firstSeen: null,
  lastSeen: null,
  observations: 0,
};
/** Never synthesize missing fields. A held candidate is stored separately from the last good snapshot. */
export function assessVacancy(
  previous: Vacancy | null,
  next: Vacancy,
  prior: Observation = noObservation,
  now = new Date(),
): QualityDecision {
  const structural =
    !vacancySchema.safeParse(next).success ||
    typeof next.company !== 'string' ||
    !next.company.trim();
  const reasons: string[] = [];
  let severe = structural;
  if (structural) reasons.push('invalid identity or required fields');
  if (previous) {
    if (
      normalized(previous.title) !== normalized(next.title) &&
      normalized(previous.company) !== normalized(next.company)
    ) {
      reasons.push('title and employer both changed');
      severe = true;
    }
    if (
      previous.description.length >= 400 &&
      next.description.length < previous.description.length * 0.25
    ) {
      reasons.push('description lost more than 75%');
      severe = true;
    }
    const missing = [
      'city',
      'salary',
      'logoUrl',
      'employmentType',
      'facts',
      'applicationLinks',
      'mode',
      'deadline',
      'datePosted',
    ].filter(
      (key) =>
        has(previous[key as keyof Vacancy]) && !has(next[key as keyof Vacancy]),
    );
    if (
      !missing.includes('salary') &&
      ['salaryMin', 'currency', 'salaryPeriod'].some(
        (key) =>
          has(previous[key as keyof Vacancy]) &&
          !has(next[key as keyof Vacancy]),
      )
    )
      missing.push('salary details');
    if (missing.length) {
      reasons.push(
        'previously known fields disappeared: ' + missing.join(', '),
      );
      severe ||= missing.length >= 3 || missing.includes('deadline');
    }
  }
  const state = observation(signature(next), prior, now, 30 * 60000);
  const confirmed = severe
    ? state.observations >= 3 &&
      now.getTime() - state.firstSeen.getTime() >= 24 * 3600000
    : state.observations >= 2;
  const hold = reasons.length > 0 && (structural || !confirmed);
  return {
    ...state,
    hold,
    warning: hold ? 'Source quality review: ' + reasons.join('; ') : null,
  };
}
export type CountObservation = {
  value: number | null;
  firstSeen: Date | string | null;
  lastSeen: Date | string | null;
  observations: number;
};
/** Confirm an independently repeated source-wide fall before replacing the known coverage baseline. */
export function assessReportedTotal(
  baseline: number | null,
  current: number | null,
  prior: CountObservation = {
    value: null,
    firstSeen: null,
    lastSeen: null,
    observations: 0,
  },
  now = new Date(),
) {
  const suspicious =
    baseline !== null &&
    baseline >= 100 &&
    (current === null || current < baseline * 0.5);
  if (!suspicious)
    return {
      hold: false,
      warning: null,
      candidate: null,
      firstSeen: null,
      lastSeen: null,
      observations: 0,
    };
  const matching =
    current !== null &&
    prior.value !== null &&
    Math.abs(current - prior.value) <= Math.max(5, prior.value * 0.1);
  const state = observation(
    'drop',
    matching
      ? {
          signature: 'drop',
          firstSeen: prior.firstSeen,
          lastSeen: prior.lastSeen,
          observations: prior.observations,
        }
      : noObservation,
    now,
    30 * 60000,
  );
  const hold = current === null || state.observations < 2;
  return {
    hold,
    warning: hold
      ? `Source coverage review: reported total fell from ${baseline} to ${current ?? 'unknown'}; retaining baseline for independent retry`
      : null,
    candidate: hold ? current : null,
    firstSeen: hold ? state.firstSeen : null,
    lastSeen: hold ? state.lastSeen : null,
    observations: hold ? state.observations : 0,
  };
}
