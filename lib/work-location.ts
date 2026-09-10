import type { Vacancy } from './types';
const cities = [
  'თბილისი',
  'რუსთავი',
  'ბათუმი',
  'ქუთაისი',
  'გორი',
  'ფოთი',
  'ზუგდიდი',
  'თელავი',
  'ახალციხე',
  'ოზურგეთი',
  'ქობულეთი',
  'მარნეული',
  'ბორჯომი',
  'სამტრედია',
  'ზესტაფონი',
  'ქარელი',
  'კასპი',
  'ხაშური',
  'წნორი',
  'ყვარელი',
  'ახმეტა',
  'დედოფლისწყარო',
  'საგარეჯო',
  'გურჯაანი',
  'კაბალი',
  'წინანდალი',
  'ლაგოდეხი',
  'სიღნაღი',
  'მცხეთა',
  'დუშეთი',
  'თიანეთი',
  'ბოლნისი',
  'დმანისი',
  'გარდაბანი',
  'წალკა',
  'თეთრიწყარო',
  'სენაკი',
  'აბაშა',
  'მარტვილი',
  'ხობი',
  'წალენჯიხა',
  'ჩხოროწყუ',
  'ლანჩხუთი',
  'ჩოხატაური',
  'წყალტუბო',
  'ხონი',
  'საჩხერე',
  'ჭიათურა',
  'ტყიბული',
  'თერჯოლა',
  'ბაღდათი',
  'ვანი',
  'ხარაგაული',
  'ამბროლაური',
  'ონი',
  'ცაგერი',
  'ლენტეხი',
  'მესტია',
  'ახალქალაქი',
  'ნინოწმინდა',
  'ადიგენი',
  'ასპინძა',
  'ხელვაჩაური',
  'ქედა',
  'შუახევი',
  'ხულო',
];
/** Only explicit workplace labels, never cities in an employer's general introduction. */
export function explicitWorkCity(
  job: Pick<Vacancy, 'description' | 'facts'>,
): string {
  const label =
    /^(?:(?:(?:სამუშაოს?|სამუშაო ადგილის|მუშაობის)\s+)?(?:ადგილმდებარეობა|მდებარეობა|მისამართი|ქალაქი)|სამუშაო ადგილი|(?:work(?:place)?\s+)?(?:location|city|address))$/i;
  const values = (job.facts || [])
    .filter((f) => label.test(f.label.trim()))
    .map((f) => f.value);
  for (const line of job.description.split('\n')) {
    const m = line
      .trim()
      .replace(/^[•*–—-]+\s*/, '')
      .match(/^(.{2,50}?)\s*:\s*(.{1,180})$/);
    if (m && label.test(m[1])) values.push(m[2]);
  }
  const found = new Set<string>();
  for (const value of values)
    for (const city of cities) {
      const forms = city.endsWith('ი')
        ? city.slice(0, -1) + '(?:ი|ში|ის)'
        : city + '(?:ში|ს)?';
      if (new RegExp(`(?<![\\p{L}])${forms}(?![\\p{L}])`, 'u').test(value))
        found.add(city);
    }
  // Several workplace cities require a multi-location model; do not arbitrarily select one.
  return found.size === 1 ? [...found][0] : '';
}
