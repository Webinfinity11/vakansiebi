/** A paid term uses calendar days in Georgia, independent of the server timezone. */
export function placementDeadline(
  existing: string | undefined,
  activatedAt: Date,
  serviceDays: number,
): string {
  if (!Number.isFinite(activatedAt.getTime()) || !Number.isInteger(serviceDays) || serviceDays < 0)
    throw new RangeError('Invalid placement activation or service days');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(activatedAt);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const end = new Date(Date.parse(today + 'T00:00:00Z') + serviceDays * 86400000)
    .toISOString().slice(0, 10);
  if (existing && /^\d{4}-\d{2}-\d{2}$/.test(existing)) {
    const parsed = new Date(existing + 'T00:00:00Z');
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === existing)
      return existing > end ? existing : end;
  }
  return end;
}
