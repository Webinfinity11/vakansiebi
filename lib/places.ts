// Town names for CV profiles and the talent filters. A parsed CV's "city" is
// only kept when it is a known Georgian town or a short "City, Country" line;
// anything else (a skill, a sentence) is not a place and must not become a filter.
const translit: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k',
  ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u',
  ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts',
  ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};
const latin = (ka: string) => [...ka].map((c) => translit[c] ?? c).join('');
const russian: Record<string, string> = {
  თბილისი: 'тбилиси', ბათუმი: 'батуми', ქუთაისი: 'кутаиси', რუსთავი: 'рустави',
  ზუგდიდი: 'зугдиди', გორი: 'гори', ფოთი: 'поти', თელავი: 'телави',
  ახალციხე: 'ахалцихе', მცხეთა: 'мцхета', ოზურგეთი: 'озургети', ქობულეთი: 'кобулети',
  ხაშური: 'хашури', სამტრედია: 'самтредиа', სენაკი: 'сенаки', ზესტაფონი: 'зестафони',
  მარნეული: 'марнеули', ბორჯომი: 'боржоми',
};
const towns = [
  'თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'ზუგდიდი', 'გორი', 'ფოთი', 'თელავი',
  'ახალციხე', 'მცხეთა', 'ოზურგეთი', 'ქობულეთი', 'ხაშური', 'სამტრედია', 'სენაკი',
  'ზესტაფონი', 'მარნეული', 'ბორჯომი', 'ახალქალაქი', 'გურჯაანი', 'საგარეჯო', 'ყვარელი',
  'სიღნაღი', 'ლაგოდეხი', 'კასპი', 'ქარელი', 'თერჯოლა', 'ჭიათურა', 'საჩხერე', 'ტყიბული',
  'წყალტუბო', 'ხონი', 'მარტვილი', 'აბაშა', 'ლანჩხუთი', 'ჩოხატაური', 'ხობი', 'წალენჯიხა',
  'მესტია', 'ამბროლაური', 'ონი', 'დუშეთი', 'თიანეთი', 'ახმეტა', 'დედოფლისწყარო',
  'ბოლნისი', 'გარდაბანი', 'დმანისი', 'თეთრიწყარო', 'წალკა', 'ასპინძა', 'ადიგენი',
  'ნინოწმინდა', 'ხელვაჩაური', 'ქედა', 'ხულო', 'შუახევი', 'ბაკურიანი', 'გუდაური',
  'წნორი', 'ვაზიანი', 'წეროვანი', 'ურეკი',
];
export const cityAliases: Record<string, string[]> = Object.fromEntries(
  towns.map((t) => [t, [t, latin(t), ...(russian[t] ? [russian[t]] : [])]]),
);
const fold = (s: string) =>
  s.normalize('NFKC').normalize('NFC').toLowerCase().replace(/й/g, 'и');
const contains = (text: string, word: string) =>
  new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'u').test(text);
/** The known town named in `text`, earliest mention first. */
export function knownCity(text: string): string {
  const t = fold(text);
  let best = { city: '', at: Infinity };
  for (const [city, names] of Object.entries(cityAliases))
    for (const n of names)
      if (contains(t, n)) {
        const at = t.search(new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, 'u'));
        if (at < best.at) best = { city, at };
      }
  return best.city;
}
const word = "[\\p{L}.'’-]+";
const phrase = `${word}(?: ${word}){0,2}`;
/** "Boston, USA" style lines: two short place-like parts. */
export const isCityCountry = (s: string) =>
  s.length <= 40 && new RegExp(`^${phrase},\\s*${phrase}$`, 'u').test(s.trim());
/** A town name for display and filtering, or '' when `raw` is not a place.
 * `typed` is for the city field a person filled in themselves. */
export function placeName(raw: string | null | undefined, typed = false): string {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const known = knownCity(s);
  if (known) return known;
  if (isCityCountry(s)) return s;
  if (typed && s.length <= 30 && new RegExp(`^${phrase}$`, 'u').test(s)) return s;
  return '';
}
