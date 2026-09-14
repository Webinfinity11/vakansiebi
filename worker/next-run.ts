/** Scheduled GitHub runs share a fixed UTC slot. Align successful checks with that
 * slot so an eight-minute scrape does not make the next three-hour run look early.
 * Longer multiples of the cron interval keep the same slot; local workers and
 * non-multiple intervals wait their full duration from completion. */
export function nextRunAt(
  intervalMinutes: number,
  now = Date.now(),
  cronMinutes = Number(process.env.SCRAPE_CRON_MINUTES) || 0,
) {
  const period = intervalMinutes * 60_000;
  if (cronMinutes >= 15 && intervalMinutes % cronMinutes === 0) {
    const anchor = 17 * 60_000; // workflow cron minute, UTC
    const slot = cronMinutes * 60_000;
    return new Date(anchor + Math.floor((now - anchor) / slot) * slot + period);
  }
  return new Date(now + period);
}
