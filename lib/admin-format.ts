/* One way to write a date across the admin, in Tbilisi time.

   Written out rather than left to Intl: browsers without full Georgian locale data print
   "M09 24" or fall back to "9/24/26, 9:03 PM", which is how three formats crept in. */
const months = [
  'იან',
  'თებ',
  'მარ',
  'აპრ',
  'მაი',
  'ივნ',
  'ივლ',
  'აგვ',
  'სექ',
  'ოქტ',
  'ნოე',
  'დეკ',
];
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tbilisi',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function tbilisi(value: string | number | Date) {
  const got = Object.fromEntries(
    parts.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(got.year),
    month: Number(got.month),
    day: Number(got.day),
    time: `${got.hour}:${got.minute}`,
  };
}

/** "24 სექ", with the year only when it is not the current one. */
export function adminDate(value: string | number | Date) {
  const d = tbilisi(value);
  const year = d.year === tbilisi(Date.now()).year ? '' : ` ${d.year}`;
  return `${d.day} ${months[d.month - 1]}${year}`;
}

/** "24 სექ, 21:11". */
export function adminTime(value: string | number | Date) {
  return `${adminDate(value)}, ${tbilisi(value).time}`;
}

/** "21:11" — for rows already grouped under their day. */
export function adminClock(value: string | number | Date) {
  return tbilisi(value).time;
}

/** A day heading for grouped lists: "დღეს", "გუშინ", otherwise the date. */
export function adminDay(value: string | number | Date, now = Date.now()) {
  const d = tbilisi(value);
  const key = (x: { year: number; month: number; day: number }) =>
    Date.UTC(x.year, x.month - 1, x.day);
  const diff = Math.round((key(tbilisi(now)) - key(d)) / 86400000);
  if (diff === 0) return 'დღეს';
  if (diff === 1) return 'გუშინ';
  return adminDate(value);
}
