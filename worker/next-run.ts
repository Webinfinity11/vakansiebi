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
    const due = anchor + Math.floor((now - anchor) / slot) * slot + period;
    return cronMinutes === 180 ? nextDaytimeSlot(due) : new Date(due);
  }
  return cronMinutes === 180
    ? nextDaytimeSlot(now + period)
    : new Date(now + period);
}

/** Matches scrape.yml: UTC 03:17, 06:17, 09:17, 12:17, 15:17, 18:17. */
function nextDaytimeSlot(due: number) {
  const midnight = new Date(due);
  midnight.setUTCHours(0, 0, 0, 0);
  for (const hour of [3, 6, 9, 12, 15, 18]) {
    const slot = midnight.getTime() + (hour * 60 + 17) * 60_000;
    if (slot >= due) return new Date(slot);
  }
  return new Date(midnight.getTime() + 86400000 + (3 * 60 + 17) * 60_000);
}

/** The longest a quiet source waits between checks. */
export const quietCeilingMinutes = 720;

/**
 * How long a source waits after a check, given how many checks in a row (this one included)
 * found nothing new. One empty check is ordinary — a board has quiet hours — so the second
 * doubles the wait and the third doubles it again, up to twelve hours. Anything new resets it.
 * Doubling keeps the wait a multiple of the three-hour slot, so it stays aligned with the cron.
 */
export function quietIntervalMinutes(
  intervalMinutes: number,
  emptyStreak: number,
) {
  if (emptyStreak < 2) return intervalMinutes;
  return Math.max(
    intervalMinutes,
    Math.min(quietCeilingMinutes, intervalMinutes * 2 ** (emptyStreak - 1)),
  );
}
