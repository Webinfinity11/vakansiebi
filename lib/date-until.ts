const months = ['იანვრამდე', 'თებერვლამდე', 'მარტამდე', 'აპრილამდე', 'მაისამდე', 'ივნისამდე', 'ივლისამდე', 'აგვისტომდე', 'სექტემბრამდე', 'ოქტომბრამდე', 'ნოემბრამდე', 'დეკემბრამდე'];
const calendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tbilisi', year: 'numeric', month: 'numeric', day: 'numeric',
});

/** Georgian “until” date in Tbilisi; include the year only outside the current year. */
export function untilDate(value: string | number | Date, now = new Date()): string {
  // Reject impossible ISO calendar dates rather than accepting Date's rollover.
  if (typeof value === 'string') {
    const day = value.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0];
    if (day) {
      const parsed = new Date(`${day}T00:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return '';
    }
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) return '';
  const parts = Object.fromEntries(calendar.formatToParts(date).map(p => [p.type, p.value]));
  const year = calendar.formatToParts(now).find(p => p.type === 'year')!.value;
  return `${parts.year !== year ? `${parts.year} წლის ` : ''}${Number(parts.day)} ${months[Number(parts.month) - 1]}`;
}
