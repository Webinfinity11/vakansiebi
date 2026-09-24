/* Street addresses a map pin can stand on.

   A vacancy's "address" is often a city, a district, a mall or a list of shops. Only a
   street with a house number can be placed precisely, so everything else is refused here
   rather than guessed later: a pin in the wrong place is worse than no pin. */

export type StreetAddress = {
  /** The street as written, initials removed: "თამარაშვილის". */
  street: string;
  /** The distinctive word used to check a geocoder's answer: "თამარაშვილის". */
  stem: string;
  /** House number, digits and an optional letter: "11ა". */
  number: string;
  city: string;
  /** A district named beside it (ვაკე, საბურთალო…), used only to break ties. */
  district: string;
  /** The text sent to the geocoder. */
  query: string;
};

export const mapCities = [
  'თბილისი',
  'ბათუმი',
  'ქუთაისი',
  'რუსთავი',
  'გორი',
  'ზუგდიდი',
  'ფოთი',
  'თელავი',
  'ქობულეთი',
  'მცხეთა',
  'ზესტაფონი',
  'სამტრედია',
  'ხაშური',
  'მარნეული',
  'ოზურგეთი',
  'ახალციხე',
  'ბორჯომი',
  'ბაკურიანი',
  'გუდაური',
  'სენაკი',
  'გარდაბანი',
  'საგარეჯო',
  'კასპი',
  'ქარელი',
  'გურჯაანი',
  'სიღნაღი',
  'ლაგოდეხი',
  'ახმეტა',
  'დუშეთი',
  'ბოლნისი',
  'წყალტუბო',
  'ჭიათურა',
  'საჩხერე',
  'ტყიბული',
  'ლანჩხუთი',
  'ახალქალაქი',
  'მესტია',
  'ხობი',
  'მარტვილი',
  'ქედა',
  'ხელვაჩაური',
  'ამბროლაური',
  'ონი',
  'ცაგერი',
  'დედოფლისწყარო',
  'თიანეთი',
  'დმანისი',
  'წალკა',
  'თეთრიწყარო',
  'ადიგენი',
  'ასპინძა',
  'ნინოწმინდა',
  'ბაღდათი',
  'ვანი',
  'თერჯოლა',
  'ხონი',
  'აბაშა',
  'ჩხოროწყუ',
  'წალენჯიხა',
  'ჩოხატაური',
  'სურამი',
];
const districts = [
  'ვაკე',
  'საბურთალო',
  'დიდუბე',
  'ჩუღურეთი',
  'ვერე',
  'მთაწმინდა',
  'სოლოლაკი',
  'ავლაბარი',
  'ისანი',
  'სამგორი',
  'ვარკეთილი',
  'გლდანი',
  'ნაძალადევი',
  'დიღომი',
  'ვაზისუბანი',
  'ლილო',
  'ორთაჭალა',
  'კრწანისი',
  'ბაგები',
  'წყნეთი',
  'მუხიანი',
  'თემქა',
  'ლისი',
  'ორხევი',
];
const streetTypes: [RegExp, string][] = [
  [/^(?:ქ\.?|ქუჩ(?:ა|აზე)?)$/, 'ქუჩა'],
  [/^(?:გამზ\.?|გამზირი|გამზირზე)$/, 'გამზირი'],
  [/^(?:ხეივ\.?|ხეივანი)$/, 'ხეივანი'],
  [/^(?:შეს\.?|შესახვევი)$/, 'შესახვევი'],
  [/^(?:ჩიხი)$/, 'ჩიხი'],
  [/^(?:მოედ\.?|მოედანი)$/, 'მოედანი'],
  [/^(?:სანაპირო)$/, 'სანაპირო'],
  [/^(?:აღმართი)$/, 'აღმართი'],
  [/^(?:ტრაქტი)$/, 'ტრაქტი'],
  [/^(?:გზატკ\.?|გზატკეცილი)$/, 'გზატკეცილი'],
];
const word = /^[ა-ჰ][ა-ჰ-]*$/;
/* Words that end a street name without being part of it, or that mean the number is not a house. */
const notStreet =
  /^(?:სართული|ოფისი|ოთახი|კორპუსი|ბინა|მიკრორაიონი|კვარტალი|სადარბაზო|მაღაზია|ფილიალი|სავაჭრო|ცენტრი|მოლი|სითი|ქალაქი|რაიონი|მეტრო|მეტროსთან|სადგური|დასახლება|ყოფილი)$/;

/* A city is a whole word — "გორგასლის" is a street, not Gori. The genitive and locative
   ("თბილისის", "ბათუმში") count as the city too. */
/* Districts are whole words too: "ლისი" sits inside "თბილისი". */
function districtIn(text: string) {
  const words = text.split(/[^ა-ჰ-]+/);
  return districts.find((d) => words.includes(d)) ?? '';
}
function cityIn(text: string) {
  const words = text.split(/[^ა-ჰ-]+/);
  return mapCities.filter((city) => {
    const stem = city.replace(/ი$/, '');
    return words.some(
      (w) =>
        w === city ||
        w === `${stem}ის` ||
        w === `${stem}ში` ||
        w === `${city}ს`,
    );
  });
}

/* Reads one segment ("ვაკე, მ. თამარაშვილის 11ა ნომერი") into a street and a number. */
function streetIn(
  segment: string,
): { street: string; stem: string; number: string } | null {
  const clean = segment
    .replace(/[„“"«»()]/g, ' ')
    .replace(/(^|[\s,])([ა-ჰ])\.(?=[ა-ჰ])/g, '$1$2. ') // "ნ.გოგოლის" → "ნ. გოგოლის"
    // Floors, flats, offices and blocks carry numbers that are not house numbers: drop them.
    .replace(
      /(?:მე-?\d+\s*)?(?:სართული|სართ\.|ბინა\/ოფისი|ბინა|ოფისი|ოთახი|კორპუსი|კორპ\.|სადარბაზო)\s*(?:No\.?|[#N])?\s*\d*[ა-ჰa-z]?/g,
      ' ',
    )
    // NFKC has already turned "№" into "No".
    .replace(/(?:№|#|\bNo\.?\s*(?=\d)|\bN\s*(?=\d)|ნომერი|ნომ\.)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // A micro-district or quarter number is not a house number.
  if (/მე-?\d+\s*(?:მიკრო|კვარტ)|\d+\s*(?:მიკრორაიონი|კვარტალი)/.test(clean))
    return null;
  const tokens = clean.split(/[\s,]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const number = tokens[i].match(
      /^(\d{1,4})([ა-ჰa-zA-Z])?(?:[-–/]\d{1,4}[ა-ჰa-zA-Z]?)?[.;]?$/,
    );
    if (!number) continue;
    const house = number[1] + (number[2] || '').toLowerCase();
    // Number after the street: "თამარაშვილის 11ა", "სარაჯიშვილის ქ. 2".
    const before: string[] = [];
    let type = '';
    for (let j = i - 1; j >= 0 && before.length < 2; j--) {
      const t = tokens[j];
      const known = streetTypes.find(([re]) => re.test(t));
      if (known && !before.length && !type) {
        type = known[1];
        continue;
      }
      if (/^[ა-ჰ]\.$/.test(t)) continue; // an initial: "მ." — the geocoder knows the full name
      if (
        !word.test(t) ||
        notStreet.test(t) ||
        districts.includes(t) ||
        cityIn(t).length
      )
        break;
      before.unshift(t);
    }
    const genitive =
      before.length && /(?:ის|ს)$/.test(before[before.length - 1]);
    if (before.length && (genitive || type))
      return {
        street: [...before, type].filter(Boolean).join(' '),
        stem: before[before.length - 1],
        number: house,
      };
    // Number before the street: "69 ეგნატე ნინოშვილის ქუჩა".
    const after: string[] = [];
    let afterType = '';
    for (let j = i + 1; j < tokens.length && after.length < 3; j++) {
      const t = tokens[j];
      const known = streetTypes.find(([re]) => re.test(t));
      if (known && after.length) {
        afterType = known[1];
        break;
      }
      if (
        !word.test(t) ||
        notStreet.test(t) ||
        districts.includes(t) ||
        cityIn(t).length
      )
        break;
      after.push(t);
    }
    if (after.length && afterType)
      return {
        street: [...after, afterType].join(' '),
        stem: after[after.length - 1],
        number: house,
      };
  }
  return null;
}

/**
 * Every precise street address in a vacancy's address text. `fallbackCity` is the vacancy's
 * own city, used only when the text names none; text naming several cities without saying
 * which address is where is refused.
 */
export function streetAddresses(
  raw: string,
  fallbackCity: string,
): StreetAddress[] {
  const text = raw
    .normalize('NFKC')
    .replace(/\b0\d{3}\b/g, ' ')
    .replace(/ქ\.(?=[ა-ჰ])/g, 'ქ. ');
  const named = cityIn(text);
  const fallback = cityIn(fallbackCity);
  const segments = text.split(/[;|]|\s\/\s|\n/).flatMap((part) => {
    // "თბილისი ( ქავთარაძის 3; …)" — what sits in brackets is an address of its own.
    const inner = [...part.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
    return [part.replace(/\([^)]*\)/g, ' '), ...inner];
  });
  const found: StreetAddress[] = [];
  for (const segment of segments) {
    const hit = streetIn(segment);
    if (!hit) continue;
    const own = cityIn(segment);
    // A Tbilisi district names the city as surely as the word თბილისი does.
    const inTbilisi = !!districtIn(segment);
    const city =
      own.length === 1
        ? own[0]
        : named.length === 1
          ? named[0]
          : !named.length && inTbilisi
            ? 'თბილისი'
            : !named.length && fallback.length === 1
              ? fallback[0]
              : '';
    if (!city) continue;
    const district = districtIn(segment) || districtIn(text);
    const query = `${hit.street} ${hit.number}, ${city}`;
    if (!found.some((f) => f.query === query))
      found.push({ ...hit, city, district, query });
  }
  // A long list of branches is a chain's shop list, not where this job is.
  return found.length > 3 ? [] : found;
}
