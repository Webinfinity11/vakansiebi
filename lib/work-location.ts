import type { Vacancy } from './types';
import { latinUrl } from './latin-url';
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
    /^(?:(?:(?:სამუშაოს?|სამუშაო ადგილის|მუშაობის|ოფისის)\s+)?(?:ადგილმდებარეობა|მდებარეობა|მისამართი|ქალაქი)|სამუშაო ადგილი|(?:(?:work(?:place)?|office)\s+)?(?:location|city|address))$/i;
  const values = (job.facts || [])
    .filter((f) => label.test(f.label.trim()))
    .map((f) => f.value);
  for (const line of job.description.split('\n')) {
    const text = line.trim().replace(/^[•*–—-]+\s*/, '');
    const m = text.match(/^(.{2,50}?)\s*:\s*(.{1,180})$/);
    if (m && label.test(m[1])) values.push(m[2]);
    // Sources sometimes put pay and workplace on the same line. Only a
    // workplace-specific label may match mid-line (not a legal/contact address).
    for (const match of text.matchAll(
      /(?<![\p{L}])(?:სამუშაო ადგილი|(?:სამუშაოს?|მუშაობის)\s+(?:ადგილმდებარეობა|მდებარეობა|მისამართი|ქალაქი)|(?:work(?:place)?|office)\s+(?:location|city|address))\s*:\s*(.{1,180})/giu,
    ))
      values.push(match[1]);
    // Do not match a company's headquarters or branch-network introduction.
    const office = text.match(
      /^(?:სამუშაო\s+)?ოფისი\s+მდებარეობს\s+(.{1,180})$/u,
    );
    if (office) values.push(office[1]);
  }
  const found = new Set<string>();
  for (const value of values)
    for (const city of cities) {
      const forms = city.endsWith('ი')
        ? city.slice(0, -1) + '(?:ი|ში|ის)'
        : city + '(?:ში|ს)?';
      if (
        new RegExp(
          `(?<![\\p{L}])(?:${forms}|${latinUrl(city)})(?![\\p{L}])`,
          'iu',
        ).test(value)
      )
        found.add(city);
    }
  // Several workplace cities require a multi-location model; do not arbitrarily select one.
  return found.size === 1 ? [...found][0] : '';
}
