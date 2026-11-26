const months = ['იანვარს', 'თებერვალს', 'მარტს', 'აპრილს', 'მაისს', 'ივნისს', 'ივლისს', 'აგვისტოს', 'სექტემბერს', 'ოქტომბერს', 'ნოემბერს', 'დეკემბერს'];

/** Georgian dative date, using the same Tbilisi calendar as placement deadlines. */
export function onDate(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid placement expiry');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi', month: 'numeric', day: 'numeric',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${Number(parts.day)} ${months[Number(parts.month) - 1]}`;
}
