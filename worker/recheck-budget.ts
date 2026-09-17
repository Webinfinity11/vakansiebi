/** Spread routine rechecks across three days, leaving margin before the seven-day
 * verification expiry. Large/new-item backlogs still share the existing 90/10 queue. */
export function recheckBudget(
  mode: string | undefined,
  batchSize: number,
  published: number,
  intervalMinutes: number,
  urgent: number,
) {
  if (mode !== 'economical') return batchSize;
  const rotation = Math.ceil(
    (published * Math.max(180, intervalMinutes)) / (3 * 1440),
  );
  // Never save work by starving records approaching the verification grace limit.
  return Math.min(
    batchSize,
    Math.max(Math.ceil(batchSize * 0.1), rotation, urgent),
  );
}
